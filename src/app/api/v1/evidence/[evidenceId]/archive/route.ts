import { NextResponse } from "next/server";
import { archiveEvidence, getEvidenceWithAccess } from "@/server/portfolio/evidence";
import { notFoundProblem } from "@/server/http/problem";
import { withApi } from "@/server/http/withApi";
import { resolveTenantForApi } from "@/server/http/tenant";

export const POST = withApi({}, async ({ actor, params, request, requestId }) => {
  const tenantId = await resolveTenantForApi(actor, request);
  if (!tenantId) return notFoundProblem(requestId);
  const access = await getEvidenceWithAccess(actor, tenantId, params.evidenceId!);
  if (!access || !access.decision.allow) return notFoundProblem(requestId);
  const ok = await archiveEvidence(actor, access, requestId);
  if (!ok) return notFoundProblem(requestId);
  return NextResponse.json({ ok: true });
});
