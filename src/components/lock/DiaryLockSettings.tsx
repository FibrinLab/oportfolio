"use client";

import { useState } from "react";
import { useDiaryLock } from "@/lib/crypto/DiaryLockContext";
import { passphraseProblem } from "@/lib/crypto/keys";
import forms from "@/components/ds/forms.module.css";

// Account page controls for the diary lock (ADR-007).

export function DiaryLockSettings() {
  const lock = useDiaryLock();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);

  if (lock.status === "loading" || lock.status === "unavailable") return null;

  async function onChange(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const problem = passphraseProblem(next);
    if (problem) {
      setError(problem);
      return;
    }
    if (next !== confirm) {
      setError("The two new passphrases do not match.");
      return;
    }
    setBusy(true);
    try {
      setRecoveryKey(await lock.changePassphrase(current, next));
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch {
      setError("The current passphrase was not accepted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="lock-heading" style={{ marginBottom: "var(--space-6)", maxWidth: "var(--measure)" }}>
      <h2 id="lock-heading" style={{ marginBottom: "var(--space-2)" }}>
        Diary lock
      </h2>
      <p style={{ marginBottom: "var(--space-3)" }}>
        Status: <span className="stamp">[{lock.status === "unlocked" ? "UNLOCKED" : lock.status === "setup" ? "NOT SET UP" : "LOCKED"}]</span>
        {" "}Your entries, links and files are encrypted in this browser with a key only you hold.
      </p>
      {lock.status === "unlocked" ? (
        <button type="button" className={forms.buttonSecondary} onClick={() => void lock.lock()}>
          Lock diary on this device
        </button>
      ) : null}
      <label className={forms.checkboxRow} style={{ margin: "var(--space-3) 0" }}>
        <input
          type="checkbox"
          checked={lock.rememberDevice}
          onChange={(event) => lock.setRememberDevice(event.target.checked)}
        />
        <span style={{ fontSize: "var(--text-sm)" }}>Keep this device unlocked</span>
      </label>

      {lock.status !== "setup" ? (
        <form onSubmit={onChange} style={{ marginTop: "var(--space-4)" }}>
          <h3 style={{ marginBottom: "var(--space-2)" }}>Change passphrase</h3>
          <p className={forms.hint}>
            Changing the passphrase re-wraps your existing key; nothing is re-encrypted and a
            new recovery key is issued — the old one stops working.
          </p>
          <div className={forms.field}>
            <label htmlFor="lock-current" className={forms.label}>
              Current passphrase
            </label>
            <input id="lock-current" className={forms.input} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div className={forms.field}>
            <label htmlFor="lock-next" className={forms.label}>
              New passphrase
            </label>
            <input id="lock-next" className={forms.input} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          </div>
          <div className={forms.field}>
            <label htmlFor="lock-next-confirm" className={forms.label}>
              Repeat new passphrase
            </label>
            <input id="lock-next-confirm" className={forms.input} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          {error ? (
            <p role="alert" className={forms.error}>
              ERROR: {error}
            </p>
          ) : null}
          <button type="submit" className={forms.buttonPrimary} disabled={busy || !current || !next}>
            {busy ? "Changing…" : "Change passphrase"}
          </button>
          {recoveryKey ? (
            <div role="status" className={forms.notice} style={{ marginTop: "var(--space-3)" }}>
              <p className={forms.noticeTitle}>NEW RECOVERY KEY — save it now, it is shown once</p>
              <p style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.08em", userSelect: "all", wordBreak: "break-all" }}>
                {recoveryKey}
              </p>
            </div>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
