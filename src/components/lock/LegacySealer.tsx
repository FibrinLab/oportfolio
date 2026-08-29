"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/apiClient";
import { aad, encryptJson, sealFile } from "@/lib/crypto/envelope";
import { useDiaryLock } from "@/lib/crypto/DiaryLockContext";

// One-off migration after unlock (ADR-007): anything the server still holds
// in plaintext for this user is fetched, sealed in the browser and written
// back; the plaintext row is then emptied (entries) or replaced (links,
// files). Failures are non-fatal and retried on the next unlock.

interface Inventory {
  entries: Array<{
    id: string;
    enrolmentId: string;
    tenantSlug: string;
    title: string;
    narrativeDoc: unknown;
    rowVersion: number;
  }>;
  links: Array<{ id: string; evidenceId: string; tenantSlug: string; url: string; host: string; label: string | null; linkType: string }>;
  attachments: Array<{ id: string; evidenceId: string; tenantSlug: string; displayName: string; mediaType: string; sizeBytes: number; scanStatus: string }>;
}

export function LegacySealer() {
  const lock = useDiaryLock();
  const ran = useRef(false);
  const [progress, setProgress] = useState<{ done: number; total: number; failed: number } | null>(null);

  useEffect(() => {
    if (!lock.key || ran.current) return;
    ran.current = true;
    const key = lock.key;
    const kid = lock.keyVersion;
    (async () => {
      const inventory = await api<Inventory>("/api/v1/me/unsealed", { tenantSlug: "" });
      if (!inventory.ok) return;
      const { entries, links, attachments } = inventory.data;
      const eligibleFiles = attachments.filter((a) => a.scanStatus === "clean");
      const total = entries.length + links.length + eligibleFiles.length;
      if (total === 0) return;
      let done = 0;
      let failed = 0;
      setProgress({ done, total, failed });
      const tick = (ok: boolean) => {
        done += 1;
        if (!ok) failed += 1;
        setProgress({ done, total, failed });
      };

      for (const entry of entries) {
        try {
          const contentEnc = {
            title: await encryptJson(key, kid, entry.title, aad.evidenceTitle(entry.id)),
            narrative: await encryptJson(key, kid, entry.narrativeDoc, aad.evidenceNarrative(entry.id)),
          };
          const result = await api(`/api/v1/diary-entries/${entry.id}`, {
            method: "PATCH",
            tenantSlug: entry.tenantSlug,
            ifMatch: entry.rowVersion,
            body: { contentEnc, explicitSave: true },
          });
          tick(result.ok);
        } catch {
          tick(false);
        }
      }

      for (const link of links) {
        try {
          const id = crypto.randomUUID();
          const linkEnc = await encryptJson(key, kid, { url: link.url, host: link.host, label: link.label }, aad.link(id));
          const added = await api(`/api/v1/diary-entries/${link.evidenceId}/links`, {
            method: "POST",
            tenantSlug: link.tenantSlug,
            body: { id, linkEnc, linkType: link.linkType },
          });
          if (added.ok) {
            await api(`/api/v1/diary-entries/${link.evidenceId}/links`, {
              method: "DELETE",
              tenantSlug: link.tenantSlug,
              body: { linkId: link.id },
            });
          }
          tick(added.ok);
        } catch {
          tick(false);
        }
      }

      for (const file of eligibleFiles) {
        try {
          const response = await fetch(
            `/api/v1/attachments/${file.id}/download?tenant=${encodeURIComponent(file.tenantSlug)}&stream=1`,
            { headers: { "x-tenant": file.tenantSlug } },
          );
          if (!response.ok) throw new Error("fetch failed");
          const plain = new Uint8Array(await response.arrayBuffer());
          const attachmentId = crypto.randomUUID();
          const nameEnc = await encryptJson(
            key,
            kid,
            { name: file.displayName, mediaType: file.mediaType, size: plain.length },
            aad.attachmentName(attachmentId),
          );
          const sealed = await sealFile(key, plain, aad.attachmentBytes(attachmentId));
          const initiate = await api<{ attachmentId: string; upload: { url: string; fields: Record<string, string> } }>(
            "/api/v1/attachments/initiate",
            {
              method: "POST",
              tenantSlug: file.tenantSlug,
              body: {
                entryId: file.evidenceId,
                filename: "sealed",
                mediaTypeClaimed: "application/octet-stream",
                sizeBytes: sealed.length,
                patientDataConfirmed: true,
                attachmentId,
                encrypted: true,
                nameEnc,
              },
            },
          );
          if (!initiate.ok) throw new Error("initiate failed");
          const form = new FormData();
          for (const [k, v] of Object.entries(initiate.data.upload.fields)) form.append(k, v);
          form.append("file", new Blob([sealed as BlobPart], { type: "application/octet-stream" }), "sealed");
          const uploaded = await fetch(initiate.data.upload.url, { method: "POST", body: form });
          if (!uploaded.ok) throw new Error("upload failed");
          const completed = await api(`/api/v1/attachments/${attachmentId}/complete`, {
            method: "POST",
            tenantSlug: file.tenantSlug,
            body: {},
          });
          if (!completed.ok) throw new Error("complete failed");
          await api(`/api/v1/attachments/${file.id}`, { method: "DELETE", tenantSlug: file.tenantSlug });
          tick(true);
        } catch {
          tick(false);
        }
      }
    })();
  }, [lock.key, lock.keyVersion]);

  if (!progress) return null;
  const finished = progress.done >= progress.total;
  return (
    <p role="status" className="stamp" style={{ marginBottom: "var(--space-4)" }}>
      {finished
        ? progress.failed > 0
          ? `[SEALED ${progress.total - progress.failed} OF ${progress.total} EXISTING ITEMS — ${progress.failed} WILL BE RETRIED NEXT TIME]`
          : `[ALL ${progress.total} EXISTING ITEMS ARE NOW SEALED]`
        : `[SEALING EXISTING ITEMS ${progress.done} / ${progress.total}…]`}
    </p>
  );
}
