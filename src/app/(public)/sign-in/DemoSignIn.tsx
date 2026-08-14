"use client";

import { useState } from "react";

// Rendered only when the server has DEMO_LOGIN=true. One click signs in as a
// seeded synthetic account through the real session flow.

const DEMO_ACCOUNTS = [
  { email: "fiona.fellow@example.org", label: "Fiona — Fellow", landing: "today" },
  { email: "sam.supervisor@example.org", label: "Sam — Supervisor", landing: "supervisor/fellows" },
  { email: "frankie.faculty@example.org", label: "Frankie — Faculty", landing: "faculty/people" },
] as const;

export function DemoSignIn() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signInAs(email: string, landing: string) {
    setBusy(email);
    setError(null);
    try {
      const response = await fetch("/api/v1/auth/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        const bodyJson = await response.json().catch(() => null);
        setError(bodyJson?.detail ?? "Demo sign-in failed.");
        setBusy(null);
        return;
      }
      const meResponse = await fetch("/api/v1/me");
      const me = meResponse.ok ? await meResponse.json() : null;
      const slug = me?.memberships?.[0]?.tenantSlug as string | undefined;
      window.location.assign(slug ? `/t/${slug}/${landing}` : "/sign-in");
    } catch {
      setError("Demo sign-in failed. Is the stack running?");
      setBusy(null);
    }
  }

  return (
    <section
      aria-labelledby="demo-heading"
      style={{
        marginTop: "var(--space-6)",
        border: "2px dashed var(--rule)",
        padding: "var(--space-4)",
      }}
    >
      <p id="demo-heading" className="stamp" style={{ marginBottom: "var(--space-2)" }}>
        [DEMO MODE] Quick sign-in
      </p>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--disabled-text)", marginBottom: "var(--space-3)" }}>
        Synthetic accounts only. Disable by removing DEMO_LOGIN from the environment.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        {DEMO_ACCOUNTS.map((account) => (
          <button
            key={account.email}
            type="button"
            disabled={busy !== null}
            onClick={() => void signInAs(account.email, account.landing)}
            style={{
              minHeight: "var(--target-min)",
              padding: "0 var(--space-4)",
              background: "var(--paper)",
              color: "var(--ink)",
              border: "2px solid var(--ink)",
              borderRadius: "var(--radius-control)",
              fontWeight: 700,
              textAlign: "left",
            }}
          >
            {busy === account.email ? "Signing in…" : account.label}
          </button>
        ))}
      </div>
      {error ? (
        <p role="alert" style={{ marginTop: "var(--space-3)", fontWeight: 700 }}>
          ERROR: {error}
        </p>
      ) : null}
    </section>
  );
}
