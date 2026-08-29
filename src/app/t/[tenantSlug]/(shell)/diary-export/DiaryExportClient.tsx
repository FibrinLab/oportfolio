"use client";

import { useState } from "react";
import { api } from "@/lib/apiClient";
import { useDiaryLock } from "@/lib/crypto/DiaryLockContext";
import { buildDiaryArchive, type ArchiveProgress } from "@/lib/export/buildArchive";
import forms from "@/components/ds/forms.module.css";

// Export is built in the browser (ADR-007): the server cannot read a sealed
// diary, so it hands over ciphertext and this page decrypts, renders and
// zips locally. Finishing the diary therefore asks the user to download
// first — there is no server-side final copy.

export function DiaryExportClient({
  tenantSlug,
  enrolmentId,
  diaryState,
  accessEndsAt,
}: {
  tenantSlug: string;
  enrolmentId: string;
  diaryState: "open" | "finished" | "purged";
  accessEndsAt: string | null;
}) {
  const lock = useDiaryLock();
  const [progress, setProgress] = useState<ArchiveProgress | null>(null);
  const [built, setBuilt] = useState<{ url: string; filename: string; skipped: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [downloadedFirst, setDownloadedFirst] = useState(false);

  async function buildExport() {
    if (!lock.key) return;
    setBusy(true);
    setError(null);
    setBuilt(null);
    try {
      const result = await buildDiaryArchive({ tenantSlug, enrolmentId, key: lock.key, onProgress: setProgress });
      const url = URL.createObjectURL(result.blob);
      setBuilt({ url, filename: result.filename, skipped: result.skippedFiles });
      await api("/api/v1/exports", {
        method: "POST",
        tenantSlug,
        body: { enrolmentId },
        idempotencyKey: crypto.randomUUID(),
      }).catch(() => undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The export could not be built.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function changeLifecycle(action: "finish" | "reopen") {
    setBusy(true);
    setError(null);
    const phrase = action === "finish" ? "FINISH MY DIARY" : "REOPEN MY DIARY";
    const result = await api<{ exportJobId?: string }>(
      `/api/v1/enrolments/${enrolmentId}/diary/${action}`,
      { method: "POST", tenantSlug, body: { confirmation: phrase } },
    );
    if (result.ok) {
      window.location.reload();
      return;
    }
    setError(String(result.problem.detail ?? `The diary could not be ${action === "finish" ? "finished" : "reopened"}.`));
    setBusy(false);
  }

  if (diaryState === "purged") {
    return <p>Your diary content has been permanently deleted.</p>;
  }

  const phrase = diaryState === "open" ? "FINISH MY DIARY" : "REOPEN MY DIARY";

  return (
    <>
      <section style={{ border: "1px solid var(--rule)", padding: "var(--space-4)", marginBottom: "var(--space-5)" }}>
        <h2 style={{ marginBottom: "var(--space-2)" }}>Download everything</h2>
        <p style={{ marginBottom: "var(--space-3)" }}>
          The ZIP is built here in your browser from your encrypted diary: a readable PDF,
          structured JSON, every retained active or archived entry, your original files, a
          manifest and checksums. Nothing readable is sent to the server. Deleted entries,
          edit history and security logs are excluded.
        </p>
        <button className={forms.buttonPrimary} type="button" disabled={busy || !lock.key} onClick={() => void buildExport()}>
          {busy ? "Building…" : "Build my export"}
        </button>
        {progress ? (
          <p role="status" className="stamp" style={{ marginTop: "var(--space-3)" }}>
            [{progress.step.toUpperCase()}{progress.total ? ` ${progress.done} / ${progress.total}` : ""}]
          </p>
        ) : null}
        {built ? (
          <div aria-live="polite" style={{ marginTop: "var(--space-3)" }}>
            <p className="stamp">[EXPORT READY]</p>
            <a
              className={forms.buttonPrimary}
              style={{ display: "inline-flex", marginTop: "var(--space-2)" }}
              href={built.url}
              download={built.filename}
              onClick={() => setDownloadedFirst(true)}
            >
              Download ZIP
            </a>
            {built.skipped.length > 0 ? (
              <p role="alert" style={{ marginTop: "var(--space-2)" }}>
                {built.skipped.length} file{built.skipped.length === 1 ? " was" : "s were"} not included (still being
                checked or unavailable): {built.skipped.join(", ")}.
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section style={{ border: "2px solid var(--ink)", padding: "var(--space-4)" }}>
        <h2 style={{ marginBottom: "var(--space-2)" }}>
          {diaryState === "open" ? "Finish diary" : "Diary finished"}
        </h2>
        {diaryState === "open" ? (
          <>
            <p>
              Finishing makes the diary read-only and starts a 90-day window after which it is
              permanently deleted. You may reopen it at any point during that window.
            </p>
            <p style={{ marginTop: "var(--space-2)", fontWeight: 700 }}>
              Because your diary is encrypted, no copy can be made for you: download your export
              above before finishing.
            </p>
          </>
        ) : (
          <p>
            This diary is read-only and is scheduled for deletion
            {accessEndsAt
              ? ` on ${new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(new Date(accessEndsAt))}`
              : " after the export window"}.
            You may reopen it before then, and you can still build an export while it exists.
          </p>
        )}
        <div className={forms.field} style={{ marginTop: "var(--space-3)" }}>
          <label className={forms.label} htmlFor="lifecycle-confirmation">
            Type <strong>{phrase}</strong> to confirm
          </label>
          <input
            id="lifecycle-confirmation"
            className={forms.input}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </div>
        {diaryState === "open" ? (
          <label className={forms.checkboxRow} style={{ marginBottom: "var(--space-3)" }}>
            <input type="checkbox" checked={downloadedFirst} onChange={(event) => setDownloadedFirst(event.target.checked)} />
            <span>I have downloaded my export (or I do not want a copy).</span>
          </label>
        ) : null}
        <button
          type="button"
          className={diaryState === "open" ? forms.buttonPrimary : forms.buttonSecondary}
          disabled={busy || confirmation !== phrase || (diaryState === "open" && !downloadedFirst)}
          onClick={() => void changeLifecycle(diaryState === "open" ? "finish" : "reopen")}
        >
          {diaryState === "open" ? "Finish my diary" : "Reopen my diary"}
        </button>
      </section>

      {error ? <p role="alert" className={forms.error}>ERROR: {error}</p> : null}
    </>
  );
}
