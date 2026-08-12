import { NextResponse } from "next/server";
import { z } from "zod";
import { changeVisibility, getEvidenceWithAccess } from "@/server/portfolio/evidence";
import { notFoundProblem, problem } from "@/server/http/problem";
import { withApi } from "@/server/http/withApi";
import { withIdempotency } from "@/server/http/idempotency";
import { resolveTenantForApi } from "@/server/http/tenant";

const bodySchema = z.object({
  visibility: z.enum(["private", "supervisors", "faculty"]),
  // The UI previews the audience before this call; the flag records that the
  // preview step happened (deliberate sharing, ADR-002).
  audienceConfirmed: z.literal(true),
});

export const POST = withApi({ bodySchema }, async ({ actor, body, params, request, requestId }) => {
  const tenantId = await resolveTenantForApi(actor, request);
  if (!tenantId) return notFoundProblem(requestId);
  const access = await getEvidenceWithAccess(actor, tenantId, params.evidenceId!);
  if (!access || !access.decision.allow) return notFoundProblem(requestId);

  return withIdempotency(request, tenantId, requestId, async () => {
    const result = await changeVisibility(actor, access, body.visibility, requestId);
    if (!result.ok) {
      if (result.error === "denied") return notFoundProblem(requestId);
      return problem("invalid-state", requestId);
    }
    return NextResponse.json({ ok: true, visibility: body.visibility });
  });
});
