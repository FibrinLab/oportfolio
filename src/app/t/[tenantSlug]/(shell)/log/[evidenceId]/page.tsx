import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { domain, noticeAcknowledgement, objective } from "@/server/db/schema";
import { getActor, resolveTenant } from "@/server/policy/actor";
import { canEditEvidence } from "@/server/policy/policy";
import {
  getActiveDutyIds,
  getActiveObjectiveIds,
  getEvidenceWithAccess,
  listRevisions,
} from "@/server/portfolio/evidence";
import { getEditorContext } from "@/server/portfolio/editorData";
import { renderNarrativeHtml } from "@/server/portfolio/narrativeDoc";
import { listAttachments } from "@/server/files/attachments";
import { listLinks } from "@/server/portfolio/links";
import { EvidenceEditor } from "@/components/evidence/EvidenceEditor";
import { formatDateUk, formatDateTimeUk } from "@/lib/dates";

// Neutral title only — no portfolio content in the browser tab (spec/02).
export const metadata: Metadata = { title: "Evidence item" };

const AUDIENCE_LABEL: Record<string, string> = {
  private: "Only me",
  supervisors: "Me + supervisors",
  faculty: "Me + supervisors + faculty",
};

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
    const [objectiveIds, dutyIds, priorReflectionAck, files, links] = await Promise.all([
      getActiveObjectiveIds(evidence.id),
      getActiveDutyIds(evidence.id),
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
      <EvidenceEditor
        tenantSlug={tenantSlug}
        enrolmentId={enrolment.id}
        initial={{
          id: evidence.id,
          title: evidence.title,
          activityDate: evidence.activityDate,
          evidenceTypeId: evidence.evidenceTypeId,
          narrativeDoc: evidence.narrativeDoc,
          typeFieldsJson: evidence.typeFieldsJson,
          provenanceId: evidence.provenanceId,
          visibility: evidence.visibility,
          workflowState: evidence.workflowState,
          objectiveIds,
          dutyIds,
          rowVersion: evidence.rowVersion,
        }}
        options={context.options}
        pickerObjectives={context.pickerObjectives}
        frameworkLabel={context.frameworkLabel}
        reflectionAcknowledgedBefore={priorReflectionAck.length > 0}
        initialFiles={files}
        initialLinks={links}
      />
    );
  }

  // Read-only detail (supervisor/faculty view; or archived items).
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
  const narrativeHtml = renderNarrativeHtml(evidence.narrativeDoc);
  const [files, links] = await Promise.all([
    listAttachments(evidence.id, tenantContext.tenantId),
    listLinks(evidence.id, tenantContext.tenantId),
  ]);
  const cleanFiles = files.filter((f) => f.scanStatus === "clean");

  return (
    <article style={{ maxWidth: "var(--measure)" }}>
      <nav aria-label="Breadcrumb" style={{ marginBottom: "var(--space-4)", fontSize: "var(--text-sm)" }}>
        <Link href={`/t/${tenantSlug}/supervisor/fellows/${enrolment.id}`}>Back to fellow</Link>
      </nav>

      <p className="stamp" style={{ marginBottom: "var(--space-2)" }}>
        [{evidence.workflowState === "shared" ? "SHARED" : evidence.workflowState.toUpperCase()}] ·{" "}
        {AUDIENCE_LABEL[evidence.visibility]}
      </p>
      <h1 style={{ marginBottom: "var(--space-2)" }}>{evidence.title}</h1>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--disabled-text)", marginBottom: "var(--space-5)" }}>
        {evidence.activityDate ? `Activity ${formatDateUk(evidence.activityDate)} · ` : ""}
        Last updated {formatDateTimeUk(evidence.updatedAt)}
      </p>

      <section
        aria-label="Evidence content"
        style={{ borderTop: "2px solid var(--ink)", paddingTop: "var(--space-4)", marginBottom: "var(--space-6)" }}
        // Safe by construction: renderNarrativeHtml escapes all text and only
        // emits the allowlisted structure the validator admitted.
        dangerouslySetInnerHTML={{ __html: narrativeHtml }}
      />

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
          Mapped evidence is a count and review aid, not proof of competence.
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
                <a href={`/api/v1/attachments/${file.id}/download?tenant=${tenantSlug}`}>
                  {file.displayName}
                </a>{" "}
                <span style={{ fontSize: "var(--text-sm)", color: "var(--disabled-text)" }}>
                  ({Math.max(1, Math.round(file.sizeBytes / 1024))} KB)
                </span>
              </li>
            ))}
            {links.map((link) => (
              <li key={link.id} style={{ borderBottom: "1px solid var(--rule)", padding: "var(--space-2) 0" }}>
                <a href={link.url} target="_blank" rel="noopener noreferrer" data-external>
                  {link.label ?? link.host} <span aria-hidden>[↗]</span>
                  <span className="visually-hidden">(opens external site)</span>
                </a>{" "}
                <span style={{ fontSize: "var(--text-sm)", color: "var(--disabled-text)" }}>
                  ({link.host})
                </span>
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
  );
}
