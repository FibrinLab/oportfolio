"use client";

import { useState } from "react";
import { NOTICE_TYPES, NOTICE_VERSION, PRIVACY_NOTICE_PATH } from "@/lib/notices";

type State = "idle" | "verifying" | "failed";

// Finishing sign-in is also where the notices are confirmed (spec/05,
// docs/dpia.md action 2): a first verified link creates the diary, so this is
// the last moment before any content exists. The server records one row per
// notice version, so confirming again on later sign-ins adds nothing.

export function VerifyClient({ token }: { token: string }) {
  const [state, setState] = useState<State>("idle");
  const [confirmed, setConfirmed] = useState(false);

  async function onContinue() {
    if (!confirmed) return;
    setState("verifying");
    try {
      const verifyResponse = await fetch("/api/v1/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          acknowledgedNotices: NOTICE_TYPES.map((noticeType) => ({
            noticeType,
            noticeVersion: NOTICE_VERSION,
          })),
        }),
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
      <p style={{ marginBottom: "var(--space-4)" }}>
        Select continue to finish signing in. This link can be used once.
      </p>
      <div
        style={{
          borderLeft: "4px solid var(--ink)",
          padding: "var(--space-3) var(--space-4)",
          marginBottom: "var(--space-5)",
          background: "var(--paper-soft)",
        }}
      >
        <label style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>
          <input
            type="checkbox"
            name="notices"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            aria-describedby="notices-hint"
            style={{ width: "1.5rem", height: "1.5rem", marginTop: "0.15rem", flexShrink: 0 }}
          />
          <span>
            I have read the{" "}
            <a href={PRIVACY_NOTICE_PATH} target="_blank" rel="noopener">
              privacy notice
            </a>
            , I will not include patient-identifiable information or unnecessary details
            about other people, and I will use the diary only for my own professional
            learning.
          </span>
        </label>
        <p id="notices-hint" style={{ fontSize: "var(--text-sm)", marginTop: "var(--space-2)" }}>
          Required. Your reflections may reveal sensitive things about you; confirming here is
          your explicit consent for the service to hold them, which you can withdraw at any
          time by deleting them.
        </p>
      </div>
      <button
        type="button"
        onClick={onContinue}
        disabled={state === "verifying" || !confirmed}
        aria-disabled={state === "verifying" || !confirmed}
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
