import { sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import type { Db } from "@/server/db/client";
import { auditEvent } from "@/server/db/schema";
import { computeEventHash, GENESIS_HASH } from "./hashChain";

// Audit events append inside the same transaction as the mutation they
// describe (NFR-S-004). Call appendAudit as the LAST statement before commit
// to keep the per-tenant advisory lock hold time short.
//
// Metadata carries changed field names and identifiers only — never
// narrative content, comment text, filenames or secrets (spec/05).

export type AuditAction =
  | "auth.sign_in"
  | "auth.sign_in_failed"
  | "auth.sign_out"
  | "auth.session_rotated"
  | "invitation.created"
  | "invitation.accepted"
  | "invitation.revoked"
  | "membership.granted"
  | "membership.revoked"
  | "assignment.created"
  | "assignment.ended"
  | "enrolment.activated"
  | "enrolment.status_changed"
  | "framework.validated"
  | "framework.published"
  | "evidence.created"
  | "evidence.updated"
  | "evidence.visibility_changed"
  | "evidence.shared"
  | "evidence.archived"
  | "evidence.restored"
  | "evidence.deleted"
  | "evidence.revision_created"
  | "attachment.initiated"
  | "attachment.completed"
  | "attachment.scan_result"
  | "attachment.download_issued"
  | "attachment.deleted"
  | "link.added"
  | "link.removed"
  | "notice.acknowledged";

export interface AuditInput {
  tenantId: string;
  actorUserId?: string | null;
  actorType?: "user" | "system" | "worker";
  action: AuditAction;
  targetType: string;
  targetId?: string | null;
  enrolmentId?: string | null;
  requestId?: string | null;
  sourceContext?: string | null;
  outcome?: "success" | "denied" | "failure";
  reasonCode?: string | null;
  metadata?: Record<string, unknown> | null;
}

// tx is a drizzle transaction (or Db for standalone system events).
export async function appendAudit(tx: Db, input: AuditInput): Promise<void> {
  // Serialise appends per tenant so the chain never forks; the advisory lock
  // is transaction-scoped and released at commit.
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${"audit:" + input.tenantId}))`,
  );

  const previous = await tx.execute(
    sql`SELECT event_hash FROM audit_event WHERE tenant_id = ${input.tenantId} ORDER BY occurred_at DESC, id DESC LIMIT 1`,
  );
  const previousEventHash =
    (previous.rows[0]?.event_hash as string | undefined) ?? GENESIS_HASH;

  const occurredAt = new Date();
  const fields = {
    occurredAt: occurredAt.toISOString(),
    actorUserId: input.actorUserId ?? null,
    actorType: input.actorType ?? "user",
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    enrolmentId: input.enrolmentId ?? null,
    requestId: input.requestId ?? null,
    outcome: input.outcome ?? "success",
    reasonCode: input.reasonCode ?? null,
    metadata: input.metadata ?? null,
  };

  await tx.insert(auditEvent).values({
    id: uuidv7(),
    tenantId: input.tenantId,
    occurredAt,
    actorUserId: fields.actorUserId,
    actorType: fields.actorType,
    action: fields.action,
    targetType: fields.targetType,
    targetId: fields.targetId,
    enrolmentId: fields.enrolmentId,
    requestId: fields.requestId,
    sourceContext: input.sourceContext ?? null,
    outcome: fields.outcome,
    reasonCode: fields.reasonCode,
    metadataJson: fields.metadata,
    previousEventHash,
    eventHash: computeEventHash(fields, previousEventHash),
  });
}
