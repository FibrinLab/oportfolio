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
  const required = new Set(["privacy_notice", "acceptable_use", "no_patient_data"]);
  const provided = new Set(body.acknowledgedNotices.map((n) => n.noticeType));
  for (const notice of required) {
    if (!provided.has(notice as never)) {
      return problem("validation-failed", requestId, {
        detail: "All required notices must be confirmed before continuing.",
      });
    }
  }
  const result = await consumeMagicLink(getDb(), body.token, requestId, body.acknowledgedNotices);
  if (!result) {
    return problem("validation-failed", requestId, {
      detail: "This sign-in link has expired or was already used. Request a new one.",
    });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, result.sessionToken, sessionCookieOptions());
  return response;
});
