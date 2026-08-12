import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { appUser } from "@/server/db/schema";
import { getActor, resolveTenant } from "@/server/policy/actor";
import { canReadEnrolment } from "@/server/policy/policy";
import { loadEnrolmentContext } from "@/server/framework/queries";
import { listEvidence } from "@/server/portfolio/evidence";
import { formatDateUk, formatDateTimeUk } from "@/lib/dates";

export const metadata: Metadata = { title: "Fellow" };

export default async function SupervisorFellowPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; enrolmentId: string }>;
}) {
  const actor = await getActor();
  if (!actor) notFound();
  const { tenantSlug, enrolmentId } = await params;
  const tenantContext = await resolveTenant(actor, tenantSlug);
  if (!tenantContext) notFound();

  const enrolment = await loadEnrolmentContext(tenantContext.tenantId, enrolmentId);
  if (!enrolment) notFound();
  if (!canReadEnrolment(actor, enrolment).allow) notFound();

  // The fellow's own view lives under /log; this page is the supervisor's.
  const assignment = actor.assignments.find((a) => a.enrolmentId === enrolmentId);
  if (!assignment) notFound();

  const fellowRows = enrolment.fellowUserId
    ? await getDb()
        .select({ displayName: appUser.displayName })
        .from(appUser)
        .where(eq(appUser.id, enrolment.fellowUserId))
        .limit(1)
    : [];
  const fellowName = fellowRows[0]?.displayName ?? "Invitation pending";

  // Only supervisor-visible, shared items appear — the query predicate
  // enforces it; private drafts do not exist for this viewer.
  const items = await listEvidence(actor, enrolment);

  return (
    <>
      <nav aria-label="Breadcrumb" style={{ marginBottom: "var(--space-4)", fontSize: "var(--text-sm)" }}>
        <Link href={`/t/${tenantSlug}/supervisor/fellows`}>Your fellows</Link>
        {" / "}
        <span aria-current="page">{fellowName}</span>
      </nav>

      <h1 style={{ marginBottom: "var(--space-3)" }}>{fellowName}</h1>

      {/* Access-basis banner (spec/02): why this supervisor can see this page. */}
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
        You see this portfolio as{" "}
        {assignment.assignmentType === "primary" ? "primary supervisor" : "co-supervisor"}. Only
        items the fellow has deliberately shared with supervisors appear here.
      </p>

      <h2 style={{ marginBottom: "var(--space-3)" }}>
        Shared evidence{" "}
        <span style={{ fontWeight: 400, fontSize: "var(--text-body)" }}>({items.length})</span>
      </h2>
      {items.length === 0 ? (
        <p style={{ color: "var(--disabled-text)", maxWidth: "var(--measure)" }}>
          Nothing shared yet.
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, maxWidth: "var(--content-max)" }}>
          {items.map((item) => (
            <li
              key={item.id}
              style={{ borderBottom: "1px solid var(--rule)", padding: "var(--space-3) 0" }}
            >
              <Link href={`/t/${tenantSlug}/log/${item.id}`} style={{ fontWeight: 700 }}>
                {item.title}
              </Link>
              <span style={{ display: "block", fontSize: "var(--text-sm)", color: "var(--disabled-text)" }}>
                {item.activityDate ? `${formatDateUk(item.activityDate)} · ` : ""}
                {item.typeLabel} · {item.objectiveCount} objective
                {item.objectiveCount === 1 ? "" : "s"} mapped · updated{" "}
                {formatDateTimeUk(item.updatedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
