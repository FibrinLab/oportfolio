"use client";

import { zipSync, type Zippable } from "fflate";
import { api } from "@/lib/apiClient";
import { aad, decryptJson, openFile, sha256Hex, type Envelope } from "@/lib/crypto/envelope";
import { extractPlainText, type NarrativeDoc, type NarrativeNode } from "@/server/portfolio/narrativeDoc";

// Browser-side diary archive (ADR-007): the server hands over metadata and
// ciphertext; everything readable is produced here with the diary key and
// never leaves the device except as the file the user saves. Same layout as
// the former server export: README, diary.pdf, diary.json, attachments/,
// manifest.json, checksums.sha256.

interface Bundle {
  schemaVersion: string;
  exportedAt: string;
  fellow: { displayName: string };
  fellowship: { programme: string; cohort: string; startsOn: string | null; endsOn: string | null };
  entries: Array<{
    id: string;
    encrypted: boolean;
    title: string;
    contentEnc: { title: Envelope; narrative: Envelope } | null;
    body: unknown;
    activityDate: string | null;
    archived: boolean;
    createdAt: string;
    updatedAt: string;
    entryType: { code: string; label: string } | null;
    objectives: Array<{ stableId: string; code: string; title: string; domainCode: string; domainTitle: string }>;
    links: Array<{ id: string; encrypted: boolean; linkEnc: Envelope | null; type: string; url: string; label: string | null; description: string | null }>;
    attachments: Array<{ id: string; encrypted: boolean; nameEnc: Envelope | null; displayName: string; mediaType: string | null; sizeBytes: number; sha256: string | null; scanStatus: string }>;
  }>;
}

export interface ArchiveProgress {
  step: string;
  done: number;
  total: number;
}

const encoder = new TextEncoder();

function safeFilename(value: string): string {
  return value.normalize("NFKC").replace(/[\\/\0-\x1f\x7f]+/g, "_").replace(/^\.+/, "").slice(0, 120) || "attachment";
}

export async function buildDiaryArchive(input: {
  tenantSlug: string;
  enrolmentId: string;
  key: CryptoKey;
  onProgress?: (progress: ArchiveProgress) => void;
}): Promise<{ blob: Blob; filename: string; skippedFiles: string[] }> {
  const { tenantSlug, enrolmentId, key } = input;
  const report = (step: string, done = 0, total = 0) => input.onProgress?.({ step, done, total });

  report("Fetching your diary");
  const bundleResult = await api<Bundle>(`/api/v1/enrolments/${enrolmentId}/export-bundle`, { tenantSlug });
  if (!bundleResult.ok) throw new Error(String(bundleResult.problem.detail ?? "The diary could not be fetched."));
  const bundle = bundleResult.data;

  report("Opening entries", 0, bundle.entries.length);
  const entries = [];
  const skippedFiles: string[] = [];
  const files: Zippable = {};
  const manifestFiles: Array<{ path: string; sizeBytes: number; mediaType: string; sha256: string }> = [];

  for (const [index, entry] of bundle.entries.entries()) {
    const title = entry.encrypted && entry.contentEnc
      ? await decryptJson<string>(key, entry.contentEnc.title, aad.evidenceTitle(entry.id))
      : entry.title;
    const body = entry.encrypted && entry.contentEnc
      ? await decryptJson<NarrativeDoc>(key, entry.contentEnc.narrative, aad.evidenceNarrative(entry.id))
      : (entry.body as NarrativeDoc);
    const links = [];
    for (const link of entry.links) {
      if (link.encrypted && link.linkEnc) {
        const open = await decryptJson<{ url: string; host: string; label: string | null }>(key, link.linkEnc, aad.link(link.id));
        links.push({ type: link.type, url: open.url, label: open.label, description: null });
      } else {
        links.push({ type: link.type, url: link.url, label: link.label, description: link.description });
      }
    }
    const attachments = [];
    for (const file of entry.attachments) {
      if (file.scanStatus !== "clean" && file.scanStatus !== "sealed") {
        skippedFiles.push(file.displayName);
        continue;
      }
      const meta = file.encrypted && file.nameEnc
        ? await decryptJson<{ name: string; mediaType: string; size: number }>(key, file.nameEnc, aad.attachmentName(file.id))
        : { name: file.displayName, mediaType: file.mediaType ?? "application/octet-stream", size: file.sizeBytes };
      report(`Downloading ${meta.name}`, index, bundle.entries.length);
      const response = await fetch(
        `/api/v1/attachments/${file.id}/download?tenant=${encodeURIComponent(tenantSlug)}&stream=1`,
        { headers: { "x-tenant": tenantSlug } },
      );
      if (!response.ok) {
        skippedFiles.push(meta.name);
        continue;
      }
      const raw = new Uint8Array(await response.arrayBuffer());
      if (file.sha256 && (await sha256Hex(raw)) !== file.sha256) {
        skippedFiles.push(meta.name);
        continue;
      }
      const bytes = file.encrypted ? await openFile(key, raw, aad.attachmentBytes(file.id)) : raw;
      const path = `attachments/${entry.id}/${file.id}-${safeFilename(meta.name)}`;
      files[path] = [bytes, { level: 0 }];
      const digest = await sha256Hex(bytes);
      manifestFiles.push({ path, sizeBytes: bytes.length, mediaType: meta.mediaType, sha256: digest });
      attachments.push({ id: file.id, displayName: meta.name, mediaType: meta.mediaType, sizeBytes: bytes.length, sha256: digest });
    }
    entries.push({
      id: entry.id,
      title,
      activityDate: entry.activityDate,
      archived: entry.archived,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      entryType: entry.entryType,
      body,
      bodyText: extractPlainText(body),
      objectives: entry.objectives,
      links,
      attachments,
    });
    report("Opening entries", index + 1, bundle.entries.length);
  }

  report("Rendering PDF");
  const pdfBytes = await renderPdf({ bundle, entries });
  const diaryJson = encoder.encode(
    `${JSON.stringify(
      {
        schemaVersion: bundle.schemaVersion,
        exportedAt: bundle.exportedAt,
        fellow: bundle.fellow,
        fellowship: bundle.fellowship,
        entries,
      },
      null,
      2,
    )}\n`,
  );
  const readme = encoder.encode(
    [
      "oPortfolio private diary export (built in your browser)",
      "",
      "diary.pdf is the human-readable diary.",
      "diary.json is the schema-versioned portable record.",
      "attachments/ contains the original files attached to retained entries.",
      "manifest.json describes each file and checksums.sha256 verifies its contents.",
      "",
      "This archive was decrypted and assembled on your own device: the service that",
      "stores your diary only ever held encrypted data and cannot produce this file.",
      "Deleted entries, edit history, sessions and security audit data are not included.",
      "This archive may contain sensitive personal reflection. Store it securely.",
      "",
    ].join("\n"),
  );
  const payload = [
    { path: "README.txt", bytes: readme, mediaType: "text/plain" },
    { path: "diary.pdf", bytes: pdfBytes, mediaType: "application/pdf" },
    { path: "diary.json", bytes: diaryJson, mediaType: "application/json" },
  ];
  for (const file of payload) {
    files[file.path] = file.bytes;
    manifestFiles.unshift({ path: file.path, sizeBytes: file.bytes.length, mediaType: file.mediaType, sha256: await sha256Hex(file.bytes) });
  }
  // Keep README/pdf/json first in the manifest, then attachments.
  manifestFiles.sort((a, b) => (a.path.startsWith("attachments/") ? 1 : 0) - (b.path.startsWith("attachments/") ? 1 : 0));
  const manifest = encoder.encode(
    `${JSON.stringify(
      {
        schemaVersion: "1.0.0",
        exportKind: "browser",
        generatedAt: new Date().toISOString(),
        included: ["active entries", "archived entries", "links", "curriculum links", "attachments"],
        excluded: ["deleted entries", "revision history", "audit and security data"],
        files: manifestFiles,
      },
      null,
      2,
    )}\n`,
  );
  files["manifest.json"] = manifest;
  const checksums = [...manifestFiles, { path: "manifest.json", sha256: await sha256Hex(manifest) }]
    .map((file) => `${file.sha256}  ${file.path}`)
    .join("\n");
  files["checksums.sha256"] = encoder.encode(`${checksums}\n`);

  report("Compressing");
  const zipped = zipSync(files, { level: 6 });
  return {
    blob: new Blob([zipped as BlobPart], { type: "application/zip" }),
    filename: `diary-export-${bundle.exportedAt.slice(0, 10)}.zip`,
    skippedFiles,
  };
}

// Plain, readable PDF: title page, then one section per entry. Text only,
// laid out with jsPDF's built-in Helvetica so no fonts are fetched.
async function renderPdf(input: {
  bundle: Bundle;
  entries: Array<{
    title: string;
    activityDate: string | null;
    archived: boolean;
    entryType: { code: string; label: string } | null;
    body: NarrativeDoc;
    objectives: Array<{ code: string; title: string }>;
    links: Array<{ url: string; label: string | null }>;
    attachments: Array<{ displayName: string }>;
  }>;
}): Promise<Uint8Array> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 56;
  const width = pageWidth - margin * 2;
  let y = margin;

  const ensure = (height: number) => {
    if (y + height > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };
  const text = (value: string, size: number, style: "normal" | "bold" | "italic" = "normal", indent = 0) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(value, width - indent) as string[];
    const lineHeight = size * 1.35;
    for (const line of lines) {
      ensure(lineHeight);
      doc.text(line, margin + indent, y);
      y += lineHeight;
    }
  };
  const gap = (height: number) => {
    y += height;
  };

  text("oPortfolio — private diary", 22, "bold");
  gap(8);
  text(input.bundle.fellow.displayName, 14);
  text(`${input.bundle.fellowship.programme} · ${input.bundle.fellowship.cohort}`, 11);
  text(`Exported ${new Date(input.bundle.exportedAt).toLocaleString("en-GB")} — decrypted and rendered in the author's browser.`, 10, "italic");
  gap(12);
  text(
    "This is a personal, private reflective record. It is not a patient record, a competency decision or an assessment. Handle it as sensitive personal data.",
    10,
  );

  for (const entry of input.entries) {
    doc.addPage();
    y = margin;
    text(entry.title || "(untitled)", 16, "bold");
    const meta = [
      entry.activityDate ? `Activity ${entry.activityDate}` : null,
      entry.entryType?.label ?? null,
      entry.archived ? "Archived" : null,
    ]
      .filter(Boolean)
      .join(" · ");
    if (meta) text(meta, 10, "italic");
    gap(8);
    renderNodes(entry.body.content, 0);
    if (entry.objectives.length) {
      gap(8);
      text("Mapped objectives (organisational aids, not proof of competence)", 11, "bold");
      for (const objective of entry.objectives) text(`• ${objective.code} ${objective.title}`, 10, "normal", 12);
    }
    if (entry.links.length) {
      gap(8);
      text("Links", 11, "bold");
      for (const link of entry.links) text(`• ${link.label ? `${link.label}: ` : ""}${link.url}`, 10, "normal", 12);
    }
    if (entry.attachments.length) {
      gap(8);
      text("Attached files (in attachments/)", 11, "bold");
      for (const file of entry.attachments) text(`• ${file.displayName}`, 10, "normal", 12);
    }
  }

  function inline(nodes: NarrativeNode[] | undefined): string {
    return (nodes ?? [])
      .map((node) => (node.type === "hardBreak" ? "\n" : node.type === "text" ? (node.text ?? "") : inline(node.content)))
      .join("");
  }
  function renderNodes(nodes: NarrativeNode[] | undefined, depth: number, ordered = false) {
    let counter = 0;
    for (const node of nodes ?? []) {
      switch (node.type) {
        case "paragraph":
          text(inline(node.content) || " ", 10.5, "normal", depth * 14);
          gap(4);
          break;
        case "heading":
          gap(4);
          text(inline(node.content), node.attrs?.level === 3 ? 12 : 13, "bold", depth * 14);
          break;
        case "bulletList":
          renderNodes(node.content, depth + 1, false);
          break;
        case "orderedList":
          renderNodes(node.content, depth + 1, true);
          break;
        case "listItem": {
          counter += 1;
          const marker = ordered ? `${counter}. ` : "• ";
          const [first, ...rest] = node.content ?? [];
          text(marker + (first ? inline(first.content) : ""), 10.5, "normal", depth * 14);
          renderNodes(rest, depth + 1);
          break;
        }
        default:
          break;
      }
    }
  }

  return new Uint8Array(doc.output("arraybuffer"));
}
