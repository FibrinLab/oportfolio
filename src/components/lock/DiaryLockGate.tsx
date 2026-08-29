"use client";

import { useState } from "react";
import { useDiaryLock } from "@/lib/crypto/DiaryLockContext";
import { passphraseProblem } from "@/lib/crypto/keys";
import forms from "@/components/ds/forms.module.css";
import { LegacySealer } from "./LegacySealer";

// Gate that each diary page wraps its content in, AFTER its own
// server-side authorization (ADR-007): first visit sets up the diary
// passphrase and shows the one-time recovery key; later visits unlock.
// Pages keep their uniform not-found behaviour because the gate sits inside
// the page tree, not around it.

export function DiaryLockGate({ children }: { children: React.ReactNode }) {
  const lock = useDiaryLock();
  // The recovery key is shown by the gate, not the setup form: setup flips
  // the store to "unlocked" immediately, and the key must stay on screen
  // until the user confirms they have stored it.
  const [pendingRecoveryKey, setPendingRecoveryKey] = useState<string | null>(null);
  // Between "setup submitted" and "recovery key known" the store is already
  // unlocked; hold the diary back until the key has been shown.
  const [creating, setCreating] = useState(false);

  switch (lock.status) {
    case "loading":
      return <p aria-busy="true">Checking your diary lock…</p>;
    case "unavailable":
      return (
        <p role="alert" className={forms.error}>
          ERROR: The diary lock could not be loaded. Reload the page or sign in again.
        </p>
      );
    case "setup":
      return (
        <SetupScreen
          onCreating={() => setCreating(true)}
          onCreated={(recoveryKey) => {
            setPendingRecoveryKey(recoveryKey);
            setCreating(false);
          }}
        />
      );
    case "locked":
      return <UnlockScreen />;
    case "unlocked":
      if (pendingRecoveryKey) {
        return <RecoveryKeyScreen recoveryKey={pendingRecoveryKey} onDone={() => setPendingRecoveryKey(null)} />;
      }
      if (creating) return <p aria-busy="true">Creating your diary lock…</p>;
      return (
        <>
          <LegacySealer />
          {children}
        </>
      );
  }
}

function RecoveryKeyScreen({ recoveryKey, onDone }: { recoveryKey: string; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <section aria-labelledby="recovery-heading" style={{ maxWidth: "var(--measure)" }}>
      <p className="stamp">[DIARY LOCK CREATED]</p>
      <h1 id="recovery-heading" style={{ margin: "var(--space-2) 0" }}>
        Save your recovery key now
      </h1>
      <p style={{ marginBottom: "var(--space-3)" }}>
        This is the only other way into your diary if you forget your passphrase. It is
        shown once. Nobody — including the person who runs this service — can recover
        your diary without it.
      </p>
      <p
        aria-label="Recovery key"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-lg, 1.25rem)",
          letterSpacing: "0.08em",
          border: "2px solid var(--ink)",
          padding: "var(--space-3) var(--space-4)",
          userSelect: "all",
          wordBreak: "break-all",
        }}
      >
        {recoveryKey}
      </p>
      <div style={{ display: "flex", gap: "var(--space-2)", margin: "var(--space-3) 0", flexWrap: "wrap" }}>
        <button
          type="button"
          className={forms.buttonSecondary}
          onClick={() => {
            void navigator.clipboard?.writeText(recoveryKey).then(() => setCopied(true));
          }}
        >
          {copied ? "Copied" : "Copy recovery key"}
        </button>
        <a
          className={forms.buttonSecondary}
          style={{ display: "inline-flex", alignItems: "center" }}
          download="oportfolio-recovery-key.txt"
          href={`data:text/plain;charset=utf-8,${encodeURIComponent(
            `oPortfolio diary recovery key\n\n${recoveryKey}\n\nKeep this somewhere safe and private. It unlocks your diary if you forget your passphrase.\n`,
          )}`}
        >
          Download as text file
        </a>
      </div>
      <label className={forms.checkboxRow}>
        <input type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)} />
        <span>I have stored my recovery key somewhere safe.</span>
      </label>
      <button
        type="button"
        className={forms.buttonPrimary}
        disabled={!saved}
        onClick={onDone}
        style={{ marginTop: "var(--space-3)" }}
      >
        Open my diary
      </button>
    </section>
  );
}

function SetupScreen({
  onCreating,
  onCreated,
}: {
  onCreating: () => void;
  onCreated: (recoveryKey: string) => void;
}) {
  const lock = useDiaryLock();
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const problem = passphraseProblem(passphrase);
    if (problem) {
      setError(problem);
      return;
    }
    if (passphrase !== confirm) {
      setError("The two passphrases do not match.");
      return;
    }
    setBusy(true);
    onCreating();
    try {
      const created = await lock.setup(passphrase);
      onCreated(created);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The diary lock could not be created.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} aria-labelledby="setup-heading" style={{ maxWidth: "var(--measure)" }}>
      <p className="stamp">[END-TO-END ENCRYPTION]</p>
      <h1 id="setup-heading" style={{ margin: "var(--space-2) 0" }}>
        Create your diary passphrase
      </h1>
      <p style={{ marginBottom: "var(--space-3)" }}>
        Everything you write is encrypted in your browser before it is sent. The passphrase
        never leaves your device, so the service cannot read your diary — and cannot reset
        this passphrase for you. You will get a recovery key next.
      </p>
      <div className={forms.field}>
        <label htmlFor="lock-passphrase" className={forms.label}>
          Passphrase
        </label>
        <p className={forms.hint}>At least 12 characters. A short sentence is easier to remember than symbols.</p>
        <input
          id="lock-passphrase"
          className={forms.input}
          type="password"
          autoComplete="new-password"
          value={passphrase}
          onChange={(event) => setPassphrase(event.target.value)}
        />
      </div>
      <div className={forms.field}>
        <label htmlFor="lock-confirm" className={forms.label}>
          Repeat passphrase
        </label>
        <input
          id="lock-confirm"
          className={forms.input}
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
      </div>
      <RememberDevice />
      {error ? (
        <p role="alert" className={forms.error}>
          ERROR: {error}
        </p>
      ) : null}
      <button type="submit" className={forms.buttonPrimary} disabled={busy}>
        {busy ? "Creating…" : "Create diary lock"}
      </button>
    </form>
  );
}

function UnlockScreen() {
  const lock = useDiaryLock();
  const [secret, setSecret] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await lock.unlock(secret, useRecovery ? "recovery" : "passphrase");
    } catch {
      setError(
        useRecovery
          ? "That recovery key did not open the diary. Check every character."
          : "That passphrase did not open the diary.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} aria-labelledby="unlock-heading" style={{ maxWidth: "var(--measure)" }}>
      <p className="stamp">[LOCKED]</p>
      <h1 id="unlock-heading" style={{ margin: "var(--space-2) 0" }}>
        Unlock your diary
      </h1>
      <p style={{ marginBottom: "var(--space-3)" }}>
        Your entries are encrypted; enter your {useRecovery ? "recovery key" : "passphrase"} to open
        them on this device.
      </p>
      <div className={forms.field}>
        <label htmlFor="unlock-secret" className={forms.label}>
          {useRecovery ? "Recovery key" : "Passphrase"}
        </label>
        <input
          id="unlock-secret"
          className={forms.input}
          type={useRecovery ? "text" : "password"}
          autoComplete={useRecovery ? "off" : "current-password"}
          value={secret}
          onChange={(event) => setSecret(event.target.value)}
        />
      </div>
      <RememberDevice />
      {error ? (
        <p role="alert" className={forms.error}>
          ERROR: {error}
        </p>
      ) : null}
      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
        <button type="submit" className={forms.buttonPrimary} disabled={busy || !secret}>
          {busy ? "Unlocking…" : "Unlock"}
        </button>
        <button
          type="button"
          className={forms.buttonTertiary}
          onClick={() => {
            setUseRecovery((value) => !value);
            setSecret("");
            setError(null);
          }}
        >
          {useRecovery ? "Use my passphrase instead" : "I forgot my passphrase — use recovery key"}
        </button>
      </div>
    </form>
  );
}

function RememberDevice() {
  const lock = useDiaryLock();
  return (
    <label className={forms.checkboxRow} style={{ marginBottom: "var(--space-3)" }}>
      <input
        type="checkbox"
        checked={lock.rememberDevice}
        onChange={(event) => lock.setRememberDevice(event.target.checked)}
      />
      <span style={{ fontSize: "var(--text-sm)" }}>
        Keep this device unlocked after I sign out or 12 hours pass (the key stays in this
        browser only; leave unticked on shared computers)
      </span>
    </label>
  );
}
