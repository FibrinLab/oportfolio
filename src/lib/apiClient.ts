"use client";

// Browser API helper: sends the tenant slug header every /api/v1 call needs
// and surfaces RFC 9457 problem bodies as typed results.

export interface Problem {
  status: number;
  code?: string;
  detail?: string;
  [key: string]: unknown;
}

export type ApiResult<T> = { ok: true; data: T; etag: string | null } | { ok: false; problem: Problem };

export async function api<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    tenantSlug: string;
    ifMatch?: number;
    idempotencyKey?: string;
  },
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-tenant": options.tenantSlug,
  };
  if (options.ifMatch !== undefined) headers["If-Match"] = `"${options.ifMatch}"`;
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

  try {
    const response = await fetch(path, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    if (!response.ok) {
      const problem = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      return { ok: false, problem: { status: response.status, ...problem } };
    }
    const data = (await response.json().catch(() => null)) as T;
    return { ok: true, data, etag: response.headers.get("etag") };
  } catch {
    return { ok: false, problem: { status: 0, detail: "offline" } };
  }
}
