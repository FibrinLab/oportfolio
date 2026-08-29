"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/apiClient";
import forms from "@/components/ds/forms.module.css";

// Files + links panel (spec/06 evidence form): direct-to-quarantine upload
// with visible scan status, and HTTPS-only external links with the host
// shown before save. Every upload session requires the no-patient-data
// confirmation (FR-FI-005).

interface FileRow {
  id: string;
  displayName: string;
  sizeBytes: number;
  scanStatus: string;
}

interface LinkRow {
  id: string;
  url: string;
  host: string;
  label: string | null;
}

const SCAN_LABEL: Record<string, string> = {
  awaiting_upload: "[UPLOADING]",
  pending_scan: "[SCANNING]",
  clean: "",
  rejected: "[BLOCKED — file failed safety checks]",
  quarantined: "[BLOCKED — file failed safety checks]",
};

export function FilesAndLinks({
  tenantSlug,
  evidenceId,
  initialFiles,
  initialLinks,
}: {
  tenantSlug: string;
  evidenceId: string;
  initialFiles: FileRow[];
  initialLinks: LinkRow[];
}) {
  const [files, setFiles] = useState<FileRow[]>(initialFiles);
  const [links, setLinks] = useState<LinkRow[]>(initialLinks);
  const [patientConfirmed, setPatientConfirmed] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Poll scan status while anything is pending.
  useEffect(() => {
    if (!files.some((f) => f.scanStatus === "pending_scan" || f.scanStatus === "awaiting_upload")) {
      return;
    }
    const interval = setInterval(async () => {
      const result = await api<{ attachments: FileRow[] }>(
        `/api/v1/diary-entries/${evidenceId}/attachments`,
        { tenantSlug },
      );
      if (result.ok) setFiles(result.data.attachments);
    }, 3000);
    return () => clearInterval(interval);
  }, [files, evidenceId, tenantSlug]);

  async function onPickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const initiate = await api<{
        attachmentId: string;
        upload: { url: string; fields: Record<string, string> };
      }>("/api/v1/attachments/initiate", {
        method: "POST",
        tenantSlug,
        body: {
          entryId: evidenceId,
          filename: file.name,
          mediaTypeClaimed: file.type || "application/octet-stream",
          sizeBytes: file.size,
          patientDataConfirmed: true,
        },
      });
      if (!initiate.ok) {
        setUploadError(String(initiate.problem.detail ?? "This file was not accepted."));
        return;
      }

      // Direct browser upload to the quarantine bucket (presigned POST).
      const formData = new FormData();
      for (const [key, value] of Object.entries(initiate.data.upload.fields)) {
        formData.append(key, value);
      }
      formData.append("file", file);
      const uploadResponse = await fetch(initiate.data.upload.url, {
        method: "POST",
        body: formData,
      });
      if (!uploadResponse.ok) {
        setUploadError("The upload failed. Try again.");
        return;
      }

      const complete = await api<{ ok: boolean }>(
        `/api/v1/attachments/${initiate.data.attachmentId}/complete`,
        { method: "POST", tenantSlug, body: {} },
      );
      if (!complete.ok) {
        setUploadError("The upload could not be confirmed. Try again.");
        return;
      }
      setFiles((current) => [
        ...current,
        {
          id: initiate.data.attachmentId,
          displayName: file.name,
          sizeBytes: file.size,
          scanStatus: "pending_scan",
        },
      ]);
    } finally {
      setUploading(false);
    }
  }

  async function onRemoveFile(id: string) {
    const result = await api(`/api/v1/attachments/${id}`, { method: "DELETE", tenantSlug });
    if (result.ok) setFiles((current) => current.filter((f) => f.id !== id));
  }

  async function onAddLink(event: React.FormEvent) {
    event.preventDefault();
    setLinkError(null);
    const result = await api<{ id: string; host: string }>(
      `/api/v1/diary-entries/${evidenceId}/links`,
      {
        method: "POST",
        tenantSlug,
        body: { url: linkUrl.trim(), label: linkLabel.trim() || undefined },
      },
    );
    if (!result.ok) {
      setLinkError(String(result.problem.detail ?? "The link could not be added."));
      return;
    }
    setLinks((current) => [
      ...current,
      { id: result.data.id, url: linkUrl.trim(), host: result.data.host, label: linkLabel.trim() || null },
    ]);
    setLinkUrl("");
    setLinkLabel("");
  }

  async function onRemoveLink(linkId: string) {
    const result = await api(`/api/v1/diary-entries/${evidenceId}/links`, {
      method: "DELETE",
      tenantSlug,
      body: { linkId },
    });
    if (result.ok) setLinks((current) => current.filter((l) => l.id !== linkId));
  }

  return (
    <div>
      <fieldset style={{ border: "1px solid var(--rule)", padding: "var(--space-3)", marginBottom: "var(--space-4)" }}>
        <legend style={{ fontWeight: 700, padding: "0 var(--space-2)" }}>Files</legend>

        {files.length > 0 ? (
          <ul style={{ listStyle: "none", padding: 0, marginBottom: "var(--space-3)" }}>
            {files.map((file) => (
              <li
                key={file.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  borderBottom: "1px solid var(--rule)",
                  padding: "var(--space-2) 0",
                  fontSize: "var(--text-sm)",
                }}
              >
                <span>
                  {file.scanStatus === "clean" ? (
                    <a href={`/api/v1/attachments/${file.id}/download?tenant=${tenantSlug}`}>
                      {file.displayName}
                    </a>
                  ) : (
                    <>
                      {file.displayName}{" "}
                      <span className="stamp">{SCAN_LABEL[file.scanStatus] ?? file.scanStatus}</span>
                    </>
                  )}
                </span>
                <button type="button" className={forms.buttonTertiary} onClick={() => void onRemoveFile(file.id)}>
                  Remove {file.displayName}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <label className={forms.checkboxRow}>
          <input
            type="checkbox"
            checked={patientConfirmed}
            onChange={(event) => setPatientConfirmed(event.target.checked)}
          />
          <span style={{ fontSize: "var(--text-sm)" }}>
            This file contains no patient-identifiable data.
          </span>
        </label>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.txt,.md,.csv,.docx,.pptx"
          onChange={onPickFile}
          className="visually-hidden"
          id="file-upload-input"
        />
        <button
          type="button"
          className={forms.buttonSecondary}
          disabled={!patientConfirmed || uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? "Uploading…" : "Add a file"}
        </button>
        <p className={forms.hint} style={{ marginTop: "var(--space-2)" }}>
          Up to 10 files, 25 MB each. PDF, PNG, JPEG, plain text, Markdown, CSV, DOCX, PPTX.
          Files are safety-checked before they can be opened or included in an export.
        </p>
        {uploadError ? (
          <p role="alert" className={forms.error}>
            ERROR: {uploadError}
          </p>
        ) : null}
      </fieldset>

      <fieldset style={{ border: "1px solid var(--rule)", padding: "var(--space-3)", marginBottom: "var(--space-4)" }}>
        <legend style={{ fontWeight: 700, padding: "0 var(--space-2)" }}>Links</legend>

        {links.length > 0 ? (
          <ul style={{ listStyle: "none", padding: 0, marginBottom: "var(--space-3)" }}>
            {links.map((link) => (
              <li
                key={link.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  borderBottom: "1px solid var(--rule)",
                  padding: "var(--space-2) 0",
                  fontSize: "var(--text-sm)",
                }}
              >
                <span>
                  <a href={link.url} target="_blank" rel="noopener noreferrer" data-external>
                    {link.label ?? link.host} <span aria-hidden>[↗]</span>
                    <span className="visually-hidden">(opens external site)</span>
                  </a>{" "}
                  <span style={{ color: "var(--disabled-text)" }}>({link.host})</span>
                </span>
                <button
                  type="button"
                  className={forms.buttonTertiary}
                  onClick={() => void onRemoveLink(link.id)}
                >
                  Remove {link.label ?? link.host}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className={forms.field}>
          <label htmlFor="link-url" className={forms.label} style={{ fontSize: "var(--text-sm)" }}>
            Link address (https://…)
          </label>
          <input
            id="link-url"
            className={forms.input}
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            placeholder="https://github.com/…"
          />
          {linkUrl.trim().startsWith("https://") ? (
            <p className={forms.hint} style={{ marginTop: "var(--space-1)" }}>
              Destination: {(() => {
                try {
                  return new URL(linkUrl.trim()).host;
                } catch {
                  return "…";
                }
              })()}
            </p>
          ) : null}
        </div>
        <div className={forms.field}>
          <label htmlFor="link-label" className={forms.label} style={{ fontSize: "var(--text-sm)" }}>
            Label
          </label>
          <input
            id="link-label"
            className={forms.input}
            maxLength={160}
            value={linkLabel}
            onChange={(event) => setLinkLabel(event.target.value)}
          />
        </div>
        {linkError ? (
          <p role="alert" className={forms.error}>
            ERROR: {linkError}
          </p>
        ) : null}
        <button
          type="button"
          className={forms.buttonSecondary}
          disabled={!linkUrl.trim()}
          onClick={(event) => void onAddLink(event)}
        >
          Add link
        </button>
      </fieldset>
    </div>
  );
}
