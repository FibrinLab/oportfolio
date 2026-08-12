import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getActor, resolveTenant } from "@/server/policy/actor";
import { getAssignedFellows } from "@/server/tenancy/supervisorFellows";
import { formatDateTimeUk } from "@/lib/dates";

export const metadata: Metadata = { title: "Fellows" };

export default async function FellowsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const actor = await getActor();
  if (!actor) notFound();
  const { tenantSlug } = await params;
  const tenantContext = await resolveTenant(actor, tenantSlug);
  if (!tenantContext) notFound();

  const isSupervisor = actor.memberships.some(
    (m) => m.tenantId === tenantContext.tenantId && m.role === "supervisor",
  );
  if (!isSupervisor) notFound();

  const fellows = await getAssignedFellows(actor, tenantContext.tenantId);

  return (
    <>
      <h1 style={{ marginBottom: "var(--space-5)" }}>Your fellows</h1>
      {fellows.length === 0 ? (
        <p style={{ maxWidth: "var(--measure)", color: "var(--disabled-text)" }}>
          You have no current supervision assignments.
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, maxWidth: "var(--measure)" }}>
          {fellows.map((fellow) => (
            <li
              key={fellow.enrolmentId}
              style={{
                border: "1px solid var(--rule)",
                padding: "var(--space-4)",
                marginBottom: "var(--space-3)",
              }}
            >
              <p style={{ fontWeight: 700, marginBottom: "var(--space-1)" }}>
                <Link href={`/t/${tenantSlug}/supervisor/fellows/${fellow.enrolmentId}`}>
                  {fellow.fellowName ?? "Invitation pending"}
                </Link>
              </p>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--disabled-text)" }}>
                {fellow.programmeName} — {fellow.cohortName} · [
                {fellow.enrolmentStatus.toUpperCase()}] ·{" "}
                {fellow.assignmentType === "primary" ? "Primary supervisor" : "Co-supervisor"}{" "}
                since {formatDateTimeUk(fellow.startsAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
