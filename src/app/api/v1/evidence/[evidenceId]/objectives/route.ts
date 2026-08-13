import { NextResponse } from "next/server";
import { setObjectivesRequest } from "@/server/http/apiSchemas";
import { getEvidenceWithAccess, setObjectives } from "@/server/portfolio/evidence";
import { notFoundProblem, problem } from "@/server/http/problem";
import { withApi } from "@/server/http/withApi";
import { resolveTenantForApi } from "@/server/http/tenant";

export const PUT = withApi({ bodySchema: setObjectivesRequest }, async ({ actor, body, params, request, requestId }) => {
  const tenantId = await resolveTenantForApi(actor, request);
  if (!tenantId) return notFoundProblem(requestId);
  const access = await getEvidenceWithAccess(actor, tenantId, params.evidenceId!);
  if (!access || !access.decision.allow) return notFoundProblem(requestId);

  const result = await setObjectives(actor, access, body.objectiveIds, requestId);
  if (!result.ok) {
    if (result.error === "denied") return notFoundProblem(requestId);
    // Trigger rejections (objective outside the pinned release) land here.
    return problem("validation-failed", requestId, {
      detail: "One or more objectives are not part of your pinned curriculum.",
    });
  }
  return NextResponse.json({ ok: true });
});
