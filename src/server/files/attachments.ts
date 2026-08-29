import { and, eq, isNull, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getDb } from "@/server/db/client";
import { attachment } from "@/server/db/schema";
import { appendAudit } from "@/server/audit/audit";
import { enqueue } from "@/server/outbox/outbox";
import type { Actor } from "@/server/policy/actor";
import {
  canDownloadAttachment,
  canEditEvidence,
  canReadEvidence,
} from "@/server/policy/policy";
import type { EvidenceAccess } from "@/server/portfolio/evidence";
import { checkInitiate, MAX_FILE_BYTES, MAX_FILES_PER_ITEM } from "./uploadPolicy";
import { presignCleanDownload, presignQuarantineUpload } from "./s3";
import { SEALED_FILE_OVERHEAD_BYTES, type Envelope } from "@/lib/crypto/envelope";

// Upload pipeline (spec/07:72-84): initiate -> direct browser upload to the
// quarantine bucket -> complete -> outbox scan -> clean/quarantined.
// Object keys are opaque: {tenantId}/attachment/{attachmentId} — never a
// user filename (spec/05:256).

export async function initiateUpload(
  actor: Actor,
  access: EvidenceAccess,
  input: {
    filename: string;
    mediaTypeClaimed: string;
    sizeBytes: number;
    attachmentId?: string;
    encrypted?: boolean;
    nameEnc?: Envelope;
  },
  requestId: string | null,
): Promise<
  | { ok: true; attachmentId: string; upload: { url: string; fields: Record<string, string> } }
  | { ok: false; reason: string }
> {
  if (!canEditEvidence(actor, access.evidence, access.enrolment).allow) {
    return { ok: false, reason: "denied" };
  }

  const db = getDb();
  const existing = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(attachment)
    .where(
      and(
        eq(attachment.parentType, "evidence_item"),
        eq(attachment.parentId, access.evidence.id),
        isNull(attachment.deletedAt),
      ),
    );
  const existingCount = existing[0]?.count ?? 0;

  const sealed = input.encrypted === true;
  if (sealed) {
    // Sealed upload (ADR-007): the browser applied the type allowlist before
    // encrypting; the server can only check what it can see.
    if (!input.nameEnc) return { ok: false, reason: "Sealed uploads need the sealed file name." };
    if (input.filename !== "sealed" || input.mediaTypeClaimed !== "application/octet-stream") {
      return { ok: false, reason: "A sealed upload must not carry a plaintext file name." };
    }
    if (input.sizeBytes <= SEALED_FILE_OVERHEAD_BYTES) return { ok: false, reason: "Empty files are not accepted." };
    if (input.sizeBytes > MAX_FILE_BYTES + SEALED_FILE_OVERHEAD_BYTES) {
      return { ok: false, reason: "Files must be 25 MB or smaller." };
    }
    if (existingCount >= MAX_FILES_PER_ITEM) {
      return { ok: false, reason: `An entry can have at most ${MAX_FILES_PER_ITEM} files.` };
    }
  } else {
    const check = checkInitiate({ ...input, existingCount });
    if (!check.ok) return { ok: false, reason: check.reason! };
  }

  const attachmentId = input.attachmentId ?? uuidv7();
  const objectKey = `${access.evidence.tenantId}/attachment/${attachmentId}`;

  await db.transaction(async (tx) => {
    await tx.insert(attachment).values({
      id: attachmentId,
      tenantId: access.evidence.tenantId,
      parentType: "evidence_item",
      parentId: access.evidence.id,
      objectKey,
      originalFilename: sealed ? "sealed" : input.filename,
      displayName: sealed ? "sealed" : input.filename,
      mediaTypeClaimed: sealed ? "application/octet-stream" : input.mediaTypeClaimed,
      sizeBytes: input.sizeBytes,
      scanStatus: "awaiting_upload",
      encrypted: sealed,
      nameEnc: sealed ? input.nameEnc : null,
      createdBy: actor.userId,
      updatedBy: actor.userId,
    });
    await appendAudit(tx, {
      tenantId: access.evidence.tenantId,
      actorUserId: actor.userId,
      action: "attachment.initiated",
      targetType: "attachment",
      targetId: attachmentId,
      enrolmentId: access.evidence.enrolmentId,
      requestId,
      // Identifiers and sizes only — never the filename (log minimisation).
      metadata: { sizeBytes: input.sizeBytes, mediaTypeClaimed: input.mediaTypeClaimed, sealed },
    });
  });

  const upload = await presignQuarantineUpload(objectKey, input.sizeBytes);
  return { ok: true, attachmentId, upload };
}

export async function completeUpload(
  actor: Actor,
  access: EvidenceAccess,
  attachmentId: string,
  requestId: string | null,
): Promise<{ ok: boolean; reason?: string }> {
  if (!canEditEvidence(actor, access.evidence, access.enrolment).allow) {
    return { ok: false, reason: "denied" };
  }
  const db = getDb();
  const rows = await db
    .select()
    .from(attachment)
    .where(
      and(
        eq(attachment.id, attachmentId),
        eq(attachment.tenantId, access.evidence.tenantId),
        eq(attachment.parentId, access.evidence.id),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row || row.scanStatus !== "awaiting_upload") {
    return { ok: false, reason: "not_found" };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(attachment)
      .set({ scanStatus: "pending_scan", updatedBy: actor.userId })
      .where(eq(attachment.id, attachmentId));
    // Same-transaction outbox (NFR-S-004): the scan cannot be lost.
    await enqueue(tx, "scan_attachment", {
      attachmentId,
      tenantId: access.evidence.tenantId,
    });
    await appendAudit(tx, {
      tenantId: access.evidence.tenantId,
      actorUserId: actor.userId,
      action: "attachment.completed",
      targetType: "attachment",
      targetId: attachmentId,
      enrolmentId: access.evidence.enrolmentId,
      requestId,
    });
  });
  return { ok: true };
}

export async function issueDownload(
  actor: Actor,
  access: EvidenceAccess,
  attachmentId: string,
  requestId: string | null,
): Promise<
  | { ok: true; url: string; objectKey: string; sizeBytes: number; mediaType: string; displayName: string }
  // Sealed files are streamed through the app and decrypted in the browser.
  | { ok: true; sealed: true; objectKey: string; sizeBytes: number }
  | { ok: false }
> {
  const db = getDb();
  const rows = await db
    .select()
    .from(attachment)
    .where(
      and(
        eq(attachment.id, attachmentId),
        eq(attachment.tenantId, access.evidence.tenantId),
        eq(attachment.parentId, access.evidence.id),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return { ok: false };

  // Attachment inherits the parent's visibility exactly (spec/05 invariant 8);
  // only clean files are ever downloadable (FR-FI-002).
  const parentDecision = canReadEvidence(actor, access.evidence, access.enrolment);
  const decision = canDownloadAttachment(
    { tenantId: row.tenantId, parentType: row.parentType, scanStatus: row.scanStatus, deletedAt: row.deletedAt },
    parentDecision,
  );
  if (!decision.allow) return { ok: false };

  await appendAudit(getDb(), {
    tenantId: access.evidence.tenantId,
    actorUserId: actor.userId,
    action: "attachment.download_issued",
    targetType: "attachment",
    targetId: attachmentId,
    enrolmentId: access.evidence.enrolmentId,
    requestId,
    metadata: { sealed: row.encrypted },
  });
  if (row.encrypted) {
    return { ok: true, sealed: true, objectKey: row.objectKey, sizeBytes: row.sizeBytes };
  }
  const url = await presignCleanDownload(
    row.objectKey,
    row.displayName,
    row.mediaTypeDetected ?? "application/octet-stream",
  );
  return {
    ok: true,
    url,
    objectKey: row.objectKey,
    sizeBytes: row.sizeBytes,
    mediaType: row.mediaTypeDetected ?? "application/octet-stream",
    displayName: row.displayName,
  };
}

export async function softDeleteAttachment(
  actor: Actor,
  access: EvidenceAccess,
  attachmentId: string,
  requestId: string | null,
): Promise<boolean> {
  if (!canEditEvidence(actor, access.evidence, access.enrolment).allow) return false;
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .update(attachment)
      .set({ deletedAt: new Date(), updatedBy: actor.userId })
      .where(
        and(
          eq(attachment.id, attachmentId),
          eq(attachment.tenantId, access.evidence.tenantId),
          eq(attachment.parentId, access.evidence.id),
        ),
      );
    await appendAudit(tx, {
      tenantId: access.evidence.tenantId,
      actorUserId: actor.userId,
      action: "attachment.deleted",
      targetType: "attachment",
      targetId: attachmentId,
      enrolmentId: access.evidence.enrolmentId,
      requestId,
    });
  });
  return true;
}

export async function listAttachments(evidenceId: string, tenantId: string) {
  const db = getDb();
  return db
    .select({
      id: attachment.id,
      displayName: attachment.displayName,
      sizeBytes: attachment.sizeBytes,
      scanStatus: attachment.scanStatus,
      mediaTypeDetected: attachment.mediaTypeDetected,
      encrypted: attachment.encrypted,
      nameEnc: attachment.nameEnc,
      createdAt: attachment.createdAt,
    })
    .from(attachment)
    .where(
      and(
        eq(attachment.tenantId, tenantId),
        eq(attachment.parentType, "evidence_item"),
        eq(attachment.parentId, evidenceId),
        isNull(attachment.deletedAt),
      ),
    )
    .then((rows) => rows.map((row) => ({ ...row, nameEnc: (row.nameEnc as Envelope | null) ?? null })));
}
