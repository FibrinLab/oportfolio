import { NextResponse } from "next/server";
import { createEvidenceRequest } from "@/server/http/apiSchemas";
import { loadEnrolmentContext } from "@/server/framework/queries";
import { createEvidence, listEvidence } from "@/server/portfolio/evidence";
import { canReadEnrolment } from "@/server/policy/policy";
import { notFoundProblem, problem } from "@/server/http/problem";
import { withApi } from "@/server/http/withApi";
import { withIdempotency } from "@/server/http/idempotency";
import { resolveTenantForApi } from "@/server/http/tenant";

export const POST = withApi({ bodySchema: createEvidenceRequest }, async ({ actor, body, params, request, requestId }) => {
  const tenantId = await resolveTenantForApi(actor, request);
  if (!tenantId) return notFoundProblem(requestId);

  const enrolment = await loadEnrolmentContext(tenantId, params.enrolmentId!);
  if (!enrolment) return notFoundProblem(requestId);

  return withIdempotency(request, tenantId, requestId, body, async () => {
    const result = await createEvidence(actor, enrolment, {
      title: body.title,
      activityDate: body.activityDate ?? null,
      evidenceTypeId: body.evidenceTypeId,
      narrativeDoc: body.narrativeDoc,
      reflectionAcknowledged: body.reflectionAcknowledged,
      requestId,
    });
    if ("error" in result) {
      if (result.error === "denied") return notFoundProblem(requestId);
      return problem("validation-failed", requestId, {
        errors: (result.issues ?? []).map((message) => ({ pointer: "/narrativeDoc", message })),
      });
    }
    return NextResponse.json(result, { status: 201, headers: { ETag: `"${result.rowVersion}"` } });
  });
});

export const GET = withApi({}, async ({ actor, params, request, requestId }) => {
  const tenantId = await resolveTenantForApi(actor, request);
  if (!tenantId) return notFoundProblem(requestId);

  const enrolment = await loadEnrolmentContext(tenantId, params.enrolmentId!);
  if (!enrolment) return notFoundProblem(requestId);
  if (!canReadEnrolment(actor, enrolment).allow) return notFoundProblem(requestId);

  const rows = await listEvidence(actor, enrolment);
  return NextResponse.json({ items: rows });
});
