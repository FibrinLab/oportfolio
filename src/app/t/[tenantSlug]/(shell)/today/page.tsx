import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getActor, resolveTenant } from "@/server/policy/actor";
import { getFellowContext } from "@/server/tenancy/fellowContext";
import { formatDateUk } from "@/lib/dates";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const actor = await getActor();
  if (!actor) notFound();
  const { tenantSlug } = await params;
  const tenantContext = await resolveTenant(actor, tenantSlug);
  if (!tenantContext) notFound();

  const fellow = await getFellowContext(actor, tenantContext.tenantId);

  return (
    <>
      <h1 style={{ marginBottom: "var(--space-5)" }}>
        Hello, {fellow?.preferredName ?? actor.displayName}.
      </h1>

      {fellow ? (
        <section
          aria-labelledby="programme-heading"
          style={{
            border: "1px solid var(--rule)",
            padding: "var(--space-4)",
            marginBottom: "var(--space-5)",
            maxWidth: "var(--measure)",
          }}
        >
          <h2 id="programme-heading" style={{ borderBottom: "2px solid var(--ink)", paddingBottom: "var(--space-2)", marginBottom: "var(--space-3)" }}>
            Your programme
          </h2>
          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "max-content 1fr",
              gap: "var(--space-2) var(--space-4)",
            }}
          >
            <dt style={{ fontWeight: 700 }}>Programme</dt>
            <dd>
              {fellow.programmeName}
              {fellow.cohortName ? ` — ${fellow.cohortName}` : ""}
            </dd>
            {fellow.startsOn ? (
              <>
                <dt style={{ fontWeight: 700 }}>Dates</dt>
                <dd>
                  {formatDateUk(fellow.startsOn)}
                  {fellow.endsOn ? ` to ${formatDateUk(fellow.endsOn)}` : ""}
                </dd>
              </>
            ) : null}
            <dt style={{ fontWeight: 700 }}>Supervisor</dt>
            <dd>{fellow.supervisorNames.length ? fellow.supervisorNames.join(", ") : "Not yet assigned"}</dd>
            <dt style={{ fontWeight: 700 }}>Curriculum</dt>
            <dd>
              {fellow.frameworkTitle
                ? `${fellow.frameworkTitle} — version ${fellow.frameworkVersion}`
                : "Pinned curriculum will appear once published"}
            </dd>
          </dl>
        </section>
      ) : (
        <p style={{ maxWidth: "var(--measure)" }}>
          You do not have an active programme enrolment in this tenant.
        </p>
      )}
    </>
  );
}
