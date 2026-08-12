import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { attachment } from "@/server/db/schema";
import { appendAudit } from "@/server/audit/audit";
import type { OutboxPayloads } from "@/server/outbox/outbox";
import { clamdVersion, scanStream } from "@/server/files/clamd";
import {
  deleteQuarantineObject,
  getQuarantineStream,
  headQuarantineObject,
  promoteToClean,
} from "@/server/files/s3";
import {
  BINARY_EXPECTATIONS,
  isValidTextContent,
  MAX_FILE_BYTES,
  TEXT_EXTENSIONS,
} from "@/server/files/uploadPolicy";

// Scan pipeline (spec/07 steps 5-6): magic-byte type detection + OOXML zip
// inspection + clamd INSTREAM. Only `clean` files ever become downloadable;
// any failure leaves the file pending (safe) or quarantined (final).

export async function handleScanAttachment(
  payload: OutboxPayloads["scan_attachment"],
): Promise<void> {
  const db = getDb();
  const rows = await db
    .select()
    .from(attachment)
    .where(eq(attachment.id, payload.attachmentId))
    .limit(1);
  const row = rows[0];
  if (!row || row.scanStatus !== "pending_scan") return;

  // Verify the object landed and respects the size limit.
  const head = await headQuarantineObject(row.objectKey);
  const actualSize = head.ContentLength ?? 0;
  if (actualSize <= 0 || actualSize > MAX_FILE_BYTES) {
    await finalise(payload, row.objectKey, "rejected", {
      reason: "size_mismatch",
      detected: null,
      engine: null,
    });
    return;
  }

  // Load the object once (25 MB cap makes buffering acceptable at pilot scale).
  const stream = await getQuarantineStream(row.objectKey);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const buffer = Buffer.concat(chunks);

  const extension = row.originalFilename.split(".").pop()?.toLowerCase() ?? "";

  // 1. Content-type detection (extension AND detected type must agree).
  const { fileTypeFromBuffer } = await import("file-type");
  const detected = await fileTypeFromBuffer(buffer);
  let mediaTypeDetected: string | null = detected?.mime ?? null;

  let typeOk = false;
  if (TEXT_EXTENSIONS.has(extension)) {
    // No magic bytes: must be valid UTF-8 without NUL bytes, and file-type
    // must NOT have detected some binary format hiding under a .txt name.
    typeOk = !detected && isValidTextContent(buffer);
    if (typeOk) {
      mediaTypeDetected = extension === "csv" ? "text/csv" : extension === "md" ? "text/markdown" : "text/plain";
    }
  } else {
    const expected = BINARY_EXPECTATIONS[extension] ?? [];
    typeOk = detected !== undefined && expected.includes(detected.mime);
    // OOXML nuance: a detected bare zip claiming docx/pptx must contain
    // [Content_Types].xml and no macro project (risk #2).
    if (typeOk && detected!.mime === "application/zip") {
      const inspection = inspectOoxmlZip(buffer);
      typeOk = inspection.isOoxml && !inspection.hasMacros;
      if (typeOk) {
        mediaTypeDetected =
          extension === "docx"
            ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            : "application/vnd.openxmlformats-officedocument.presentationml.presentation";
      }
    }
    // Real OOXML detection can also carry macros — check those too.
    if (typeOk && detected!.mime.startsWith("application/vnd.openxmlformats")) {
      const inspection = inspectOoxmlZip(buffer);
      if (inspection.hasMacros) typeOk = false;
    }
  }

  if (!typeOk) {
    await finalise(payload, row.objectKey, "quarantined", {
      reason: "type_mismatch",
      detected: mediaTypeDetected,
      engine: null,
    });
    return;
  }

  // 2. Malware scan. Engine failure throws so the outbox retries with
  // backoff; the file stays pending_scan and is never downloadable
  // (NFR-A-005: scan outage blocks file sharing, text work continues).
  const { Readable } = await import("node:stream");
  const scan = await scanStream(Readable.from(buffer));
  if (scan.status === "error") {
    throw new Error(`clamd unavailable: ${scan.error}`);
  }

  if (scan.status === "infected") {
    await finalise(payload, row.objectKey, "quarantined", {
      reason: "malware_detected",
      detected: mediaTypeDetected,
      engine: await clamdVersion(),
      signature: scan.signature,
    });
    return;
  }

  // Clean: promote to the clean bucket and delete the quarantine copy.
  await promoteToClean(row.objectKey);
  const engine = await clamdVersion();
  await db.transaction(async (tx) => {
    await tx
      .update(attachment)
      .set({
        scanStatus: "clean",
        mediaTypeDetected,
        scanEngineVersion: engine,
        scanCompletedAt: new Date(),
      })
      .where(eq(attachment.id, payload.attachmentId));
    await appendAudit(tx, {
      tenantId: payload.tenantId,
      actorType: "worker",
      action: "attachment.scan_result",
      targetType: "attachment",
      targetId: payload.attachmentId,
      metadata: { result: "clean", mediaTypeDetected },
    });
  });
}

async function finalise(
  payload: OutboxPayloads["scan_attachment"],
  objectKey: string,
  status: "rejected" | "quarantined",
  meta: { reason: string; detected: string | null; engine: string | null; signature?: string },
): Promise<void> {
  const db = getDb();
  // Quarantined/rejected objects are removed from storage; the row records
  // the outcome (failed files must never be downloadable, FR-FI-002).
  await deleteQuarantineObject(objectKey).catch(() => undefined);
  await db.transaction(async (tx) => {
    await tx
      .update(attachment)
      .set({
        scanStatus: status,
        mediaTypeDetected: meta.detected,
        scanEngineVersion: meta.engine,
        scanCompletedAt: new Date(),
      })
      .where(eq(attachment.id, payload.attachmentId));
    await appendAudit(tx, {
      tenantId: payload.tenantId,
      actorType: "worker",
      action: "attachment.scan_result",
      targetType: "attachment",
      targetId: payload.attachmentId,
      outcome: "denied",
      reasonCode: meta.reason,
      metadata: { result: status, signature: meta.signature ?? null },
    });
  });
}

// Minimal OOXML zip inspection: look for [Content_Types].xml and vbaProject
// entries in the central directory (names appear as raw bytes in the file).
function inspectOoxmlZip(buffer: Buffer): { isOoxml: boolean; hasMacros: boolean } {
  const haystack = buffer.toString("latin1");
  return {
    isOoxml: haystack.includes("[Content_Types].xml"),
    hasMacros: haystack.includes("vbaProject.bin") || haystack.includes("vbaData.xml"),
  };
}
