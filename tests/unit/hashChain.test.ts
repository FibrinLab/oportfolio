import { describe, expect, it } from "vitest";
import {
  canonicalJson,
  computeEventHash,
  GENESIS_HASH,
} from "@/server/audit/hashChain";

describe("canonicalJson", () => {
  it("sorts keys recursively and is insertion-order independent", () => {
    const a = canonicalJson({ b: 1, a: { d: 2, c: [3, { f: 4, e: 5 }] } });
    const b = canonicalJson({ a: { c: [3, { e: 5, f: 4 }], d: 2 }, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":{"c":[3,{"e":5,"f":4}],"d":2},"b":1}');
  });
});

describe("computeEventHash", () => {
  const fields = {
    occurredAt: "2026-08-12T10:00:00.000Z",
    actorUserId: "user-1",
    actorType: "user",
    action: "evidence.created",
    targetType: "evidence_item",
    targetId: "item-1",
    enrolmentId: null,
    requestId: "req-1",
    outcome: "success",
    reasonCode: null,
    metadata: { changedFields: ["title"] },
  };

  it("is deterministic and chains on the previous hash", () => {
    const first = computeEventHash(fields, GENESIS_HASH);
    expect(computeEventHash(fields, GENESIS_HASH)).toBe(first);
    const second = computeEventHash(fields, first);
    expect(second).not.toBe(first);
  });

  it("changes when any field changes (tamper detection)", () => {
    const base = computeEventHash(fields, GENESIS_HASH);
    expect(computeEventHash({ ...fields, action: "evidence.updated" }, GENESIS_HASH)).not.toBe(base);
    expect(
      computeEventHash({ ...fields, metadata: { changedFields: ["narrative_doc"] } }, GENESIS_HASH),
    ).not.toBe(base);
  });
});
