import type { Metadata } from "next";
import { getDb } from "@/server/db/client";
import { getInvitationContext } from "@/server/identity/invitationContext";
import { formatDateUk } from "@/lib/dates";
import { OnboardingForm } from "./OnboardingForm";

export const metadata: Metadata = { title: "Accept invitation" };

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const context = await getInvitationContext(getDb(), token);

  if (!context) {
    return (
      <main style={{ maxWidth: "40rem", margin: "0 auto", padding: "var(--space-8) var(--gutter)" }}>
        <h1 style={{ marginBottom: "var(--space-4)" }}>Invitation not available</h1>
        <p style={{ maxWidth: "var(--measure)" }}>
          This invitation link has expired, was already used, or was withdrawn. Invitations
          cannot be reissued from this page — contact your programme team and they will send
          a new one to your email address.
        </p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: "40rem", margin: "0 auto", padding: "var(--space-7) var(--gutter)" }}>
      <h1 style={{ marginBottom: "var(--space-2)" }}>Welcome to oPortfolio</h1>
      <p style={{ marginBottom: "var(--space-5)" }}>
        You have been invited to <strong>{context.tenantName}</strong>
        {context.programmeName ? (
          <>
            {" "}
            — <strong>{context.programmeName}</strong>
          </>
        ) : null}
        {context.cohortName ? <> ({context.cohortName})</> : null}.
      </p>

      <dl
        style={{
          border: "1px solid var(--rule)",
          padding: "var(--space-4)",
          marginBottom: "var(--space-5)",
          display: "grid",
          gridTemplateColumns: "max-content 1fr",
          gap: "var(--space-2) var(--space-4)",
        }}
      >
        <dt style={{ fontWeight: 700 }}>Invited as</dt>
        <dd>{context.invitation.role === "fellow" ? "Fellow" : context.invitation.role}</dd>
        <dt style={{ fontWeight: 700 }}>Email</dt>
        <dd>{context.invitation.emailNormalised}</dd>
        {context.startsOn ? (
          <>
            <dt style={{ fontWeight: 700 }}>Programme dates</dt>
            <dd>
              {formatDateUk(context.startsOn)}
              {context.endsOn ? ` to ${formatDateUk(context.endsOn)}` : ""}
            </dd>
          </>
        ) : null}
      </dl>

      <div
        style={{
          borderLeft: "4px solid var(--ink)",
          background: "var(--paper-soft)",
          padding: "var(--space-3) var(--space-4)",
          marginBottom: "var(--space-5)",
          maxWidth: "var(--measure)",
        }}
      >
        <p style={{ fontWeight: 700 }}>PRIVACY</p>
        <p>
          Your diary entries and reflections are visible only to you. Programme staff can
          administer your account, programme and enrolment, but cannot read diary titles,
          dates, links, files or reflections.
        </p>
      </div>

      <div
        style={{
          borderLeft: "4px solid var(--ink)",
          background: "var(--paper-soft)",
          padding: "var(--space-3) var(--space-4)",
          marginBottom: "var(--space-6)",
          maxWidth: "var(--measure)",
        }}
      >
        <p style={{ fontWeight: 700 }}>WARNING</p>
        <p>
          This diary is not a clinical record. Do not enter patient-identifiable data —
          names, dates of birth, NHS numbers, images, or rare combinations of facts that
          could identify a patient, colleague or third party.
        </p>
      </div>

      <OnboardingForm
        token={token}
        invitedDisplayName={context.invitation.invitedDisplayName}
        privacyNoticeUrl={context.privacyNoticeUrl}
      />
    </main>
  );
}
