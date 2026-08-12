import { NextResponse } from "next/server";
import { z } from "zod";
import { loadEnrolmentContext } from "@/server/framework/queries";
import { createEvidence, listEvidence } from "@/server/portfolio/evidence";
import { canReadEnrolment } from "@/server/policy/policy";
import { notFoundProblem, problem } from "@/server/http/problem";
import { withApi } from "@/server/http/withApi";
import { withIdempotency } from "@/server/http/idempotency";
import { resolveTenantForApi } from "@/server/http/tenant";

const createSchema = z.object({
  title: z.string().min(1).max(160),
  activityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  evidenceTypeId: z.string().uuid(),
  narrativeDoc: z.unknown().optional(),
  // Reflection safety acknowledgement on first save (FR-EV-008).
  reflectionAcknowledged: z.boolean().optional(),
});

export const POST = withApi({ bodySchema: createSchema }, async ({ actor, body, params, request, requestId }) => {
  const tenantId = await resolveTenantForApi(actor, request);
  if (!tenantId) return notFoundProblem(requestId);

  const enrolment = await loadEnrolmentContext(tenantId, params.enrolmentId!);
  if (!enrolment) return notFoundProblem(requestId);

  return withIdempotency(request, tenantId, requestId, async () => {
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
