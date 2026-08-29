import { getEnv } from "@/server/config/env";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough, Transform } from "node:stream";
import { finished } from "node:stream/promises";
import { Upload } from "@aws-sdk/lib-storage";
import { ZipArchive, type ArchiverError } from "archiver";
import { and, eq } from "drizzle-orm";
import { getDb, type Db } from "@/server/db/client";
import { appUser, enrolment, exportJob } from "@/server/db/schema";
import { appendAudit } from "@/server/audit/audit";
import {
  type DiaryExportAttachmentSnapshot,
  type DiaryExportSnapshot,
  toPortableDiaryJson,
} from "@/server/diary/export";
import { renderDiaryPdfToFile } from "@/server/diary/pdf";
import {
  deleteExportObject,
  exportBucket,
  getCleanStream,
  getS3,
} from "@/server/files/s3";
import { enqueue } from "@/server/outbox/outbox";
import type { OutboxPayloads } from "@/server/outbox/outbox";

const sha256 = (data: Buffer | string) =>
  createHash("sha256").update(data).digest("hex");

async function hashFile(path: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = createReadStream(path);
  stream.on("data", (chunk) => hash.update(chunk));
  await finished(stream);
  return hash.digest("hex");
}

function safeFilename(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\\/\0-\x1f\x7f]+/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 120) || "attachment";
}

function verifiedAttachmentStream(file: DiaryExportAttachmentSnapshot) {
  const hash = createHash("sha256");
  let bytes = 0;
  return new Transform({
    transform(chunk, _encoding, callback) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += buffer.length;
      hash.update(buffer);
      callback(null, buffer);
    },
    flush(callback) {
      if (bytes !== file.sizeBytes || hash.digest("hex") !== file.sha256) {
        callback(new Error("attachment_integrity_failed"));
        return;
      }
      callback();
    },
  });
}

export async function handleGenerateDiaryExport(
  payload: OutboxPayloads["generate_diary_export"],
): Promise<void> {
  const db = getDb();
  const jobs = await db
    .select()
    .from(exportJob)
    .where(eq(exportJob.id, payload.exportJobId))
    .limit(1);
  const job = jobs[0];
  if (!job || job.status !== "queued") return;

  if (job.kind === "final") {
    const lifecycle = await db
      .select({ state: enrolment.diaryState, cycle: enrolment.diaryFinishCycle })
      .from(enrolment)
      .where(eq(enrolment.id, job.enrolmentId))
      .limit(1);
    if (
      lifecycle[0]?.state !== "finished" ||
      lifecycle[0]?.cycle !== job.finishCycle
    ) {
      await db
        .update(exportJob)
        .set({ status: "superseded", snapshotJson: { superseded: true }, updatedAt: new Date() })
        .where(eq(exportJob.id, job.id));
      return;
    }
  }

  const claimed = await db
    .update(exportJob)
    .set({ status: "processing", failureCode: null, failureDetail: null, updatedAt: new Date() })
    .where(and(eq(exportJob.id, job.id), eq(exportJob.status, "queued")))
    .returning({ id: exportJob.id });
  if (!claimed[0]) return;

  const workDir = await mkdtemp(join(tmpdir(), "oportfolio-export-"));
  const pdfPath = join(workDir, "diary.pdf");
  const objectKey = `${job.tenantId}/export/${job.id}.zip`;
  let upload: Upload | null = null;

  try {
    const snapshot = job.snapshotJson as unknown as DiaryExportSnapshot;
    await renderDiaryPdfToFile(snapshot, pdfPath);
    const pdfStats = await stat(pdfPath);
    const pdfHash = await hashFile(pdfPath);

    const diaryJson = Buffer.from(
      `${JSON.stringify(toPortableDiaryJson(snapshot), null, 2)}\n`,
      "utf8",
    );
    const readme = Buffer.from(
      [
        "oPortfolio private diary export",
        "",
        "diary.pdf is the human-readable diary.",
        "diary.json is the schema-versioned portable record.",
        "attachments/ contains the original clean files attached to retained entries.",
        "manifest.json describes each file and checksums.sha256 verifies its contents.",
        "",
        "Deleted entries, edit history, sessions and security audit data are not included.",
        "This archive may contain sensitive personal reflection. Store it securely.",
        "",
      ].join("\n"),
      "utf8",
    );

    const attachmentFiles = snapshot.entries.flatMap((entry) =>
      entry.attachments.map((file) => ({
        ...file,
        path: `attachments/${entry.id}/${file.id}-${safeFilename(file.displayName)}`,
      })),
    );
    const payloadFiles = [
      {
        path: "README.txt",
        sizeBytes: readme.length,
        mediaType: "text/plain",
        sha256: sha256(readme),
      },
      {
        path: "diary.pdf",
        sizeBytes: pdfStats.size,
        mediaType: "application/pdf",
        sha256: pdfHash,
      },
      {
        path: "diary.json",
        sizeBytes: diaryJson.length,
        mediaType: "application/json",
        sha256: sha256(diaryJson),
      },
      ...attachmentFiles.map((file) => ({
        path: file.path,
        sizeBytes: file.sizeBytes,
        mediaType: file.mediaType,
        sha256: file.sha256,
      })),
    ];
    const manifest = Buffer.from(
      `${JSON.stringify(
        {
          schemaVersion: "1.0.0",
          exportId: job.id,
          exportKind: job.kind,
          generatedAt: new Date().toISOString(),
          included: ["active entries", "archived entries", "links", "curriculum links", "clean attachments"],
          excluded: ["deleted entries", "revision history", "audit and security data"],
          files: payloadFiles,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    const allChecksums = [
      ...payloadFiles,
      {
        path: "manifest.json",
        sizeBytes: manifest.length,
        mediaType: "application/json",
        sha256: sha256(manifest),
      },
    ];
    const checksumFile = Buffer.from(
      `${allChecksums.map((file) => `${file.sha256}  ${file.path}`).join("\n")}\n`,
      "utf8",
    );

    const archive = new ZipArchive({ zlib: { level: 6 } });
    const body = new PassThrough();
    const archiveHash = createHash("sha256");
    let archiveBytes = 0;
    body.on("data", (chunk: Buffer) => {
      archiveHash.update(chunk);
      archiveBytes += chunk.length;
    });
    archive.on("warning", (error: ArchiverError) => {
      throw error;
    });
    archive.on("error", (error: ArchiverError) => body.destroy(error));
    archive.pipe(body);

    upload = new Upload({
      client: getS3(),
      params: {
        Bucket: exportBucket(),
        Key: objectKey,
        Body: body,
        ContentType: "application/zip",
        Metadata: { exportId: job.id },
      },
    });
    const uploadDone = upload.done();

    archive.append(readme, { name: "README.txt" });
    archive.append(createReadStream(pdfPath), { name: "diary.pdf" });
    archive.append(diaryJson, { name: "diary.json" });
    archive.append(manifest, { name: "manifest.json" });
    archive.append(checksumFile, { name: "checksums.sha256" });
    for (const file of attachmentFiles) {
      const source = await getCleanStream(file.objectKey);
      archive.append(source.pipe(verifiedAttachmentStream(file)), { name: file.path });
    }
    await archive.finalize();
    await uploadDone;

    const archiveSha256 = archiveHash.digest("hex");
    const completedAt = new Date();
    const ready = await db.transaction(async (tx) => {
      const updated = await tx
        .update(exportJob)
        .set({
          status: "ready",
          objectKey,
          archiveSha256,
          sizeBytes: archiveBytes,
          completedAt,
          updatedAt: completedAt,
        })
        .where(and(eq(exportJob.id, job.id), eq(exportJob.status, "processing")))
        .returning({ id: exportJob.id });
      if (!updated[0]) return false;

      const users = await tx
        .select({ email: appUser.emailNormalised })
        .from(appUser)
        .where(eq(appUser.id, job.requestedBy))
        .limit(1);
      if (users[0]) {
        await enqueue(tx as Db, "send_email", {
          to: users[0].email,
          template: "diary_export_ready",
          variables: { appUrl: getEnv().APP_BASE_URL },
        });
      }
      await appendAudit(tx as Db, {
        tenantId: job.tenantId,
        actorUserId: job.requestedBy,
        actorType: "worker",
        action: "export.completed",
        targetType: "export_job",
        targetId: job.id,
        enrolmentId: job.enrolmentId,
        metadata: { kind: job.kind, sizeBytes: archiveBytes },
      });
      return true;
    });
    if (!ready) await deleteExportObject(objectKey);
  } catch (error) {
    if (upload) await upload.abort().catch(() => undefined);
    await deleteExportObject(objectKey).catch(() => undefined);
    const failedAt = new Date();
    await db.transaction(async (tx) => {
      const updated = await tx
        .update(exportJob)
        .set({
          status: "failed",
          failureCode: "generation_failed",
          failureDetail: "The archive could not be generated. Retry from the diary export page.",
          updatedAt: failedAt,
        })
        .where(and(eq(exportJob.id, job.id), eq(exportJob.status, "processing")))
        .returning({ id: exportJob.id });
      if (updated[0]) {
        await appendAudit(tx as Db, {
          tenantId: job.tenantId,
          actorUserId: job.requestedBy,
          actorType: "worker",
          action: "export.failed",
          targetType: "export_job",
          targetId: job.id,
          enrolmentId: job.enrolmentId,
          reasonCode: "generation_failed",
        });
      }
    });
    throw error;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

export async function handleExpireDiaryExport(
  payload: OutboxPayloads["expire_diary_export"],
): Promise<void> {
  const db = getDb();
  const rows = await db
    .select()
    .from(exportJob)
    .where(eq(exportJob.id, payload.exportJobId))
    .limit(1);
  const job = rows[0];
  if (!job) return;
  const due = !job.artifactExpiresAt || job.artifactExpiresAt <= new Date();
  if (!due && job.status !== "superseded") return;
  if (job.objectKey) await deleteExportObject(job.objectKey).catch(() => undefined);
  await db
    .update(exportJob)
    .set({
      status: job.status === "superseded" ? "superseded" : "expired",
      snapshotJson: { expired: true },
      objectKey: null,
      archiveSha256: null,
      sizeBytes: null,
      updatedAt: new Date(),
    })
    .where(eq(exportJob.id, job.id));
}
