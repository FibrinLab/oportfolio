"use client";

import { useState } from "react";

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

export function InviteFellowForm({
  tenantId,
  cohorts,
}: {
  tenantId: string;
  cohorts: Array<{ id: string; name: string; programmeName: string }>;
}) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [cohortId, setCohortId] = useState(cohorts[0]?.id ?? "");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">("idle");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setErrorDetail(null);
    try {
      const response = await fetch("/api/v1/invitations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          tenantId,
          email,
          displayName,
          role: "fellow",
          cohortId,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setErrorDetail(body?.detail ?? null);
        setStatus("error");
        return;
      }
      setStatus("sent");
      setEmail("");
      setDisplayName("");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate style={{ maxWidth: "var(--measure)" }}>
      <label htmlFor="invite-email" style={labelStyle}>
        Email address <span style={{ fontWeight: 400 }}>(Required)</span>
      </label>
      <input
        id="invite-email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={inputStyle}
      />

      <label htmlFor="invite-name" style={labelStyle}>
        Name <span style={{ fontWeight: 400 }}>(Required)</span>
      </label>
      <input
        id="invite-name"
        required
        maxLength={160}
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        style={inputStyle}
      />

      <label htmlFor="invite-cohort" style={labelStyle}>
        Cohort <span style={{ fontWeight: 400 }}>(Required)</span>
      </label>
      <select
        id="invite-cohort"
        value={cohortId}
        onChange={(e) => setCohortId(e.target.value)}
        style={{ ...inputStyle, appearance: "auto" }}
      >
        {cohorts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.programmeName} — {c.name}
          </option>
        ))}
      </select>

      {status === "sent" ? (
        <p role="status" style={{ marginBottom: "var(--space-3)", fontWeight: 700 }}>
          Invitation sent.
        </p>
      ) : null}
      {status === "error" ? (
        <p role="alert" style={{ marginBottom: "var(--space-3)", fontWeight: 700 }}>
          ERROR: {errorDetail ?? "The invitation could not be created."}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={status === "submitting" || !cohortId}
        style={{
          minHeight: "var(--target-min)",
          padding: "0 var(--space-5)",
          background: "var(--ink)",
          color: "var(--paper)",
          border: "2px solid var(--ink)",
          borderRadius: "var(--radius-control)",
          fontWeight: 700,
        }}
      >
        {status === "submitting" ? "Sending…" : "Send invitation"}
      </button>
    </form>
  );
}
