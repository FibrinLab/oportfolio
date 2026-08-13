import { NextResponse } from "next/server";
import { verifyRequest } from "@/server/http/apiSchemas";
import { getDb } from "@/server/db/client";
import { consumeMagicLink } from "@/server/identity/magicLink";
import { SESSION_COOKIE, sessionCookieOptions } from "@/server/identity/sessions";
import { problem } from "@/server/http/problem";
import { withApi } from "@/server/http/withApi";

// Consuming the magic link is a POST from the interstitial page — a GET can
// never spend the token, so mail scanners that prefetch links are harmless.
export const POST = withApi({ bodySchema: verifyRequest, public: true }, async ({ body, requestId }) => {
  const result = await consumeMagicLink(getDb(), body.token, requestId);
  if (!result) {
    return problem("validation-failed", requestId, {
      detail: "This sign-in link has expired or was already used. Request a new one.",
    });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, result.sessionToken, sessionCookieOptions());
  return response;
});
