import { NextResponse } from "next/server";
import { acceptInvitationRequest } from "@/server/http/apiSchemas";
import { getDb } from "@/server/db/client";
import { acceptInvitation } from "@/server/identity/invitations";
import { SESSION_COOKIE, sessionCookieOptions } from "@/server/identity/sessions";
import { problem } from "@/server/http/problem";
import { withApi } from "@/server/http/withApi";

export const POST = withApi({ bodySchema: acceptInvitationRequest, public: true }, async ({ body, requestId }) => {
  const required = new Set(["privacy_notice", "acceptable_use", "no_patient_data"]);
  const provided = new Set(body.acknowledgedNotices.map((n) => n.noticeType));
  for (const notice of required) {
    if (!provided.has(notice as never)) {
      return problem("validation-failed", requestId, {
        detail: "All required notices must be confirmed before continuing.",
      });
    }
  }

  const result = await acceptInvitation(getDb(), {
    token: body.token,
    preferredName: body.preferredName,
    professionalGroup: body.professionalGroup,
    homeSpecialtyOrRole: body.homeSpecialtyOrRole,
    organisation: body.organisation,
    acknowledgedNotices: body.acknowledgedNotices,
    requestId,
  });
  if (!result) {
    return problem("validation-failed", requestId, {
      detail:
        "This invitation has expired or was already used. Contact your programme team for a new invitation.",
    });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, result.sessionToken, sessionCookieOptions());
  return response;
});
