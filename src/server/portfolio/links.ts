import { and, eq, isNull } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getDb } from "@/server/db/client";
import { externalLink } from "@/server/db/schema";
import { appendAudit } from "@/server/audit/audit";
import type { Actor } from "@/server/policy/actor";
import { canEditEvidence } from "@/server/policy/policy";
import type { EvidenceAccess } from "./evidence";
import type { Envelope } from "@/lib/crypto/envelope";

// External links (FR-FI-004, spec/05): HTTPS only, host stored for display,
// NEVER fetched server-side (anti-SSRF, spec/07:168-171).

export type LinkType =
  | "general"
  | "repository"
  | "commit"
  | "pull_request"
  | "release"
  | "notebook"
  | "other";

export async function addLink(
  actor: Actor,
  access: EvidenceAccess,
  input: {
    id?: string;
    url?: string;
    linkEnc?: Envelope;
    label?: string;
    linkType?: LinkType;
    description?: string;
  },
  requestId: string | null,
): Promise<{ ok: true; id: string; host: string } | { ok: false; reason: string }> {
  if (!canEditEvidence(actor, access.evidence, access.enrolment).allow) {
    return { ok: false, reason: "denied" };
  }

  // Sealed link (ADR-007): the browser validated https:// and stored url,
  // host and label inside the envelope; the server keeps only ciphertext.
  if (input.linkEnc) {
    if (input.url || input.label || input.description) {
      return { ok: false, reason: "A sealed link cannot also carry plaintext." };
    }
    const id = input.id ?? uuidv7();
    const db = getDb();
    await db.transaction(async (tx) => {
      await tx.insert(externalLink).values({
        id,
        tenantId: access.evidence.tenantId,
        evidenceItemId: access.evidence.id,
        linkType: input.linkType ?? "general",
        url: "",
        host: "",
        encrypted: true,
        linkEnc: input.linkEnc,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      });
      await appendAudit(tx, {
        tenantId: access.evidence.tenantId,
        actorUserId: actor.userId,
        action: "link.added",
        targetType: "external_link",
        targetId: id,
        enrolmentId: access.evidence.enrolmentId,
        requestId,
        metadata: { sealed: true, linkType: input.linkType ?? "general" },
      });
    });
    return { ok: true, id, host: "" };
  }

  let parsed: URL;
  try {
    parsed = new URL(input.url ?? "");
  } catch {
    return { ok: false, reason: "Enter a full link starting with https://" };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, reason: "Links must use https." };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: "Links must not contain credentials." };
  }

  const id = input.id ?? uuidv7();
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.insert(externalLink).values({
      id,
      tenantId: access.evidence.tenantId,
      evidenceItemId: access.evidence.id,
      linkType: input.linkType ?? "general",
      url: parsed.toString(),
      host: parsed.host,
      label: input.label,
      description: input.description,
      createdBy: actor.userId,
      updatedBy: actor.userId,
    });
    await appendAudit(tx, {
      tenantId: access.evidence.tenantId,
      actorUserId: actor.userId,
      action: "link.added",
      targetType: "external_link",
      targetId: id,
      enrolmentId: access.evidence.enrolmentId,
      requestId,
      // Host only — never the full URL in logs/audit (data minimisation).
      metadata: { host: parsed.host, linkType: input.linkType ?? "general" },
    });
  });
  return { ok: true, id, host: parsed.host };
}

export async function removeLink(
  actor: Actor,
  access: EvidenceAccess,
  linkId: string,
  requestId: string | null,
): Promise<boolean> {
  if (!canEditEvidence(actor, access.evidence, access.enrolment).allow) return false;
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .update(externalLink)
      .set({ deletedAt: new Date(), updatedBy: actor.userId })
      .where(
        and(
          eq(externalLink.id, linkId),
          eq(externalLink.tenantId, access.evidence.tenantId),
          eq(externalLink.evidenceItemId, access.evidence.id),
        ),
      );
    await appendAudit(tx, {
      tenantId: access.evidence.tenantId,
      actorUserId: actor.userId,
      action: "link.removed",
      targetType: "external_link",
      targetId: linkId,
      enrolmentId: access.evidence.enrolmentId,
      requestId,
    });
  });
  return true;
}

export async function listLinks(evidenceId: string, tenantId: string) {
  const db = getDb();
  return db
    .select({
      id: externalLink.id,
      url: externalLink.url,
      host: externalLink.host,
      label: externalLink.label,
      linkType: externalLink.linkType,
      encrypted: externalLink.encrypted,
      linkEnc: externalLink.linkEnc,
    })
    .from(externalLink)
    .where(
      and(
        eq(externalLink.tenantId, tenantId),
        eq(externalLink.evidenceItemId, evidenceId),
        isNull(externalLink.deletedAt),
      ),
    )
    .then((rows) => rows.map((row) => ({ ...row, linkEnc: (row.linkEnc as Envelope | null) ?? null })));
}
