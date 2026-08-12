"use client";

import { useState } from "react";

type State = "idle" | "submitting" | "sent" | "error";

export function SignInForm() {
  const [state, setState] = useState<State>("idle");
  const [email, setEmail] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    try {
      const response = await fetch("/api/v1/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Uniform response regardless of whether the address is registered —
      // no account enumeration (spec/12).
      setState(response.ok || response.status === 429 ? "sent" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <div
        role="status"
        style={{
          borderLeft: "4px solid var(--ink)",
          padding: "var(--space-3) var(--space-4)",
          background: "var(--paper-soft)",
        }}
      >
        <p style={{ fontWeight: 700 }}>NOTE</p>
        <p>
          If that address is registered, a sign-in link has been sent to it. The link
          expires in 15 minutes.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <label htmlFor="email" style={{ display: "block", fontWeight: 700, marginBottom: "var(--space-1)" }}>
        Email address
      </label>
      <p
        id="email-hint"
        style={{ fontSize: "var(--text-sm)", color: "var(--disabled-text)", marginBottom: "var(--space-2)" }}
      >
        Use the address your programme invitation was sent to.
      </p>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        aria-describedby="email-hint"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{
          display: "block",
          width: "100%",
          minHeight: "var(--target-min)",
          border: "2px solid var(--ink)",
          borderRadius: "var(--radius-control)",
          padding: "0 var(--space-3)",
          background: "var(--paper)",
          marginBottom: "var(--space-4)",
        }}
      />
      {state === "error" ? (
        <p role="alert" style={{ marginBottom: "var(--space-3)", fontWeight: 700 }}>
          ERROR: We could not send a sign-in link. Try again in a moment.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={state === "submitting"}
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
        {state === "submitting" ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
