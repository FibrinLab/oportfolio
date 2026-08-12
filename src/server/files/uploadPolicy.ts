// Upload policy (spec/07, pilot defaults in policy_set): allowlisted
// extensions and media types, size and count limits. Extension AND detected
// MIME must both pass; a mismatch quarantines (P5 risk #2: OOXML nuance).

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_FILES_PER_ITEM = 10;

export const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "txt",
  "md",
  "csv",
  "docx",
  "pptx",
]);

// Claimed media types accepted at initiate time.
export const ALLOWED_CLAIMED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

// Extensions whose content has magic bytes `file-type` can detect.
export const BINARY_EXPECTATIONS: Record<string, string[]> = {
  pdf: ["application/pdf"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    // Some real OOXML files detect as bare zip; the worker then inspects the
    // zip central directory before accepting (risk #2).
    "application/zip",
  ],
  pptx: [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/zip",
  ],
};

// txt/md/csv have no magic bytes: must be valid UTF-8 with no NUL bytes.
export const TEXT_EXTENSIONS = new Set(["txt", "md", "csv"]);

export interface InitiateCheck {
  ok: boolean;
  reason?: string;
  extension?: string;
}

export function checkInitiate(input: {
  filename: string;
  mediaTypeClaimed: string;
  sizeBytes: number;
  existingCount: number;
}): InitiateCheck {
  if (input.sizeBytes <= 0) return { ok: false, reason: "Empty files are not accepted." };
  if (input.sizeBytes > MAX_FILE_BYTES) {
    return { ok: false, reason: "Files must be 25 MB or smaller." };
  }
  if (input.existingCount >= MAX_FILES_PER_ITEM) {
    return { ok: false, reason: `An entry can have at most ${MAX_FILES_PER_ITEM} files.` };
  }
  const extension = input.filename.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return {
      ok: false,
      reason:
        "This file type is not accepted. Allowed: PDF, PNG, JPEG, plain text, Markdown, CSV, DOCX, PPTX.",
    };
  }
  // Double extensions like report.pdf.exe never get here (last segment wins),
  // but reject anything with an executable-looking inner extension anyway.
  if (/\.(exe|js|vbs|bat|cmd|sh|dll|scr|msi)\./i.test(input.filename)) {
    return { ok: false, reason: "This file name is not accepted." };
  }
  if (!ALLOWED_CLAIMED_TYPES.has(input.mediaTypeClaimed)) {
    return { ok: false, reason: "This media type is not accepted." };
  }
  return { ok: true, extension };
}

export function isValidTextContent(buffer: Buffer): boolean {
  if (buffer.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}
