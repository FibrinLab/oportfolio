"use client";

export function SignOutButton() {
  async function onSignOut() {
    await fetch("/api/v1/auth/sign-out", { method: "POST" });
    window.location.assign("/sign-in");
  }

  return (
    <button
      type="button"
      onClick={onSignOut}
      style={{
        minHeight: "var(--target-min)",
        padding: "0 var(--space-5)",
        background: "var(--paper)",
        color: "var(--ink)",
        border: "2px solid var(--ink)",
        borderRadius: "var(--radius-control)",
        fontWeight: 700,
      }}
    >
      Sign out
    </button>
  );
}
