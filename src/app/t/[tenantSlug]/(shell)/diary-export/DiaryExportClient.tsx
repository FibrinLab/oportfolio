"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import forms from "@/components/ds/forms.module.css";

type ExportStatus = "queued" | "processing" | "ready" | "failed" | "superseded" | "expired";

interface ExportView {
  id: string;
  status: ExportStatus;
  kind: "standard" | "final";
  failureDetail: string | null;
  downloadUrl: string | null;
}

export function DiaryExportClient({
  tenantSlug,
  enrolmentId,
  diaryState,
  accessEndsAt,
  initialExport,
}: {
  tenantSlug: string;
  enrolmentId: string;
  diaryState: "open" | "finished" | "purged";
  accessEndsAt: string | null;
  initialExport: ExportView | null;
}) {
  const [currentExport, setCurrentExport] = useState(initialExport);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState("");

  useEffect(() => {
    if (!currentExport || !["queued", "processing"].includes(currentExport.status)) return;
    const timer = window.setInterval(async () => {
      const result = await api<ExportView>(`/api/v1/exports/${currentExport.id}`, {
        tenantSlug,
      });
      if (result.ok) setCurrentExport(result.data);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [currentExport, tenantSlug]);

  async function requestExport() {
    setBusy(true);
    setError(null);
    const result = await api<{ id: string; status: ExportStatus }>("/api/v1/exports", {
      method: "POST",
      tenantSlug,
      body: { enrolmentId },
      idempotencyKey: crypto.randomUUID(),
    });
    if (result.ok) {
      setCurrentExport({
        id: result.data.id,
        status: result.data.status,
        kind: "standard",
        failureDetail: null,
        downloadUrl: null,
      });
    } else {
      setError(String(result.problem.detail ?? "The export could not be requested."));
    }
    setBusy(false);
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
          The ZIP contains a readable PDF, structured JSON, every retained active or archived
          entry, original clean attachments, a manifest, and checksums. Deleted entries, edit
          history, and security logs are excluded.
        </p>
        {diaryState === "open" ? (
          <button className={forms.buttonPrimary} type="button" disabled={busy} onClick={() => void requestExport()}>
            {busy ? "Requesting…" : "Create complete export"}
          </button>
        ) : null}

        {currentExport ? (
          <div aria-live="polite" style={{ marginTop: "var(--space-3)" }}>
            <p className="stamp">[EXPORT {currentExport.status.toUpperCase()}]</p>
            {currentExport.status === "ready" ? (
              <a
                className={forms.buttonPrimary}
                style={{ display: "inline-flex", marginTop: "var(--space-2)" }}
                href={`/api/v1/exports/${currentExport.id}/download?tenant=${encodeURIComponent(tenantSlug)}`}
              >
                Download ZIP
              </a>
            ) : null}
            {currentExport.status === "failed" ? (
              <p role="alert">{currentExport.failureDetail ?? "Export generation failed. Request another export."}</p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section style={{ border: "2px solid var(--ink)", padding: "var(--space-4)" }}>
        <h2 style={{ marginBottom: "var(--space-2)" }}>
          {diaryState === "open" ? "Finish diary" : "Diary finished"}
        </h2>
        {diaryState === "open" ? (
          <p>
            Finishing makes the diary read-only and starts a 90-day download window. You may
            reopen it at any point during that window, which cancels deletion and restores editing.
          </p>
        ) : (
          <p>
            This diary is read-only and is scheduled for deletion
            {accessEndsAt
              ? ` on ${new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(new Date(accessEndsAt))}`
              : " after the export window"}.
            You may reopen it before then.
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
        <button
          type="button"
          className={diaryState === "open" ? forms.buttonPrimary : forms.buttonSecondary}
          disabled={busy || confirmation !== phrase}
          onClick={() => void changeLifecycle(diaryState === "open" ? "finish" : "reopen")}
        >
          {diaryState === "open" ? "Finish my diary" : "Reopen my diary"}
        </button>
      </section>

      {error ? <p role="alert" className={forms.error}>ERROR: {error}</p> : null}
    </>
  );
}
