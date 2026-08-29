import { createHash } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getDb, type Db } from "@/server/db/client";
import {
  appUser,
  duty,
  evidenceDuty,
  evidenceItem,
  evidenceObjective,
  evidenceRevision,
  evidenceType,
  noticeAcknowledgement,
  provenanceType,
} from "@/server/db/schema";
import { appendAudit } from "@/server/audit/audit";
import { canonicalJson } from "@/server/audit/hashChain";
import type { Actor } from "@/server/policy/actor";
import {
  canCreateEvidence,
  canEditEvidence,
  canReadEvidence,
  type Decision,
  type EnrolmentContext,
  type EvidenceContext,
} from "@/server/policy/policy";
import { loadEnrolmentContext } from "@/server/framework/queries";
import {
  emptyNarrativeDoc,
  validateNarrativeDoc,
  type NarrativeDoc,
} from "./narrativeDoc";
import type { Envelope } from "@/lib/crypto/envelope";

// End-to-end encrypted content (ADR-007): the server stores these envelopes
// and never has a key that opens them. When `encrypted` is true the
// plaintext columns are empty (database CHECK constraint).
export interface ContentEnc {
  title: Envelope;
  narrative: Envelope;
}

// Evidence services: the single mutation path for evidence rows. Every write
// happens in a transaction that also appends audit; revisions are append-only
// snapshots created on material change (FR-EV-012), not on every autosave.

export interface EvidenceRow extends EvidenceContext {
  title: string;
  activityDate: string | null;
  activityEndedOn: string | null;
  evidenceTypeId: string | null;
  narrativeDoc: NarrativeDoc;
  narrativeText: string;
  encrypted: boolean;
  contentEnc: ContentEnc | null;
  typeFieldsJson: Record<string, unknown> | null;
  provenanceId: string | null;
  reviewRequestedAt: Date | null;
  lastReviewedAt: Date | null;
  currentRevisionId: string | null;
  rowVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export async function loadEvidence(
  tenantId: string,
  evidenceId: string,
): Promise<EvidenceRow | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(evidenceItem)
    // Tenant filter first — cross-tenant ids resolve to nothing.
    .where(and(eq(evidenceItem.tenantId, tenantId), eq(evidenceItem.id, evidenceId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenantId,
    enrolmentId: row.enrolmentId,
    authorUserId: row.authorUserId,
    visibility: row.visibility,
    workflowState: row.workflowState,
    deletedAt: row.deletedAt,
    archivedAt: row.archivedAt,
    title: row.title,
    activityDate: row.activityDate,
    activityEndedOn: row.activityEndedOn,
    evidenceTypeId: row.evidenceTypeId,
    narrativeDoc: row.narrativeDoc as NarrativeDoc,
    narrativeText: row.narrativeText,
    encrypted: row.encrypted,
    contentEnc: (row.contentEnc as ContentEnc | null) ?? null,
    typeFieldsJson: (row.typeFieldsJson as Record<string, unknown> | null) ?? null,
    provenanceId: row.provenanceId,
    reviewRequestedAt: row.reviewRequestedAt,
    lastReviewedAt: row.lastReviewedAt,
    currentRevisionId: row.currentRevisionId,
    rowVersion: row.rowVersion,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export interface EvidenceAccess {
  evidence: EvidenceRow;
  enrolment: EnrolmentContext & { frameworkReleaseId: string | null };
  decision: Decision;
}

export async function getEvidenceWithAccess(
  actor: Actor,
  tenantId: string,
  evidenceId: string,
): Promise<EvidenceAccess | null> {
  const evidence = await loadEvidence(tenantId, evidenceId);
  if (!evidence) return null;
  const enrolment = await loadEnrolmentContext(tenantId, evidence.enrolmentId);
  if (!enrolment) return null;
  const decision = canReadEvidence(actor, evidence, enrolment);
  return { evidence, enrolment, decision };
}

export interface CreateEvidenceInput {
  id?: string;
  title?: string;
  activityDate?: string | null;
  evidenceTypeId?: string | null;
  narrativeDoc?: unknown;
  contentEnc?: ContentEnc;
  reflectionAcknowledged?: boolean;
  requestId?: string | null;
}

export async function createEvidence(
  actor: Actor,
  enrolment: EnrolmentContext,
  input: CreateEvidenceInput,
): Promise<{ id: string; rowVersion: number } | { error: "denied" | "invalid"; issues?: string[] }> {
  const decision = canCreateEvidence(actor, enrolment);
  if (!decision.allow) return { error: "denied" };

  // Sealed entries carry no plaintext at all; plaintext entries need a title.
  const sealed = input.contentEnc ?? null;
  if (sealed && (input.title || input.narrativeDoc !== undefined)) {
    return { error: "invalid", issues: ["A sealed entry cannot also carry plaintext."] };
  }
  if (!sealed && !input.title?.trim()) {
    return { error: "invalid", issues: ["Title is required."] };
  }
  const narrative = validateNarrativeDoc(
    sealed ? emptyNarrativeDoc() : (input.narrativeDoc ?? { type: "doc", content: [{ type: "paragraph" }] }),
  );
  if (!narrative.valid || !narrative.doc) return { error: "invalid", issues: narrative.issues };

  const db = getDb();
  const id = input.id ?? uuidv7();
  await db.transaction(async (tx) => {
    await tx.insert(evidenceItem).values({
      id,
      tenantId: enrolment.tenantId,
      enrolmentId: enrolment.id,
      authorUserId: actor.userId,
      title: sealed ? "" : input.title!.trim(),
      activityDate: input.activityDate ?? null,
      evidenceTypeId: input.evidenceTypeId ?? null,
      narrativeDoc: narrative.doc,
      narrativeText: sealed ? "" : narrative.plainText,
      encrypted: Boolean(sealed),
      contentEnc: sealed,
      // Private by default, always (ADR-002).
      visibility: "private",
      workflowState: "draft",
      createdBy: actor.userId,
      updatedBy: actor.userId,
    });
    await createRevision(tx, {
      evidenceItemId: id,
      actorUserId: actor.userId,
      changeReason: "created",
    });
    await appendAudit(tx, {
      tenantId: enrolment.tenantId,
      actorUserId: actor.userId,
      action: "evidence.created",
      targetType: "evidence_item",
      targetId: id,
      enrolmentId: enrolment.id,
      requestId: input.requestId ?? null,
      metadata: {
        ...(input.evidenceTypeId ? { evidenceTypeId: input.evidenceTypeId } : {}),
        sealed: Boolean(sealed),
      },
    });

    // Reflection safety acknowledgement (FR-EV-008): a behavioral safeguard,
    // recorded as a notice receipt.
    if (input.reflectionAcknowledged) {
      await tx.insert(noticeAcknowledgement).values({
        id: uuidv7(),
        tenantId: enrolment.tenantId,
        userId: actor.userId,
        noticeType: "reflection_safety",
        noticeVersion: "2026-08",
        context: `evidence:${id}`,
      });
    }
  });
  return { id, rowVersion: 1 };
}

export interface UpdateEvidencePatch {
  title?: string;
  activityDate?: string | null;
  activityEndedOn?: string | null;
  evidenceTypeId?: string | null;
  narrativeDoc?: unknown;
  contentEnc?: ContentEnc;
  typeFieldsJson?: Record<string, unknown> | null;
  provenanceId?: string | null;
}

export type UpdateResult =
  | { ok: true; rowVersion: number; savedAt: Date }
  | { ok: false; error: "denied" | "invalid" | "conflict"; issues?: string[]; current?: { rowVersion: number; savedAt: Date; savedByName: string | null } };

// Material-revision window: plain autosaves within this window update the
// live row only; the first save after the window snapshots a revision.
const REVISION_WINDOW_MINUTES = 30;

export async function updateEvidence(
  actor: Actor,
  access: EvidenceAccess,
  patch: UpdateEvidencePatch,
  ifMatchRowVersion: number,
  options: { explicitSave?: boolean; requestId?: string | null } = {},
): Promise<UpdateResult> {
  const { evidence, enrolment } = access;
  const decision = canEditEvidence(actor, evidence, enrolment);
  if (!decision.allow) return { ok: false, error: "denied" };

  const changedFields: string[] = [];
  const values: Record<string, unknown> = {};

  // Once sealed, an entry never accepts plaintext again — a client bug must
  // not be able to leak content into the plaintext columns (ADR-007).
  if (evidence.encrypted && (patch.title !== undefined || patch.narrativeDoc !== undefined)) {
    return { ok: false, error: "invalid", issues: ["This entry is sealed; send contentEnc."] };
  }
  if (patch.contentEnc !== undefined) {
    values.contentEnc = patch.contentEnc;
    values.encrypted = true;
    values.title = "";
    values.narrativeDoc = emptyNarrativeDoc();
    values.narrativeText = "";
    changedFields.push(evidence.encrypted ? "content_enc" : "sealed");
  }

  if (!patch.contentEnc && patch.title !== undefined && patch.title !== evidence.title) {
    values.title = patch.title;
    changedFields.push("title");
  }
  if (patch.activityDate !== undefined && patch.activityDate !== evidence.activityDate) {
    values.activityDate = patch.activityDate;
    changedFields.push("activity_date");
  }
  if (
    patch.activityEndedOn !== undefined &&
    patch.activityEndedOn !== evidence.activityEndedOn
  ) {
    values.activityEndedOn = patch.activityEndedOn;
    changedFields.push("activity_ended_on");
  }
  if (patch.evidenceTypeId !== undefined && patch.evidenceTypeId !== evidence.evidenceTypeId) {
    values.evidenceTypeId = patch.evidenceTypeId;
    changedFields.push("evidence_type_id");
  }
  if (patch.provenanceId !== undefined && patch.provenanceId !== evidence.provenanceId) {
    values.provenanceId = patch.provenanceId;
    changedFields.push("provenance_id");
  }
  if (patch.typeFieldsJson !== undefined) {
    values.typeFieldsJson = patch.typeFieldsJson;
    changedFields.push("type_fields_json");
  }
  if (!patch.contentEnc && patch.narrativeDoc !== undefined) {
    const narrative = validateNarrativeDoc(patch.narrativeDoc);
    if (!narrative.valid || !narrative.doc) {
      return { ok: false, error: "invalid", issues: narrative.issues };
    }
    values.narrativeDoc = narrative.doc;
    values.narrativeText = narrative.plainText;
    changedFields.push("narrative_doc");
  }

  if (changedFields.length === 0) {
    return { ok: true, rowVersion: evidence.rowVersion, savedAt: evidence.updatedAt };
  }

  const db = getDb();
  const savedAt = new Date();
  return db.transaction(async (tx) => {
    // Optimistic concurrency: zero rows updated -> someone else saved first
    // (FR-EV-007, AC-04). Never last-write-wins.
    const updated = await tx
      .update(evidenceItem)
      .set({ ...values, updatedAt: savedAt, updatedBy: actor.userId, rowVersion: sql`${evidenceItem.rowVersion} + 1` })
      .where(
        and(
          eq(evidenceItem.id, evidence.id),
          eq(evidenceItem.tenantId, evidence.tenantId),
          eq(evidenceItem.rowVersion, ifMatchRowVersion),
        ),
      )
      .returning({ rowVersion: evidenceItem.rowVersion });

    if (updated.length === 0) {
      const current = await tx
        .select({
          rowVersion: evidenceItem.rowVersion,
          updatedAt: evidenceItem.updatedAt,
          savedByName: appUser.displayName,
        })
        .from(evidenceItem)
        .leftJoin(appUser, eq(evidenceItem.updatedBy, appUser.id))
        .where(eq(evidenceItem.id, evidence.id))
        .limit(1);
      return {
        ok: false,
        error: "conflict" as const,
        current: current[0]
          ? {
              rowVersion: current[0].rowVersion,
              savedAt: current[0].updatedAt,
              savedByName: current[0].savedByName,
            }
          : undefined,
      };
    }

    // Material-revision policy (FR-EV-012): explicit saves always snapshot;
    // autosaves snapshot only after the window since the head revision.
    let shouldSnapshot = options.explicitSave === true;
    if (!shouldSnapshot) {
      const head = await tx
        .select({ createdAt: evidenceRevision.createdAt })
        .from(evidenceRevision)
        .where(eq(evidenceRevision.evidenceItemId, evidence.id))
        .orderBy(desc(evidenceRevision.revisionNumber))
        .limit(1);
      const headAt = head[0]?.createdAt?.getTime() ?? 0;
      shouldSnapshot = savedAt.getTime() - headAt > REVISION_WINDOW_MINUTES * 60 * 1000;
    }
    if (shouldSnapshot) {
      await createRevision(tx, {
        evidenceItemId: evidence.id,
        actorUserId: actor.userId,
        changeReason: options.explicitSave ? "saved" : "autosave_window",
        changedFields,
      });
    }

    await appendAudit(tx, {
      tenantId: evidence.tenantId,
      actorUserId: actor.userId,
      action: "evidence.updated",
      targetType: "evidence_item",
      targetId: evidence.id,
      enrolmentId: evidence.enrolmentId,
      requestId: options.requestId ?? null,
      // Field names only — never content (spec/05).
      metadata: { changedFields },
    });

    return { ok: true, rowVersion: updated[0]!.rowVersion, savedAt };
  });
}

// Snapshot the full current item (fields + narrative + mappings) as an
// append-only revision.
async function createRevision(
  tx: Db,
  input: {
    evidenceItemId: string;
    actorUserId: string;
    changeReason: string;
    changedFields?: string[];
    snapshotOverride?: Record<string, unknown>;
  },
): Promise<string> {
  const rows = await tx
    .select()
    .from(evidenceItem)
    .where(eq(evidenceItem.id, input.evidenceItemId))
    .limit(1);
  const item = rows[0];
  if (!item) throw new Error("evidence item disappeared during revision");

  const objectives = await tx
    .select({ objectiveId: evidenceObjective.objectiveId })
    .from(evidenceObjective)
    .where(
      and(
        eq(evidenceObjective.evidenceItemId, input.evidenceItemId),
        isNull(evidenceObjective.validTo),
      ),
    );
  const duties = await tx
    .select({ dutyId: evidenceDuty.dutyId })
    .from(evidenceDuty)
    .where(eq(evidenceDuty.evidenceItemId, input.evidenceItemId));

  const snapshot = input.snapshotOverride ?? {
    title: item.title,
    activityDate: item.activityDate,
    activityEndedOn: item.activityEndedOn,
    evidenceTypeId: item.evidenceTypeId,
    narrativeDoc: item.narrativeDoc,
    // Sealed entries snapshot ciphertext only (ADR-007).
    encrypted: item.encrypted,
    contentEnc: item.contentEnc,
    typeFieldsJson: item.typeFieldsJson,
    provenanceId: item.provenanceId,
    objectiveIds: objectives.map((o) => o.objectiveId).sort(),
    dutyIds: duties.map((d) => d.dutyId).sort(),
  };

  const next = await tx.execute(sql`
    SELECT coalesce(max(revision_number), 0) + 1 AS next
    FROM evidence_revision WHERE evidence_item_id = ${input.evidenceItemId}
  `);
  const revisionNumber = Number(next.rows[0]?.next ?? 1);
  const revisionId = uuidv7();

  await tx.insert(evidenceRevision).values({
    id: revisionId,
    evidenceItemId: input.evidenceItemId,
    revisionNumber,
    snapshotJson: snapshot,
    changedFields: input.changedFields ?? null,
    changeReason: input.changeReason,
    contentSha256: createHash("sha256").update(canonicalJson(snapshot)).digest("hex"),
    createdBy: input.actorUserId,
  });
  await tx
    .update(evidenceItem)
    .set({ currentRevisionId: revisionId })
    .where(eq(evidenceItem.id, input.evidenceItemId));
  return revisionId;
}

// Conflict backup: the losing tab's unsaved body is preserved server-side as
// an explicit revision so no words are lost (AC-04).
export async function createConflictBackup(
  actor: Actor,
  access: EvidenceAccess,
  unsavedSnapshot: Record<string, unknown>,
  requestId: string | null,
): Promise<{ ok: boolean }> {
  const decision = canEditEvidence(actor, access.evidence, access.enrolment);
  if (!decision.allow) return { ok: false };
  const db = getDb();
  await db.transaction(async (tx) => {
    await createRevision(tx, {
      evidenceItemId: access.evidence.id,
      actorUserId: actor.userId,
      changeReason: "conflict_backup",
      snapshotOverride: unsavedSnapshot,
    });
    await appendAudit(tx, {
      tenantId: access.evidence.tenantId,
      actorUserId: actor.userId,
      action: "evidence.revision_created",
      targetType: "evidence_item",
      targetId: access.evidence.id,
      enrolmentId: access.evidence.enrolmentId,
      requestId,
      metadata: { changeReason: "conflict_backup" },
    });
  });
  return { ok: true };
}

export async function archiveEvidence(
  actor: Actor,
  access: EvidenceAccess,
  requestId: string | null,
): Promise<boolean> {
  const decision = canEditEvidence(actor, access.evidence, access.enrolment);
  if (!decision.allow) return false;
  const db = getDb();
  const changedAt = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(evidenceItem)
      .set({
        archivedAt: changedAt,
        updatedAt: changedAt,
        updatedBy: actor.userId,
        rowVersion: sql`${evidenceItem.rowVersion} + 1`,
      })
      .where(eq(evidenceItem.id, access.evidence.id));
    await appendAudit(tx, {
      tenantId: access.evidence.tenantId,
      actorUserId: actor.userId,
      action: "evidence.archived",
      targetType: "evidence_item",
      targetId: access.evidence.id,
      enrolmentId: access.evidence.enrolmentId,
      requestId,
    });
  });
  return true;
}

export async function restoreEvidence(
  actor: Actor,
  access: EvidenceAccess,
  requestId: string | null,
): Promise<boolean> {
  const { evidence, enrolment } = access;
  // Restore applies to archived or grace-period-deleted items the author owns.
  if (evidence.authorUserId !== actor.userId) return false;
  if (!enrolment.fellowUserId || enrolment.fellowUserId !== actor.userId) return false;
  if (enrolment.diaryState !== "open") return false;
  const db = getDb();
  const changedAt = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(evidenceItem)
      .set({
        archivedAt: null,
        deletedAt: null,
        deletionDueAt: null,
        updatedAt: changedAt,
        updatedBy: actor.userId,
        rowVersion: sql`${evidenceItem.rowVersion} + 1`,
      })
      .where(eq(evidenceItem.id, evidence.id));
    await appendAudit(tx, {
      tenantId: evidence.tenantId,
      actorUserId: actor.userId,
      action: "evidence.restored",
      targetType: "evidence_item",
      targetId: evidence.id,
      enrolmentId: evidence.enrolmentId,
      requestId,
    });
  });
  return true;
}

const DELETION_GRACE_DAYS = 30;

export async function softDeleteEvidence(
  actor: Actor,
  access: EvidenceAccess,
  requestId: string | null,
): Promise<boolean> {
  const decision = canEditEvidence(actor, access.evidence, access.enrolment);
  if (!decision.allow) return false;
  const db = getDb();
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(evidenceItem)
      .set({
        deletedAt: now,
        deletionDueAt: new Date(now.getTime() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000),
        updatedAt: now,
        updatedBy: actor.userId,
        rowVersion: sql`${evidenceItem.rowVersion} + 1`,
      })
      .where(eq(evidenceItem.id, access.evidence.id));
    await appendAudit(tx, {
      tenantId: access.evidence.tenantId,
      actorUserId: actor.userId,
      action: "evidence.deleted",
      targetType: "evidence_item",
      targetId: access.evidence.id,
      enrolmentId: access.evidence.enrolmentId,
      requestId,
      metadata: { graceDays: DELETION_GRACE_DAYS },
    });
  });
  return true;
}

// Replace the item's active objective mappings (FR-FW-006). The database
// trigger guarantees each objective belongs to the pinned release.
export async function setObjectives(
  actor: Actor,
  access: EvidenceAccess,
  objectiveIds: string[],
  requestId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const decision = canEditEvidence(actor, access.evidence, access.enrolment);
  if (!decision.allow) return { ok: false, error: "denied" };

  const db = getDb();
  try {
    await db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: evidenceObjective.id, objectiveId: evidenceObjective.objectiveId })
        .from(evidenceObjective)
        .where(
          and(
            eq(evidenceObjective.evidenceItemId, access.evidence.id),
            isNull(evidenceObjective.validTo),
          ),
        );
      const keep = new Set(objectiveIds);
      const current = new Set(existing.map((e) => e.objectiveId));

      const toEnd = existing.filter((e) => !keep.has(e.objectiveId));
      if (toEnd.length > 0) {
        await tx
          .update(evidenceObjective)
          .set({ validTo: new Date() })
          .where(
            inArray(
              evidenceObjective.id,
              toEnd.map((e) => e.id),
            ),
          );
      }
      for (const objectiveId of objectiveIds) {
        if (!current.has(objectiveId)) {
          await tx.insert(evidenceObjective).values({
            id: uuidv7(),
            evidenceItemId: access.evidence.id,
            objectiveId,
            mappedBy: actor.userId,
          });
        }
      }
      await appendAudit(tx, {
        tenantId: access.evidence.tenantId,
        actorUserId: actor.userId,
        action: "evidence.updated",
        targetType: "evidence_item",
        targetId: access.evidence.id,
        enrolmentId: access.evidence.enrolmentId,
        requestId,
        metadata: { changedFields: ["objective_mappings"], count: objectiveIds.length },
      });
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message.slice(0, 200) };
  }
}

export async function setDuties(
  actor: Actor,
  access: EvidenceAccess,
  dutyIds: string[],
  requestId: string | null,
): Promise<{ ok: boolean }> {
  const decision = canEditEvidence(actor, access.evidence, access.enrolment);
  if (!decision.allow) return { ok: false };

  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.delete(evidenceDuty).where(eq(evidenceDuty.evidenceItemId, access.evidence.id));
    for (const dutyId of dutyIds) {
      await tx.insert(evidenceDuty).values({
        id: uuidv7(),
        evidenceItemId: access.evidence.id,
        dutyId,
        taggedBy: actor.userId,
      });
    }
    await appendAudit(tx, {
      tenantId: access.evidence.tenantId,
      actorUserId: actor.userId,
      action: "evidence.updated",
      targetType: "evidence_item",
      targetId: access.evidence.id,
      enrolmentId: access.evidence.enrolmentId,
      requestId,
      metadata: { changedFields: ["duty_tags"], count: dutyIds.length },
    });
  });
  return { ok: true };
}

// Diary lists are author-only. Keeping this predicate centralized prevents a
// new list/count view from accidentally inheriting staff enrolment access.
export function visibleEvidencePredicate(actor: Actor, enrolment: EnrolmentContext) {
  const isOwner = enrolment.fellowUserId === actor.userId;
  if (isOwner) {
    return and(eq(evidenceItem.enrolmentId, enrolment.id), isNull(evidenceItem.deletedAt));
  }
  return sql`false`;
}

export interface EvidenceListRow {
  id: string;
  title: string;
  encrypted: boolean;
  titleEnc: Envelope | null;
  activityDate: string | null;
  archivedAt: Date | null;
  typeLabel: string;
  typeCode: string;
  objectiveCount: number;
  updatedAt: Date;
}

export async function listEvidence(
  actor: Actor,
  enrolment: EnrolmentContext,
): Promise<EvidenceListRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: evidenceItem.id,
      title: evidenceItem.title,
      encrypted: evidenceItem.encrypted,
      contentEnc: evidenceItem.contentEnc,
      activityDate: evidenceItem.activityDate,
      archivedAt: evidenceItem.archivedAt,
      typeLabel: evidenceType.label,
      typeCode: evidenceType.stableCode,
      updatedAt: evidenceItem.updatedAt,
    })
    .from(evidenceItem)
    .leftJoin(evidenceType, eq(evidenceItem.evidenceTypeId, evidenceType.id))
    .where(visibleEvidencePredicate(actor, enrolment))
    .orderBy(desc(evidenceItem.activityDate), desc(evidenceItem.createdAt));

  if (rows.length === 0) return [];
  const counts = await db
    .select({
      evidenceItemId: evidenceObjective.evidenceItemId,
      count: sql<number>`count(*)::int`,
    })
    .from(evidenceObjective)
    .where(
      and(
        inArray(
          evidenceObjective.evidenceItemId,
          rows.map((r) => r.id),
        ),
        isNull(evidenceObjective.validTo),
      ),
    )
    .groupBy(evidenceObjective.evidenceItemId);
  const countById = new Map(counts.map((c) => [c.evidenceItemId, c.count]));
  return rows.map(({ contentEnc, ...row }) => ({
    ...row,
    titleEnc: row.encrypted ? ((contentEnc as ContentEnc | null)?.title ?? null) : null,
    typeLabel: row.typeLabel ?? "Diary entry",
    typeCode: row.typeCode ?? "entry",
    objectiveCount: countById.get(row.id) ?? 0,
  }));
}

// Reference data for the editor.
export async function getEvidenceFormOptions(tenantId: string, programmeId: string) {
  const db = getDb();
  const types = await db
    .select({
      id: evidenceType.id,
      stableCode: evidenceType.stableCode,
      label: evidenceType.label,
      description: evidenceType.description,
      fieldsSchemaJson: evidenceType.fieldsSchemaJson,
    })
    .from(evidenceType)
    .where(
      and(
        sql`(${evidenceType.tenantId} IS NULL OR ${evidenceType.tenantId} = ${tenantId})`,
        eq(evidenceType.active, true),
      ),
    )
    .orderBy(asc(evidenceType.stableCode));
  const provenances = await db
    .select({ id: provenanceType.id, stableCode: provenanceType.stableCode, label: provenanceType.label })
    .from(provenanceType)
    .where(
      and(
        sql`(${provenanceType.tenantId} IS NULL OR ${provenanceType.tenantId} = ${tenantId})`,
        eq(provenanceType.active, true),
      ),
    );
  const duties = await db
    .select({ id: duty.id, stableCode: duty.stableCode, label: duty.label, description: duty.description })
    .from(duty)
    .where(and(eq(duty.programmeId, programmeId), eq(duty.active, true)))
    .orderBy(asc(duty.sortOrder));
  return { types, provenances, duties };
}

export async function getActiveObjectiveIds(evidenceId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ objectiveId: evidenceObjective.objectiveId })
    .from(evidenceObjective)
    .where(and(eq(evidenceObjective.evidenceItemId, evidenceId), isNull(evidenceObjective.validTo)));
  return rows.map((r) => r.objectiveId);
}

export async function getActiveDutyIds(evidenceId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ dutyId: evidenceDuty.dutyId })
    .from(evidenceDuty)
    .where(eq(evidenceDuty.evidenceItemId, evidenceId));
  return rows.map((r) => r.dutyId);
}

export interface RevisionListRow {
  revisionNumber: number;
  changeReason: string | null;
  changedFields: string[] | null;
  createdAt: Date;
  createdByName: string | null;
  contentSha256: string;
}

export async function listRevisions(
  actor: Actor,
  access: EvidenceAccess,
): Promise<RevisionListRow[] | null> {
  // Revision history is part of the item detail; same read decision applies.
  if (!access.decision.allow) return null;
  const db = getDb();
  const rows = await db
    .select({
      revisionNumber: evidenceRevision.revisionNumber,
      changeReason: evidenceRevision.changeReason,
      changedFields: evidenceRevision.changedFields,
      createdAt: evidenceRevision.createdAt,
      createdByName: appUser.displayName,
      contentSha256: evidenceRevision.contentSha256,
    })
    .from(evidenceRevision)
    .leftJoin(appUser, eq(evidenceRevision.createdBy, appUser.id))
    .where(eq(evidenceRevision.evidenceItemId, access.evidence.id))
    .orderBy(desc(evidenceRevision.revisionNumber));
  return rows.map((r) => ({ ...r, changedFields: (r.changedFields as string[] | null) ?? null }));
}

// Coverage per domain for the curriculum view: counts only evidence the
// viewer can already see (Q-12: private counts are not shown to others).
export async function getObjectiveCoverage(
  actor: Actor,
  enrolment: EnrolmentContext,
): Promise<Map<string, number>> {
  const db = getDb();
  const rows = await db
    .select({
      objectiveId: evidenceObjective.objectiveId,
      count: sql<number>`count(distinct ${evidenceObjective.evidenceItemId})::int`,
    })
    .from(evidenceObjective)
    .innerJoin(evidenceItem, eq(evidenceObjective.evidenceItemId, evidenceItem.id))
    .where(and(visibleEvidencePredicate(actor, enrolment), isNull(evidenceObjective.validTo)))
    .groupBy(evidenceObjective.objectiveId);
  return new Map(rows.map((r) => [r.objectiveId, r.count]));
}

export async function listEvidenceForObjective(
  actor: Actor,
  enrolment: EnrolmentContext,
  objectiveId: string,
): Promise<
  Array<{
    id: string;
    title: string;
    encrypted: boolean;
    titleEnc: Envelope | null;
    activityDate: string | null;
    mappingNote: string | null;
  }>
> {
  const db = getDb();
  const rows = await db
    .select({
      id: evidenceItem.id,
      title: evidenceItem.title,
      encrypted: evidenceItem.encrypted,
      contentEnc: evidenceItem.contentEnc,
      activityDate: evidenceItem.activityDate,
      mappingNote: evidenceObjective.mappingNote,
    })
    .from(evidenceObjective)
    .innerJoin(evidenceItem, eq(evidenceObjective.evidenceItemId, evidenceItem.id))
    .where(
      and(
        visibleEvidencePredicate(actor, enrolment),
        eq(evidenceObjective.objectiveId, objectiveId),
        isNull(evidenceObjective.validTo),
      ),
    )
    .orderBy(desc(evidenceItem.activityDate));
  return rows.map(({ contentEnc, ...row }) => ({
    ...row,
    titleEnc: row.encrypted ? ((contentEnc as ContentEnc | null)?.title ?? null) : null,
  }));
}
