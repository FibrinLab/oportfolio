import { NextResponse } from "next/server";
import { z } from "zod";
import { getEvidenceWithAccess } from "@/server/portfolio/evidence";
import { initiateUpload } from "@/server/files/attachments";
import { notFoundProblem, problem } from "@/server/http/problem";
import { withApi } from "@/server/http/withApi";
import { resolveTenantForApi } from "@/server/http/tenant";

const bodySchema = z.object({
  evidenceId: z.string().uuid(),
  filename: z.string().min(1).max(255),
  mediaTypeClaimed: z.string().min(3).max(120),
  sizeBytes: z.number().int().positive(),
  // Required for every upload session (FR-FI-005).
  patientDataConfirmed: z.literal(true),
});

export const POST = withApi({ bodySchema }, async ({ actor, body, request, requestId }) => {
  const tenantId = await resolveTenantForApi(actor, request);
  if (!tenantId) return notFoundProblem(requestId);
  const access = await getEvidenceWithAccess(actor, tenantId, body.evidenceId);
  if (!access || !access.decision.allow) return notFoundProblem(requestId);

  const result = await initiateUpload(
    actor,
    access,
    { filename: body.filename, mediaTypeClaimed: body.mediaTypeClaimed, sizeBytes: body.sizeBytes },
    requestId,
  );
  if (!result.ok) {
    if (result.reason === "denied") return notFoundProblem(requestId);
    return problem("upload-policy", requestId, { detail: result.reason });
  }
  return NextResponse.json(result, { status: 201 });
});
