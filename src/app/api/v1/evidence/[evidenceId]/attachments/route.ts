import { NextResponse } from "next/server";
import { getEvidenceWithAccess } from "@/server/portfolio/evidence";
import { listAttachments } from "@/server/files/attachments";
import { notFoundProblem } from "@/server/http/problem";
import { withApi } from "@/server/http/withApi";
import { resolveTenantForApi } from "@/server/http/tenant";

export const GET = withApi({}, async ({ actor, params, request, requestId }) => {
  const tenantId = await resolveTenantForApi(actor, request);
  if (!tenantId) return notFoundProblem(requestId);
  const access = await getEvidenceWithAccess(actor, tenantId, params.evidenceId!);
  if (!access || !access.decision.allow) return notFoundProblem(requestId);
  return NextResponse.json({ attachments: await listAttachments(params.evidenceId!, tenantId) });
});
