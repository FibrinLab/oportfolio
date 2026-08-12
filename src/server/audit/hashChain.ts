import { createHash } from "node:crypto";

// Hash-chained audit events (spec/05): event_hash = sha256(canonicalJson(fields)
// || previous_event_hash). Canonical JSON = recursively sorted keys, no
// whitespace, so verification is stable across writers.

export const GENESIS_HASH = "0".repeat(64);

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortValue((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

export interface HashedAuditFields {
  occurredAt: string;
  actorUserId: string | null;
  actorType: string;
  action: string;
  targetType: string;
  targetId: string | null;
  enrolmentId: string | null;
  requestId: string | null;
  outcome: string;
  reasonCode: string | null;
  metadata: unknown;
}

export function computeEventHash(fields: HashedAuditFields, previousEventHash: string): string {
  return createHash("sha256")
    .update(canonicalJson(fields))
    .update(previousEventHash)
    .digest("hex");
}
