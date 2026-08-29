import { DiaryLockGate } from "@/components/lock/DiaryLockGate";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { domain, noticeAcknowledgement, objective } from "@/server/db/schema";
import { getActor, resolveTenant } from "@/server/policy/actor";
import { canEditEvidence } from "@/server/policy/policy";
import {
  getActiveObjectiveIds,
  getEvidenceWithAccess,
  listRevisions,
} from "@/server/portfolio/evidence";
import { getEditorContext } from "@/server/portfolio/editorData";
import { aad } from "@/lib/crypto/envelope";
import { SealedFileLink, SealedLinkAnchor, SealedNarrative, SealedText } from "@/components/lock/Sealed";
import { listAttachments } from "@/server/files/attachments";
import { listLinks } from "@/server/portfolio/links";
import { EvidenceEditor } from "@/components/evidence/EvidenceEditor";
import { DiaryEntryActions } from "@/components/evidence/DiaryEntryActions";
import { formatDateUk, formatDateTimeUk } from "@/lib/dates";

// Neutral title only — no portfolio content in the browser tab (spec/02).
export const metadata: Metadata = { title: "Diary entry" };

export default async function EvidencePage({
  params,
}: {
  params: Promise<{ tenantSlug: string; evidenceId: string }>;
}) {
  const actor = await getActor();
  if (!actor) notFound();
  const { tenantSlug, evidenceId } = await params;
  const tenantContext = await resolveTenant(actor, tenantSlug);
  if (!tenantContext) notFound();

  const access = await getEvidenceWithAccess(actor, tenantContext.tenantId, evidenceId);
  if (!access || !access.decision.allow) notFound();
  const { evidence, enrolment } = access;

  const editable = canEditEvidence(actor, evidence, enrolment).allow;

  if (editable) {
    const context = await getEditorContext(actor, tenantContext.tenantId);
    if (!context) notFound();
    const [objectiveIds, priorReflectionAck, files, links] = await Promise.all([
      getActiveObjectiveIds(evidence.id),
      getDb()
        .select({ id: noticeAcknowledgement.id })
        .from(noticeAcknowledgement)
        .where(
          and(
            eq(noticeAcknowledgement.tenantId, tenantContext.tenantId),
            eq(noticeAcknowledgement.userId, actor.userId),
            eq(noticeAcknowledgement.noticeType, "reflection_safety"),
          ),
        )
        .limit(1),
      listAttachments(evidence.id, tenantContext.tenantId),
      listLinks(evidence.id, tenantContext.tenantId),
    ]);
    return (
      <DiaryLockGate>
      <EvidenceEditor
        tenantSlug={tenantSlug}
        enrolmentId={enrolment.id}
        initial={{
          id: evidence.id,
          title: evidence.title,
          activityDate: evidence.activityDate,
          evidenceTypeId: evidence.evidenceTypeId,
          narrativeDoc: evidence.narrativeDoc,
          encrypted: evidence.encrypted,
          contentEnc: evidence.contentEnc,
          objectiveIds,
          rowVersion: evidence.rowVersion,
        }}
        options={context.options}
        pickerObjectives={context.pickerObjectives}
        frameworkLabel={context.frameworkLabel}
        reflectionAcknowledgedBefore={priorReflectionAck.length > 0}
        initialFiles={files}
        initialLinks={links}
      />
      </DiaryLockGate>
    );
  }

  // Read-only detail for the owner when the entry is archived or the diary is finished.
  const objectiveIds = await getActiveObjectiveIds(evidence.id);
  const db = getDb();
  const mappedObjectives = objectiveIds.length
    ? await db
        .select({
          id: objective.id,
          code: objective.code,
          title: objective.title,
          domainCode: domain.code,
          domainTitle: domain.title,
        })
        .from(objective)
        .innerJoin(domain, eq(objective.domainId, domain.id))
        .where(inArray(objective.id, objectiveIds))
    : [];
  const revisions = await listRevisions(actor, access);
  const [files, links] = await Promise.all([
    listAttachments(evidence.id, tenantContext.tenantId),
    listLinks(evidence.id, tenantContext.tenantId),
  ]);
  const cleanFiles = files.filter((f) => f.scanStatus === "clean" || f.scanStatus === "sealed");
  const titleEnc = evidence.encrypted ? (evidence.contentEnc?.title ?? null) : null;
  const narrativeEnc = evidence.encrypted ? (evidence.contentEnc?.narrative ?? null) : null;

  return (
    <DiaryLockGate>
    <article style={{ maxWidth: "var(--measure)" }}>
      <nav aria-label="Breadcrumb" style={{ marginBottom: "var(--space-4)", fontSize: "var(--text-sm)" }}>
        <Link href={`/t/${tenantSlug}/log`}>Back to diary</Link>
      </nav>

      <p className="stamp" style={{ marginBottom: "var(--space-2)" }}>
        [{evidence.deletedAt ? "DELETED — RECOVERABLE" : evidence.archivedAt ? "ARCHIVED" : "PRIVATE DIARY"}]
      </p>
      <h1 style={{ marginBottom: "var(--space-2)" }}>
        <SealedText envelope={titleEnc} aad={aad.evidenceTitle(evidence.id)} fallback={evidence.title || "(untitled)"} />
      </h1>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--disabled-text)", marginBottom: "var(--space-5)" }}>
        {evidence.activityDate ? `Activity ${formatDateUk(evidence.activityDate)} · ` : ""}
        Last updated {formatDateTimeUk(evidence.updatedAt)}
      </p>

      {enrolment.diaryState === "open" && (evidence.archivedAt || evidence.deletedAt) ? (
        <DiaryEntryActions tenantSlug={tenantSlug} entryId={evidence.id} mode="recoverable" />
      ) : null}

      <section
        aria-label="Evidence content"
        style={{ borderTop: "2px solid var(--ink)", paddingTop: "var(--space-4)", marginBottom: "var(--space-6)" }}
      >
        {/* Rendered as React elements from the (decrypted) document — never HTML strings. */}
        <SealedNarrative
          envelope={narrativeEnc}
          aad={aad.evidenceNarrative(evidence.id)}
          fallbackDoc={evidence.narrativeDoc}
        />
      </section>

      <section aria-labelledby="maps-heading" style={{ marginBottom: "var(--space-6)" }}>
        <h2 id="maps-heading" style={{ marginBottom: "var(--space-2)" }}>
          What this maps to
        </h2>
        {mappedObjectives.length === 0 ? (
          <p style={{ color: "var(--disabled-text)" }}>No objective mappings.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {mappedObjectives.map((mapped) => (
              <li key={mapped.id} style={{ borderBottom: "1px solid var(--rule)", padding: "var(--space-2) 0" }}>
                <strong>{mapped.code}</strong> {mapped.title}
                <span style={{ display: "block", fontSize: "var(--text-sm)", color: "var(--disabled-text)" }}>
                  {mapped.domainCode} — {mapped.domainTitle}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p style={{ fontSize: "var(--text-sm)", color: "var(--disabled-text)", marginTop: "var(--space-2)" }}>
          Curriculum links are optional organisational aids, not proof of competence.
        </p>
      </section>

      <section aria-labelledby="artefacts-heading" style={{ marginBottom: "var(--space-6)" }}>
        <h2 id="artefacts-heading" style={{ marginBottom: "var(--space-2)" }}>
          Artefacts
        </h2>
        {cleanFiles.length === 0 && links.length === 0 ? (
          <p style={{ color: "var(--disabled-text)" }}>No files or links.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {cleanFiles.map((file) => (
              <li key={file.id} style={{ borderBottom: "1px solid var(--rule)", padding: "var(--space-2) 0" }}>
                <SealedFileLink file={file} tenantSlug={tenantSlug} />{" "}
                <span style={{ fontSize: "var(--text-sm)", color: "var(--disabled-text)" }}>
                  ({Math.max(1, Math.round(file.sizeBytes / 1024))} KB)
                </span>
              </li>
            ))}
            {links.map((link) => (
              <li key={link.id} style={{ borderBottom: "1px solid var(--rule)", padding: "var(--space-2) 0" }}>
                <SealedLinkAnchor link={link} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="history-heading">
        <h2 id="history-heading" style={{ marginBottom: "var(--space-2)" }}>
          History
        </h2>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {(revisions ?? []).map((revision) => (
            <li
              key={revision.revisionNumber}
              style={{ borderBottom: "1px solid var(--rule)", padding: "var(--space-2) 0", fontSize: "var(--text-sm)" }}
            >
              Revision {revision.revisionNumber} — {revision.changeReason ?? "updated"} by{" "}
              {revision.createdByName ?? "unknown"} on {formatDateTimeUk(revision.createdAt)}
            </li>
          ))}
        </ul>
      </section>
    </article>
    </DiaryLockGate>
  );
}
