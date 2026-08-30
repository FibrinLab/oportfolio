"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NOTICE_TYPES, NOTICE_VERSION, PRIVACY_NOTICE_PATH } from "@/lib/notices";

type State = "idle" | "verifying" | "failed";

const USED_LINK_MESSAGE =
  "This sign-in link has expired or was already used.";

// Finishing sign-in is also where the notices are confirmed (spec/05,
// docs/dpia.md action 2): a first verified link creates the diary, so this is
// the last moment before any content exists. The server records one row per
// notice version, so confirming again on later sign-ins adds nothing.

export function VerifyClient({ token }: { token: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");
  const [confirmed, setConfirmed] = useState(false);
  const [errorMessage, setErrorMessage] = useState(USED_LINK_MESSAGE);
  const verificationInFlight = useRef(false);

  async function continueToDiary(): Promise<boolean> {
    const meResponse = await fetch("/api/v1/me");
    if (!meResponse.ok) return false;

    const me = await meResponse.json();
    const slug = me?.memberships?.[0]?.tenantSlug as string | undefined;
    if (!slug) return false;

    // Replace removes the bearer-token URL from browser history.
    router.replace(`/t/${slug}/today`);
    return true;
  }

  async function onContinue() {
    // React state is not a synchronous lock. Without this ref, a rapid
    // double-click can submit the one-time token twice: the first request
    // signs in successfully while the second reports that the token is used.
    if (!confirmed || verificationInFlight.current) return;
    verificationInFlight.current = true;
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
        // A previous request may already have completed successfully (for
        // example, an older deployment allowed a double-click). If its
        // session cookie exists, continue instead of showing a false error.
        if (await continueToDiary()) return;

        const problem = (await verifyResponse.json().catch(() => null)) as {
          detail?: unknown;
        } | null;
        setErrorMessage(
          typeof problem?.detail === "string" ? problem.detail : USED_LINK_MESSAGE,
        );
        setState("failed");
        verificationInFlight.current = false;
        return;
      }

      if (!(await continueToDiary())) {
        setErrorMessage("You signed in, but your diary could not be opened. Please try again.");
        setState("failed");
        verificationInFlight.current = false;
      }
    } catch {
      setErrorMessage("We could not finish signing you in. Check your connection and try again.");
      setState("failed");
      verificationInFlight.current = false;
    }
  }

  if (state === "failed") {
    return (
      <div role="alert" style={{ borderLeft: "4px solid var(--ink)", paddingLeft: "var(--space-4)" }}>
        <p style={{ fontWeight: 700 }}>ERROR</p>
        <p>{errorMessage}</p>
        <p>
          <a href="/sign-in">Return to sign-in</a>.
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
