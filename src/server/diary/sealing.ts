import { and, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { getDb } from "@/server/db/client";
import { attachment, diaryKey, enrolment, evidenceItem, externalLink, tenant } from "@/server/db/schema";
import type { Actor } from "@/server/policy/actor";

// End-to-end encryption helpers (ADR-007) shared by lifecycle, export and
// the sealing migration endpoint.

// A diary is "sealed" once its owner has set up a diary key: from then on
// the server cannot produce a readable export or read any new content.
export async function isSealedDiary(db: Db, enrolmentId: string): Promise<boolean> {
  const rows = await db
    .select({ hasKey: sql<boolean>`(${diaryKey.userId} IS NOT NULL)` })
    .from(enrolment)
    .leftJoin(diaryKey, eq(diaryKey.userId, enrolment.fellowUserId))
    .where(eq(enrolment.id, enrolmentId))
    .limit(1);
  if (rows[0]?.hasKey) return true;
  const encrypted = await db
    .select({ id: evidenceItem.id })
    .from(evidenceItem)
    .where(and(eq(evidenceItem.enrolmentId, enrolmentId), eq(evidenceItem.encrypted, true)))
    .limit(1);
  return encrypted.length > 0;
}

export interface UnsealedInventory {
  entries: Array<{
    id: string;
    enrolmentId: string;
    tenantId: string;
    tenantSlug: string;
    title: string;
    narrativeDoc: unknown;
    activityDate: string | null;
    evidenceTypeId: string | null;
    rowVersion: number;
  }>;
  links: Array<{
    id: string;
    evidenceId: string;
    tenantSlug: string;
    url: string;
    host: string;
    label: string | null;
    linkType: string;
  }>;
  attachments: Array<{
    id: string;
    evidenceId: string;
    tenantSlug: string;
    displayName: string;
    mediaType: string;
    sizeBytes: number;
    scanStatus: string;
  }>;
}

// Everything of the actor's own that is still stored in plaintext, so the
// browser can seal it after the first unlock. Owner-only by construction:
// every query is anchored on enrolments where fellow_user_id = actor.
export async function listUnsealedForActor(actor: Actor): Promise<UnsealedInventory> {
  const db = getDb();
  const own = db
    .select({ id: enrolment.id })
    .from(enrolment)
    .where(and(eq(enrolment.fellowUserId, actor.userId), eq(enrolment.diaryState, "open")));

  const entries = await db
    .select({
      id: evidenceItem.id,
      enrolmentId: evidenceItem.enrolmentId,
      tenantId: evidenceItem.tenantId,
      tenantSlug: tenant.slug,
      title: evidenceItem.title,
      narrativeDoc: evidenceItem.narrativeDoc,
      activityDate: evidenceItem.activityDate,
      evidenceTypeId: evidenceItem.evidenceTypeId,
      rowVersion: evidenceItem.rowVersion,
    })
    .from(evidenceItem)
    .innerJoin(tenant, eq(evidenceItem.tenantId, tenant.id))
    .where(
      and(
        sql`${evidenceItem.enrolmentId} IN ${own}`,
        eq(evidenceItem.authorUserId, actor.userId),
        eq(evidenceItem.encrypted, false),
        isNull(evidenceItem.deletedAt),
      ),
    );

  const links = await db
    .select({
      id: externalLink.id,
      evidenceId: externalLink.evidenceItemId,
      tenantSlug: tenant.slug,
      url: externalLink.url,
      host: externalLink.host,
      label: externalLink.label,
      linkType: externalLink.linkType,
    })
    .from(externalLink)
    .innerJoin(evidenceItem, eq(externalLink.evidenceItemId, evidenceItem.id))
    .innerJoin(tenant, eq(evidenceItem.tenantId, tenant.id))
    .where(
      and(
        sql`${evidenceItem.enrolmentId} IN ${own}`,
        eq(evidenceItem.authorUserId, actor.userId),
        eq(externalLink.encrypted, false),
        isNull(externalLink.deletedAt),
        isNull(evidenceItem.deletedAt),
      ),
    );

  const attachments = await db
    .select({
      id: attachment.id,
      evidenceId: attachment.parentId,
      tenantSlug: tenant.slug,
      displayName: attachment.displayName,
      mediaType: attachment.mediaTypeDetected,
      sizeBytes: attachment.sizeBytes,
      scanStatus: attachment.scanStatus,
    })
    .from(attachment)
    .innerJoin(evidenceItem, eq(attachment.parentId, evidenceItem.id))
    .innerJoin(tenant, eq(evidenceItem.tenantId, tenant.id))
    .where(
      and(
        eq(attachment.parentType, "evidence_item"),
        sql`${evidenceItem.enrolmentId} IN ${own}`,
        eq(evidenceItem.authorUserId, actor.userId),
        eq(attachment.encrypted, false),
        isNull(attachment.deletedAt),
        isNull(evidenceItem.deletedAt),
      ),
    );

  return {
    entries,
    links,
    attachments: attachments.map((a) => ({ ...a, mediaType: a.mediaType ?? "application/octet-stream" })),
  };
}
