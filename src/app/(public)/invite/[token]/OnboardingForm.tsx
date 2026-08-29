"use client";

import { useState } from "react";

import { NOTICE_VERSION } from "@/lib/notices";

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  minHeight: "var(--target-min)",
  border: "2px solid var(--ink)",
  borderRadius: "var(--radius-control)",
  padding: "0 var(--space-3)",
  background: "var(--paper)",
  marginBottom: "var(--space-4)",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 700,
  marginBottom: "var(--space-1)",
};

export function OnboardingForm({
  token,
  invitedDisplayName,
  privacyNoticeUrl,
}: {
  token: string;
  invitedDisplayName: string;
  privacyNoticeUrl: string | null;
}) {
  const [preferredName, setPreferredName] = useState(invitedDisplayName);
  const [professionalGroup, setProfessionalGroup] = useState("");
  const [homeSpecialty, setHomeSpecialty] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [notices, setNotices] = useState({
    privacy_notice: false,
    acceptable_use: false,
    no_patient_data: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const allNoticesConfirmed = Object.values(notices).every(Boolean);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!preferredName.trim()) {
      setError("Preferred name is required.");
      return;
    }
    if (!allNoticesConfirmed) {
      setError("Confirm all three notices to continue.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/v1/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          preferredName: preferredName.trim(),
          professionalGroup: professionalGroup.trim() || undefined,
          homeSpecialtyOrRole: homeSpecialty.trim() || undefined,
          organisation: organisation.trim() || undefined,
          acknowledgedNotices: (Object.keys(notices) as Array<keyof typeof notices>).map(
            (noticeType) => ({ noticeType, noticeVersion: NOTICE_VERSION }),
          ),
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.detail ?? "We could not accept the invitation. Try again.");
        setSubmitting(false);
        return;
      }
      const meResponse = await fetch("/api/v1/me");
      const me = meResponse.ok ? await meResponse.json() : null;
      const slug = me?.memberships?.[0]?.tenantSlug as string | undefined;
      window.location.assign(slug ? `/t/${slug}/today` : "/sign-in");
    } catch {
      setError("We could not accept the invitation. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  function noticeCheckbox(
    key: keyof typeof notices,
    label: string,
    link?: { href: string; text: string } | null,
  ) {
    return (
      <label
        style={{
          display: "flex",
          gap: "var(--space-3)",
          alignItems: "flex-start",
          padding: "var(--space-3)",
          border: "1px solid var(--rule)",
          marginBottom: "var(--space-2)",
          minHeight: "var(--target-min)",
          maxWidth: "var(--measure)",
        }}
      >
        <input
          type="checkbox"
          checked={notices[key]}
          onChange={(e) => setNotices((n) => ({ ...n, [key]: e.target.checked }))}
          style={{ width: 24, height: 24, accentColor: "var(--ink)", flexShrink: 0 }}
        />
        <span>
          {label}
          {link ? (
            <>
              {" "}
              <a href={link.href} target="_blank" rel="noopener noreferrer" data-external>
                {link.text} <span aria-hidden>[↗]</span>
                <span className="visually-hidden">(opens external site)</span>
              </a>
            </>
          ) : null}
        </span>
      </label>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <h2 style={{ marginBottom: "var(--space-3)" }}>About you</h2>

      <label htmlFor="preferredName" style={labelStyle}>
        Preferred name <span style={{ fontWeight: 400 }}>(Required)</span>
      </label>
      <input
        id="preferredName"
        value={preferredName}
        onChange={(e) => setPreferredName(e.target.value)}
        required
        maxLength={160}
        style={inputStyle}
      />

      <label htmlFor="professionalGroup" style={labelStyle}>
        Professional group
      </label>
      <input
        id="professionalGroup"
        value={professionalGroup}
        onChange={(e) => setProfessionalGroup(e.target.value)}
        maxLength={160}
        style={inputStyle}
      />

      <label htmlFor="homeSpecialty" style={labelStyle}>
        Home specialty or role
      </label>
      <input
        id="homeSpecialty"
        value={homeSpecialty}
        onChange={(e) => setHomeSpecialty(e.target.value)}
        maxLength={160}
        style={inputStyle}
      />

      <label htmlFor="organisation" style={labelStyle}>
        Organisation
      </label>
      <input
        id="organisation"
        value={organisation}
        onChange={(e) => setOrganisation(e.target.value)}
        maxLength={160}
        style={inputStyle}
      />

      <h2 style={{ margin: "var(--space-5) 0 var(--space-3)" }}>Required confirmations</h2>
      {noticeCheckbox(
        "privacy_notice",
        "I have read the privacy notice.",
        privacyNoticeUrl ? { href: privacyNoticeUrl, text: "Read the privacy notice" } : null,
      )}
      {noticeCheckbox(
        "acceptable_use",
        "I will use oPortfolio for programme learning records only.",
      )}
      {noticeCheckbox(
        "no_patient_data",
        "I understand oPortfolio must not contain patient-identifiable data.",
      )}

      {error ? (
        <p role="alert" style={{ margin: "var(--space-4) 0", fontWeight: 700 }}>
          ERROR: {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        style={{
          minHeight: "var(--target-min)",
          padding: "0 var(--space-5)",
          background: "var(--ink)",
          color: "var(--paper)",
          border: "2px solid var(--ink)",
          borderRadius: "var(--radius-control)",
          fontWeight: 700,
          marginTop: "var(--space-4)",
        }}
      >
        {submitting ? "Setting up your diary…" : "Accept invitation and continue"}
      </button>
    </form>
  );
}
