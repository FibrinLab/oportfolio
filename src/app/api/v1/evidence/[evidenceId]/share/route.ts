import { NextResponse } from "next/server";
import { shareEvidenceRequest } from "@/server/http/apiSchemas";
import { changeVisibility, getEvidenceWithAccess } from "@/server/portfolio/evidence";
import { notFoundProblem, problem } from "@/server/http/problem";
import { withApi } from "@/server/http/withApi";
import { withIdempotency } from "@/server/http/idempotency";
import { resolveTenantForApi } from "@/server/http/tenant";

export const POST = withApi({ bodySchema: shareEvidenceRequest }, async ({ actor, body, params, request, requestId }) => {
  const tenantId = await resolveTenantForApi(actor, request);
  if (!tenantId) return notFoundProblem(requestId);
  const access = await getEvidenceWithAccess(actor, tenantId, params.evidenceId!);
  if (!access || !access.decision.allow) return notFoundProblem(requestId);

  return withIdempotency(request, tenantId, requestId, body, async () => {
    const result = await changeVisibility(actor, access, body.visibility, requestId);
    if (!result.ok) {
      if (result.error === "denied") return notFoundProblem(requestId);
      return problem("invalid-state", requestId);
    }
    return NextResponse.json({ ok: true, visibility: body.visibility });
  });
});
