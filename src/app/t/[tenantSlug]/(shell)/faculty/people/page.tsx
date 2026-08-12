import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getActor, resolveTenant } from "@/server/policy/actor";
import { getPeopleView } from "@/server/tenancy/facultyPeople";
import { formatDateTimeUk } from "@/lib/dates";
import { InviteFellowForm } from "./InviteFellowForm";

export const metadata: Metadata = { title: "People" };

export default async function PeoplePage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const actor = await getActor();
  if (!actor) notFound();
  const { tenantSlug } = await params;
  const tenantContext = await resolveTenant(actor, tenantSlug);
  if (!tenantContext) notFound();

  const view = await getPeopleView(actor, tenantContext.tenantId);
  if (!view) notFound();

  return (
    <>
      <h1 style={{ marginBottom: "var(--space-5)" }}>People</h1>

      <section aria-labelledby="enrolments-heading" style={{ marginBottom: "var(--space-7)" }}>
        <h2 id="enrolments-heading" style={{ marginBottom: "var(--space-3)" }}>
          Enrolments
        </h2>
        {view.enrolments.length === 0 ? (
          <p style={{ color: "var(--disabled-text)" }}>No enrolments yet.</p>
        ) : (
          <table style={{ borderCollapse: "collapse", width: "100%", maxWidth: "var(--content-max)" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--ink)", textAlign: "left" }}>
                <th style={{ padding: "var(--space-2)" }}>Fellow</th>
                <th style={{ padding: "var(--space-2)" }}>Cohort</th>
                <th style={{ padding: "var(--space-2)" }}>Status</th>
                <th style={{ padding: "var(--space-2)" }}>Supervisors</th>
              </tr>
            </thead>
            <tbody>
              {view.enrolments.map((e) => (
                <tr key={e.id} style={{ borderBottom: "1px solid var(--rule)" }}>
                  <td style={{ padding: "var(--space-2)" }}>
                    {e.fellowName ?? "Invitation pending"}
                    {e.fellowEmail ? (
                      <span style={{ color: "var(--disabled-text)" }}> ({e.fellowEmail})</span>
                    ) : null}
                  </td>
                  <td style={{ padding: "var(--space-2)" }}>{e.cohortName}</td>
                  <td style={{ padding: "var(--space-2)" }}>[{e.status.toUpperCase()}]</td>
                  <td style={{ padding: "var(--space-2)" }}>
                    {e.supervisorNames.join(", ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-labelledby="invitations-heading" style={{ marginBottom: "var(--space-7)" }}>
        <h2 id="invitations-heading" style={{ marginBottom: "var(--space-3)" }}>
          Pending invitations
        </h2>
        {view.pendingInvitations.length === 0 ? (
          <p style={{ color: "var(--disabled-text)" }}>No pending invitations.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, maxWidth: "var(--measure)" }}>
            {view.pendingInvitations.map((inv) => (
              <li key={inv.id} style={{ border: "1px solid var(--rule)", padding: "var(--space-3)", marginBottom: "var(--space-2)" }}>
                <strong>{inv.displayName}</strong> ({inv.email}) — {inv.role}
                <span style={{ display: "block", fontSize: "var(--text-sm)", color: "var(--disabled-text)" }}>
                  Expires {formatDateTimeUk(inv.expiresAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="invite-heading">
        <h2 id="invite-heading" style={{ marginBottom: "var(--space-3)" }}>
          Invite a fellow
        </h2>
        <InviteFellowForm
          tenantId={tenantContext.tenantId}
          cohorts={view.cohorts}
          supervisors={view.supervisors}
        />
      </section>
    </>
  );
}
