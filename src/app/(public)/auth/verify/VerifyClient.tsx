"use client";

import { useState } from "react";

type State = "idle" | "verifying" | "failed";

export function VerifyClient({ token }: { token: string }) {
  const [state, setState] = useState<State>("idle");

  async function onContinue() {
    setState("verifying");
    try {
      const verifyResponse = await fetch("/api/v1/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!verifyResponse.ok) {
        setState("failed");
        return;
      }
      const meResponse = await fetch("/api/v1/me");
      const me = meResponse.ok ? await meResponse.json() : null;
      const slug = me?.memberships?.[0]?.tenantSlug as string | undefined;
      window.location.assign(slug ? `/t/${slug}/today` : "/sign-in");
    } catch {
      setState("failed");
    }
  }

  if (state === "failed") {
    return (
      <div role="alert" style={{ borderLeft: "4px solid var(--ink)", paddingLeft: "var(--space-4)" }}>
        <p style={{ fontWeight: 700 }}>ERROR</p>
        <p>
          This sign-in link has expired or was already used.{" "}
          <a href="/sign-in">Request a new sign-in link</a>.
        </p>
      </div>
    );
  }

  return (
    <>
      <p style={{ marginBottom: "var(--space-5)" }}>
        Select continue to finish signing in. This link can be used once.
      </p>
      <button
        type="button"
        onClick={onContinue}
        disabled={state === "verifying"}
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
        {state === "verifying" ? "Signing in…" : "Continue to oPortfolio"}
      </button>
    </>
  );
}
