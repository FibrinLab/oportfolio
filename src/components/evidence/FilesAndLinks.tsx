"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/apiClient";
import { aad, encryptJson, sealFile, type Envelope } from "@/lib/crypto/envelope";
import { useDiaryLock } from "@/lib/crypto/DiaryLockContext";
import { checkInitiate } from "@/server/files/uploadPolicy";
import { SealedFileLink, SealedLinkAnchor, useOpenFileMeta, useOpenLink, type SealedFileRow, type SealedLinkRow } from "@/components/lock/Sealed";
import forms from "@/components/ds/forms.module.css";

// Files + links panel (spec/06 evidence form). Everything is sealed in the
// browser before it leaves (ADR-007): files are encrypted into an OPE1
// container and uploaded straight to the quarantine bucket; the real file
// name, type and every link URL travel only inside envelopes. Every upload
// session still requires the no-patient-data confirmation (FR-FI-005).

const SCAN_LABEL: Record<string, string> = {
  awaiting_upload: "[UPLOADING]",
  pending_scan: "[CHECKING]",
  clean: "",
  sealed: "",
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
  initialFiles: SealedFileRow[];
  initialLinks: SealedLinkRow[];
}) {
  const lock = useDiaryLock();
  const [files, setFiles] = useState<SealedFileRow[]>(initialFiles);
  const [links, setLinks] = useState<SealedLinkRow[]>(initialLinks);
  const [patientConfirmed, setPatientConfirmed] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Poll status while anything is pending.
  useEffect(() => {
    if (!files.some((f) => f.scanStatus === "pending_scan" || f.scanStatus === "awaiting_upload")) {
      return;
    }
    const interval = setInterval(async () => {
      const result = await api<{ attachments: SealedFileRow[] }>(
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
    if (!file || !lock.key) return;
    setUploadError(null);
    setUploading(true);
    try {
      // The same allowlist the server applied before encryption existed —
      // now enforced here because the server only sees ciphertext.
      const check = checkInitiate({
        filename: file.name,
        mediaTypeClaimed: file.type || "application/octet-stream",
        sizeBytes: file.size,
        existingCount: files.length,
      });
      if (!check.ok) {
        setUploadError(check.reason ?? "This file was not accepted.");
        return;
      }

      const attachmentId = crypto.randomUUID();
      const plain = new Uint8Array(await file.arrayBuffer());
      const nameEnc = await encryptJson(
        lock.key,
        lock.keyVersion,
        { name: file.name, mediaType: file.type || "application/octet-stream", size: file.size },
        aad.attachmentName(attachmentId),
      );
      const sealed = await sealFile(lock.key, plain, aad.attachmentBytes(attachmentId));

      const initiate = await api<{
        attachmentId: string;
        upload: { url: string; fields: Record<string, string> };
      }>("/api/v1/attachments/initiate", {
        method: "POST",
        tenantSlug,
        body: {
          entryId: evidenceId,
          filename: "sealed",
          mediaTypeClaimed: "application/octet-stream",
          sizeBytes: sealed.length,
          patientDataConfirmed: true,
          attachmentId,
          encrypted: true,
          nameEnc,
        },
      });
      if (!initiate.ok) {
        setUploadError(String(initiate.problem.detail ?? "This file was not accepted."));
        return;
      }

      // Direct browser upload of the sealed bytes to the quarantine bucket.
      const formData = new FormData();
      for (const [key, value] of Object.entries(initiate.data.upload.fields)) {
        formData.append(key, value);
      }
      formData.append("file", new Blob([sealed as BlobPart], { type: "application/octet-stream" }), "sealed");
      const uploadResponse = await fetch(initiate.data.upload.url, { method: "POST", body: formData });
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
          encrypted: true,
          nameEnc,
          displayName: "sealed",
          sizeBytes: sealed.length,
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
    if (!lock.key) return;
    let parsed: URL;
    try {
      parsed = new URL(linkUrl.trim());
    } catch {
      setLinkError("Enter a full link starting with https://");
      return;
    }
    if (parsed.protocol !== "https:") {
      setLinkError("Links must use https.");
      return;
    }
    if (parsed.username || parsed.password) {
      setLinkError("Links must not contain credentials.");
      return;
    }
    const id = crypto.randomUUID();
    const label = linkLabel.trim() || null;
    const linkEnc: Envelope = await encryptJson(
      lock.key,
      lock.keyVersion,
      { url: parsed.toString(), host: parsed.host, label },
      aad.link(id),
    );
    const result = await api<{ id: string }>(`/api/v1/diary-entries/${evidenceId}/links`, {
      method: "POST",
      tenantSlug,
      body: { id, linkEnc },
    });
    if (!result.ok) {
      setLinkError(String(result.problem.detail ?? "The link could not be added."));
      return;
    }
    setLinks((current) => [...current, { id, encrypted: true, linkEnc, url: "", host: "", label: null }]);
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
              <FileRowItem key={file.id} file={file} tenantSlug={tenantSlug} onRemove={() => void onRemoveFile(file.id)} />
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
          disabled={!patientConfirmed || uploading || !lock.key}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? "Encrypting and uploading…" : "Add a file"}
        </button>
        <p className={forms.hint} style={{ marginTop: "var(--space-2)" }}>
          Up to 10 files, 25 MB each. PDF, PNG, JPEG, plain text, Markdown, CSV, DOCX, PPTX.
          Files are encrypted in your browser before upload, so the service cannot open or
          virus-scan them — only attach files you trust.
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
              <LinkRowItem key={link.id} link={link} onRemove={() => void onRemoveLink(link.id)} />
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
          disabled={!linkUrl.trim() || !lock.key}
          onClick={(event) => void onAddLink(event)}
        >
          Add link
        </button>
      </fieldset>
    </div>
  );
}

function FileRowItem({ file, tenantSlug, onRemove }: { file: SealedFileRow; tenantSlug: string; onRemove: () => void }) {
  const meta = useOpenFileMeta(file);
  const name = meta && meta !== "failed" ? meta.name : "file";
  const downloadable = file.scanStatus === "clean" || file.scanStatus === "sealed";
  return (
    <li
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
        {downloadable ? (
          <SealedFileLink file={file} tenantSlug={tenantSlug} />
        ) : (
          <>
            {name} <span className="stamp">{SCAN_LABEL[file.scanStatus] ?? file.scanStatus}</span>
          </>
        )}
      </span>
      <button type="button" className={forms.buttonTertiary} onClick={onRemove}>
        Remove {name}
      </button>
    </li>
  );
}

function LinkRowItem({ link, onRemove }: { link: SealedLinkRow; onRemove: () => void }) {
  const open = useOpenLink(link);
  const name = open && open !== "failed" ? (open.label ?? open.host) : "link";
  return (
    <li
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
        <SealedLinkAnchor link={link} />
      </span>
      <button type="button" className={forms.buttonTertiary} onClick={onRemove}>
        Remove {name}
      </button>
    </li>
  );
}
