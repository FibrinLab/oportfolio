import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getActor, resolveTenant } from "@/server/policy/actor";
import { getCurriculumForEnrolment, getOwnEnrolment } from "@/server/framework/queries";
import { formatDateUk } from "@/lib/dates";

export const metadata: Metadata = { title: "Curriculum" };

export default async function CurriculumPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const actor = await getActor();
  if (!actor) notFound();
  const { tenantSlug } = await params;
  const tenantContext = await resolveTenant(actor, tenantSlug);
  if (!tenantContext) notFound();

  const enrolmentContext = await getOwnEnrolment(actor, tenantContext.tenantId);
  if (!enrolmentContext) notFound();
  const curriculum = await getCurriculumForEnrolment(actor, enrolmentContext);
  if (!curriculum) notFound();

  const { release, domains } = curriculum;
  const totalObjectives = domains.reduce((sum, d) => sum + d.objectives.length, 0);

  return (
    <>
      <h1 style={{ marginBottom: "var(--space-3)" }}>Curriculum</h1>

      {/* The page always states the pinned release and provides a source link (S-06). */}
      <p
        style={{
          border: "1px solid var(--rule)",
          background: "var(--paper-soft)",
          padding: "var(--space-3) var(--space-4)",
          marginBottom: "var(--space-6)",
          maxWidth: "var(--measure)",
          fontSize: "var(--text-sm)",
        }}
      >
        {release.frameworkTitle} — version {release.version}
        {release.label ? ` (${release.label})` : ""}, {release.publisher}.
        {release.publishedOn ? ` Published ${formatDateUk(release.publishedOn)}.` : ""}{" "}
        <a href={release.sourceUrl} target="_blank" rel="noopener noreferrer" data-external>
          Source document <span aria-hidden>[↗]</span>
          <span className="visually-hidden">(opens external site)</span>
        </a>
        . Your enrolment is pinned to this version; it does not change if a newer
        curriculum is published.
      </p>

      <p style={{ marginBottom: "var(--space-5)" }}>
        {domains.length} domains, {totalObjectives} objectives.
      </p>

      {domains.map((dom) => (
        <section
          key={dom.id}
          aria-labelledby={`domain-${dom.code}`}
          style={{ marginBottom: "var(--space-6)", maxWidth: "var(--content-max)" }}
        >
          <h2
            id={`domain-${dom.code}`}
            style={{
              borderBottom: "2px solid var(--ink)",
              paddingBottom: "var(--space-2)",
              marginBottom: "var(--space-3)",
            }}
          >
            {dom.code} — {dom.title}{" "}
            <span style={{ fontWeight: 400, fontSize: "var(--text-sm)" }}>
              ({dom.objectives.length} objectives)
            </span>
          </h2>
          {dom.description ? (
            <p style={{ marginBottom: "var(--space-3)", color: "var(--disabled-text)" }}>
              {dom.description}
            </p>
          ) : null}
          <ul style={{ listStyle: "none", padding: 0 }}>
            {dom.objectives.map((obj) => (
              <li
                key={obj.id}
                style={{
                  borderBottom: "1px solid var(--rule)",
                  padding: "var(--space-3) 0",
                }}
              >
                <Link href={`/t/${tenantSlug}/curriculum/${obj.id}`}>
                  <strong>{obj.code}</strong> {obj.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
