import type { OutboxPayloads } from "@/server/outbox/outbox";

// Implemented in the files phase (upload pipeline). Failing keeps the message
// retrying with backoff; files stay pending_scan and are never downloadable
// until a scanner marks them clean (NFR-A-005).
export async function handleScanAttachment(
  _payload: OutboxPayloads["scan_attachment"],
): Promise<void> {
  throw new Error("scan_attachment handler not yet available");
}
