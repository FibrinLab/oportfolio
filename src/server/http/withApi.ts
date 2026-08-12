import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ZodType } from "zod";
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

function csrfSafe(request: NextRequest): boolean {
  if (!STATE_CHANGING.has(request.method)) return true;
  const origin = request.headers.get("origin");
  if (origin) {
    const own = new URL(process.env.APP_BASE_URL ?? request.nextUrl.origin).origin;
    return origin === own || origin === request.nextUrl.origin;
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
    const requestId = request.headers.get("x-request-id") ?? randomUUID();
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
