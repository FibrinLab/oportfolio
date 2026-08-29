"use client";

import { useEffect, useState } from "react";
import { aad, decryptJson, openFile, type Envelope } from "@/lib/crypto/envelope";
import { useDiaryLock } from "@/lib/crypto/DiaryLockContext";
import { NarrativeView } from "@/components/evidence/NarrativeView";
import type { NarrativeDoc } from "@/server/portfolio/narrativeDoc";

// Client components that open sealed values with the unlocked diary key
// (ADR-007). Each one falls back to the plaintext column for entries that
// predate encryption and shows a neutral placeholder while decrypting.

type Sealed<T> = { state: "pending" } | { state: "open"; value: T } | { state: "failed" };

export function useSealedJson<T>(envelope: Envelope | null | undefined, aadValue: string): Sealed<T> {
  const lock = useDiaryLock();
  const [result, setResult] = useState<Sealed<T>>({ state: "pending" });
  useEffect(() => {
    let cancelled = false;
    if (!envelope || !lock.key) return;
    decryptJson<T>(lock.key, envelope, aadValue)
      .then((value) => !cancelled && setResult({ state: "open", value }))
      .catch(() => !cancelled && setResult({ state: "failed" }));
    return () => {
      cancelled = true;
    };
  }, [envelope, aadValue, lock.key]);
  return result;
}

export function SealedText({
  envelope,
  aad: aadValue,
  fallback,
}: {
  envelope: Envelope | null | undefined;
  aad: string;
  fallback: string;
}) {
  const sealed = useSealedJson<string>(envelope, aadValue);
  if (!envelope) return <>{fallback}</>;
  if (sealed.state === "open") return <>{sealed.value}</>;
  if (sealed.state === "failed") return <span className="stamp">[CANNOT OPEN]</span>;
  return <span aria-busy="true">…</span>;
}

export function SealedNarrative({
  envelope,
  aad: aadValue,
  fallbackDoc,
}: {
  envelope: Envelope | null | undefined;
  aad: string;
  fallbackDoc: NarrativeDoc | null;
}) {
  const sealed = useSealedJson<NarrativeDoc>(envelope, aadValue);
  if (!envelope) return <NarrativeView doc={fallbackDoc} />;
  if (sealed.state === "open") return <NarrativeView doc={sealed.value} />;
  if (sealed.state === "failed") return <p className="stamp">[CANNOT OPEN THIS ENTRY]</p>;
  return <p aria-busy="true">Opening…</p>;
}

export interface SealedLinkRow {
  id: string;
  encrypted: boolean;
  linkEnc: Envelope | null;
  url: string;
  host: string;
  label: string | null;
}

export interface OpenLink {
  url: string;
  host: string;
  label: string | null;
}

export function useOpenLink(link: SealedLinkRow): OpenLink | null | "failed" {
  const sealed = useSealedJson<OpenLink>(link.encrypted ? link.linkEnc : null, aad.link(link.id));
  if (!link.encrypted) return { url: link.url, host: link.host, label: link.label };
  if (sealed.state === "open") {
    return /^https:\/\//i.test(sealed.value.url) ? sealed.value : "failed";
  }
  return sealed.state === "failed" ? "failed" : null;
}

export function SealedLinkAnchor({ link }: { link: SealedLinkRow }) {
  const open = useOpenLink(link);
  if (open === null) return <span aria-busy="true">…</span>;
  if (open === "failed") return <span className="stamp">[CANNOT OPEN LINK]</span>;
  return (
    <>
      <a href={open.url} target="_blank" rel="noopener noreferrer" data-external>
        {open.label ?? open.host} <span aria-hidden>[↗]</span>
        <span className="visually-hidden">(opens external site)</span>
      </a>{" "}
      <span style={{ color: "var(--disabled-text)" }}>({open.host})</span>
    </>
  );
}

export interface SealedFileRow {
  id: string;
  encrypted: boolean;
  nameEnc: Envelope | null;
  displayName: string;
  sizeBytes: number;
  scanStatus: string;
}

export interface OpenFileMeta {
  name: string;
  mediaType: string;
  size: number;
}

export function useOpenFileMeta(file: SealedFileRow): OpenFileMeta | null | "failed" {
  const sealed = useSealedJson<OpenFileMeta>(file.encrypted ? file.nameEnc : null, aad.attachmentName(file.id));
  if (!file.encrypted) return { name: file.displayName, mediaType: "", size: file.sizeBytes };
  if (sealed.state === "open") return sealed.value;
  return sealed.state === "failed" ? "failed" : null;
}

// Fetches the sealed bytes through the app, opens them with the diary key
// and hands the browser a plain file.
export async function downloadSealedFile(
  key: CryptoKey,
  tenantSlug: string,
  file: { id: string },
  meta: OpenFileMeta,
): Promise<void> {
  const response = await fetch(`/api/v1/attachments/${file.id}/download?tenant=${encodeURIComponent(tenantSlug)}`, {
    headers: { "x-tenant": tenantSlug },
  });
  if (!response.ok) throw new Error("The file could not be fetched.");
  const sealedBytes = new Uint8Array(await response.arrayBuffer());
  const plain = await openFile(key, sealedBytes, aad.attachmentBytes(file.id));
  const url = URL.createObjectURL(new Blob([plain as BlobPart], { type: meta.mediaType || "application/octet-stream" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = meta.name || "file";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function SealedFileLink({ file, tenantSlug }: { file: SealedFileRow; tenantSlug: string }) {
  const lock = useDiaryLock();
  const meta = useOpenFileMeta(file);
  const [error, setError] = useState<string | null>(null);
  if (meta === null) return <span aria-busy="true">…</span>;
  if (meta === "failed") return <span className="stamp">[CANNOT OPEN FILE]</span>;
  if (!file.encrypted) {
    return <a href={`/api/v1/attachments/${file.id}/download?tenant=${tenantSlug}`}>{meta.name}</a>;
  }
  return (
    <>
      <a
        href={`/api/v1/attachments/${file.id}/download?tenant=${tenantSlug}`}
        onClick={(event) => {
          event.preventDefault();
          if (!lock.key) return;
          setError(null);
          void downloadSealedFile(lock.key, tenantSlug, file, meta).catch(() => setError("Download failed."));
        }}
      >
        {meta.name}
      </a>
      {error ? <span role="alert" className="stamp"> [{error}]</span> : null}
    </>
  );
}
