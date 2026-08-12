import { NextResponse } from "next/server";
import { z } from "zod";
import { getEvidenceWithAccess, setDuties } from "@/server/portfolio/evidence";
import { notFoundProblem } from "@/server/http/problem";
import { withApi } from "@/server/http/withApi";
import { resolveTenantForApi } from "@/server/http/tenant";

const bodySchema = z.object({
  dutyIds: z.array(z.string().uuid()).max(20),
});

export const PUT = withApi({ bodySchema }, async ({ actor, body, params, request, requestId }) => {
  const tenantId = await resolveTenantForApi(actor, request);
  if (!tenantId) return notFoundProblem(requestId);
  const access = await getEvidenceWithAccess(actor, tenantId, params.evidenceId!);
  if (!access || !access.decision.allow) return notFoundProblem(requestId);

  const result = await setDuties(actor, access, body.dutyIds, requestId);
  if (!result.ok) return notFoundProblem(requestId);
  return NextResponse.json({ ok: true });
});
