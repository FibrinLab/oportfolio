"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/apiClient";
import forms from "@/components/ds/forms.module.css";

export function DiaryEntryActions({
  tenantSlug,
  entryId,
  mode,
}: {
  tenantSlug: string;
  entryId: string;
  mode: "active" | "recoverable";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function transition(action: "archive" | "restore") {
    setBusy(true);
    setError(null);
    const result = await api(`/api/v1/diary-entries/${entryId}/${action}`, {
      method: "POST",
      tenantSlug,
    });
    if (result.ok) {
      router.refresh();
    } else {
      setError(String(result.problem.detail ?? "The entry could not be updated."));
    }
    setBusy(false);
  }

  async function deleteEntry() {
    if (
      !window.confirm(
        "Delete this diary entry? It will be excluded from exports. You can recover it during the deletion grace period if you kept its link.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    const result = await api(`/api/v1/diary-entries/${entryId}`, {
      method: "DELETE",
      tenantSlug,
    });
    if (result.ok) {
      router.push(`/t/${tenantSlug}/log`);
      router.refresh();
      return;
    }
    setError(String(result.problem.detail ?? "The entry could not be deleted."));
    setBusy(false);
  }

  return (
    <div style={{ marginTop: "var(--space-3)" }}>
      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
        {mode === "active" ? (
          <>
            <button
              type="button"
              className={forms.buttonSecondary}
              disabled={busy}
              onClick={() => void transition("archive")}
            >
              Archive entry
            </button>
            <button
              type="button"
              className={forms.buttonTertiary}
              disabled={busy}
              onClick={() => void deleteEntry()}
            >
              Delete entry
            </button>
          </>
        ) : (
          <button
            type="button"
            className={forms.buttonSecondary}
            disabled={busy}
            onClick={() => void transition("restore")}
          >
            Restore entry
          </button>
        )}
      </div>
      {error ? (
        <p role="alert" className={forms.error}>
          ERROR: {error}
        </p>
      ) : null}
    </div>
  );
}
