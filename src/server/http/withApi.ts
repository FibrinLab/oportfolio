import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ZodType } from "zod";
import { getEnv } from "@/server/config/env";
import { getActor, type Actor } from "@/server/policy/actor";
import { problem } from "./problem";

// Shared plumbing for /api/v1 route handlers: request ID, authentication,
// CSRF/origin checks for state changes, zod body parsing, and safe problem
// mapping. Every route goes through here — one enforcement path (spec/12).

export interface ApiContext<TBody> {
  request: NextRequest;
  requestId: string;
  actor: Actor;
  body: TBody;
  params: Record<string, string>;
}

interface ApiOptions<TBody> {
  bodySchema?: ZodType<TBody>;
  // Uniform-response endpoints (auth) skip authentication.
  public?: boolean;
}

type Handler<TBody> = (
  ctx: ApiContext<TBody>,
) => Promise<NextResponse> | NextResponse;

const STATE_CHANGING = new Set(["POST", "PATCH", "PUT", "DELETE"]);

// JSON bodies are small documents (narratives are capped by the schemas);
// anything larger is rejected before parsing so a client cannot make the
// server buffer arbitrary payloads.
const MAX_JSON_BODY_BYTES = 2 * 1024 * 1024;

// Client-supplied request IDs are echoed into logs and response headers, so
// only a conservative token is accepted; anything else gets a fresh UUID.
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

export function requestIdFrom(request: NextRequest): string {
  const supplied = request.headers.get("x-request-id");
  return supplied && REQUEST_ID_PATTERN.test(supplied) ? supplied : randomUUID();
}

// Client IP for rate limiting. Only trusted when the deployment declares how
// many reverse proxies sit in front of the app (TRUSTED_PROXY_HOPS); the
// value at that depth is the one appended by our own proxy, so a client
// cannot pick its own address. Returns null when nothing trustworthy exists.
export function clientIpFrom(request: NextRequest): string | null {
  const hops = getEnv().trustedProxyHops;
  if (hops === 0) return null;
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (!forwardedFor) return null;
  const chain = forwardedFor
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const candidate = chain[chain.length - hops];
  return candidate && candidate.length <= 64 ? candidate : null;
}

function csrfSafe(request: NextRequest): boolean {
  if (!STATE_CHANGING.has(request.method)) return true;
  const origin = request.headers.get("origin");
  if (origin) {
    // Only the configured public origin is trusted. request.nextUrl.origin
    // is derived from Host, which a misconfigured proxy could let a client
    // set, so it is not an acceptable fallback in production.
    const env = getEnv();
    const own = new URL(env.APP_BASE_URL).origin;
    if (origin === own) return true;
    return !env.isProduction && origin === request.nextUrl.origin;
  }
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "same-origin";
  // No browser-context headers at all (curl, tests): require the JSON
  // content type so a cross-site form post can never reach a handler.
  const contentType = request.headers.get("content-type") ?? "";
  return contentType.includes("application/json");
}

export function withApi<TBody = undefined>(
  options: ApiOptions<TBody>,
  handler: Handler<TBody>,
) {
  return async (
    request: NextRequest,
    routeContext: { params: Promise<Record<string, string>> },
  ): Promise<NextResponse> => {
    const requestId = requestIdFrom(request);
    try {
      if (!csrfSafe(request)) {
        return problem("validation-failed", requestId, {
          detail: "Cross-origin request rejected.",
        });
      }

      let actor: Actor | null = null;
      if (!options.public) {
        actor = await getActor();
        if (!actor) return problem("unauthenticated", requestId);
      }

      let body = undefined as TBody;
      if (options.bodySchema) {
        const declaredLength = Number(request.headers.get("content-length") ?? 0);
        if (declaredLength > MAX_JSON_BODY_BYTES) {
          return problem("validation-failed", requestId, {
            detail: "Request body is too large.",
          });
        }
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return problem("validation-failed", requestId, {
            detail: "Request body must be JSON.",
          });
        }
        const parsed = options.bodySchema.safeParse(raw);
        if (!parsed.success) {
          return problem("validation-failed", requestId, {
            errors: parsed.error.issues.map((issue) => ({
              pointer: "/" + issue.path.join("/"),
              message: issue.message,
            })),
          });
        }
        body = parsed.data;
      }

      const params = await routeContext.params;
      const response = await handler({
        request,
        requestId,
        actor: actor as Actor,
        body,
        params,
      });
      response.headers.set("x-request-id", requestId);
      return response;
    } catch (error) {
      // Safe errors only: log server-side with the request ID, return nothing
      // about internals.
      console.error(`[api] ${requestId} ${request.method} ${request.nextUrl.pathname}`, error);
      return problem("internal", requestId);
    }
  };
}
