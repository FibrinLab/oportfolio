import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetEnvForTests } from "@/server/config/env";
import { clientIpFrom, requestIdFrom } from "@/server/http/withApi";

const mutableEnv = process.env as Record<string, string | undefined>;

function req(headers: Record<string, string>) {
  return new NextRequest("http://localhost:3000/api/v1/auth/magic-link", { headers });
}

describe("request plumbing", () => {
  const original = { TRUSTED_PROXY_HOPS: process.env.TRUSTED_PROXY_HOPS, NODE_ENV: process.env.NODE_ENV };
  beforeEach(() => resetEnvForTests());
  afterEach(() => {
    process.env.TRUSTED_PROXY_HOPS = original.TRUSTED_PROXY_HOPS;
    mutableEnv.NODE_ENV = original.NODE_ENV;
    resetEnvForTests();
  });

  it("echoes only well-formed client request IDs", () => {
    expect(requestIdFrom(req({ "x-request-id": "abc-123.DEF_x" }))).toBe("abc-123.DEF_x");
    expect(requestIdFrom(req({ "x-request-id": "bad id <script>" }))).toMatch(/^[0-9a-f-]{36}$/);
    expect(requestIdFrom(req({ "x-request-id": "x".repeat(65) }))).toMatch(/^[0-9a-f-]{36}$/);
    expect(requestIdFrom(req({}))).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("ignores X-Forwarded-For unless a trusted proxy depth is declared", () => {
    mutableEnv.NODE_ENV = "development";
    delete process.env.TRUSTED_PROXY_HOPS;
    expect(clientIpFrom(req({ "x-forwarded-for": "1.2.3.4" }))).toBeNull();
  });

  it("takes the address appended by the nearest trusted proxy, not the client's claim", () => {
    mutableEnv.NODE_ENV = "development";
    process.env.TRUSTED_PROXY_HOPS = "1";
    // A client that forges "9.9.9.9" still ends up rate-limited as 1.2.3.4,
    // the address our own proxy appended.
    expect(clientIpFrom(req({ "x-forwarded-for": "9.9.9.9, 1.2.3.4" }))).toBe("1.2.3.4");
    expect(clientIpFrom(req({ "x-forwarded-for": "1.2.3.4" }))).toBe("1.2.3.4");
    expect(clientIpFrom(req({}))).toBeNull();

    resetEnvForTests();
    process.env.TRUSTED_PROXY_HOPS = "2";
    expect(clientIpFrom(req({ "x-forwarded-for": "9.9.9.9, 1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(clientIpFrom(req({ "x-forwarded-for": "10.0.0.1" }))).toBeNull();
  });
});
