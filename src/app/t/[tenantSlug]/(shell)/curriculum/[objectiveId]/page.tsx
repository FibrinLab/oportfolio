import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getActor, resolveTenant } from "@/server/policy/actor";
import { getObjectiveDetail, getOwnEnrolment } from "@/server/framework/queries";

export const metadata: Metadata = { title: "Objective" };

const LEVEL_LABEL: Record<string, string> = {
  domain: "Domain-level mapping",
  objective: "Objective-level mapping",
};

export default async function ObjectiveDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; objectiveId: string }>;
}) {
  const actor = await getActor();
  if (!actor) notFound();
  const { tenantSlug, objectiveId } = await params;
  const tenantContext = await resolveTenant(actor, tenantSlug);
  if (!tenantContext) notFound();

  const enrolmentContext = await getOwnEnrolment(actor, tenantContext.tenantId);
  if (!enrolmentContext) notFound();
  const detail = await getObjectiveDetail(actor, enrolmentContext, objectiveId);
  if (!detail) notFound();

  return (
    <>
      <nav aria-label="Breadcrumb" style={{ marginBottom: "var(--space-4)", fontSize: "var(--text-sm)" }}>
        <Link href={`/t/${tenantSlug}/curriculum`}>Curriculum</Link>
        {" / "}
        <span>
          {detail.domain.code} {detail.domain.title}
        </span>
        {" / "}
        <span aria-current="page">{detail.objective.code}</span>
      </nav>

      <h1 style={{ marginBottom: "var(--space-3)" }}>
        {detail.objective.code} — {detail.objective.title}
      </h1>

      <p style={{ fontSize: "var(--text-sm)", color: "var(--disabled-text)", marginBottom: "var(--space-5)" }}>
        Stable ID <code>{detail.objective.stableId}</code> · {detail.release.frameworkTitle}{" "}
        version {detail.release.version}
      </p>

      <section aria-labelledby="source-heading" style={{ marginBottom: "var(--space-6)" }}>
        <h2 id="source-heading" style={{ marginBottom: "var(--space-2)" }}>
          Objective wording
        </h2>
        <blockquote
          style={{
            borderLeft: "4px solid var(--ink)",
            padding: "var(--space-3) var(--space-4)",
            maxWidth: "var(--measure)",
            fontStyle: "normal",
          }}
        >
          {detail.objective.sourceText}
        </blockquote>
      </section>

      <section aria-labelledby="evidence-heading" style={{ marginBottom: "var(--space-6)" }}>
        <h2 id="evidence-heading" style={{ marginBottom: "var(--space-2)" }}>
          Mapped evidence
        </h2>
        <p style={{ maxWidth: "var(--measure)", color: "var(--disabled-text)" }}>
          Evidence you map to this objective will appear here. Mapped evidence is a count
          and review aid, not proof of competence.
        </p>
      </section>

      <section aria-labelledby="mappings-heading" style={{ marginBottom: "var(--space-6)" }}>
        <h2 id="mappings-heading" style={{ marginBottom: "var(--space-3)" }}>
          External framework mappings
        </h2>
        {detail.externalMappings.length === 0 ? (
          <p style={{ color: "var(--disabled-text)" }}>No published mappings.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, maxWidth: "var(--measure)" }}>
            {detail.externalMappings.map((mapping, index) => (
              <li
                key={index}
                style={{ border: "1px solid var(--rule)", padding: "var(--space-3)", marginBottom: "var(--space-2)" }}
              >
                <p style={{ fontWeight: 700 }}>
                  {mapping.targetFramework} ({mapping.targetFrameworkVersion}) —{" "}
                  {mapping.targetNodeCode} {mapping.targetNodeTitle}
                </p>
                <p style={{ fontSize: "var(--text-sm)", color: "var(--disabled-text)" }}>
                  [{LEVEL_LABEL[mapping.level] ?? mapping.level}] · relationship:{" "}
                  {mapping.relationship} · {mapping.provenance} ·{" "}
                  {mapping.verificationStatus.replaceAll("_", " ")}
                </p>
                {mapping.level === "domain" ? (
                  <p style={{ fontSize: "var(--text-sm)" }}>
                    This mapping applies to the whole {detail.domain.code} domain — it is not
                    an objective-level endorsement.
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
