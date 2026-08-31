import { NextResponse } from "next/server";
import { initiateUploadRequest } from "@/server/http/apiSchemas";
import { getEvidenceWithAccess } from "@/server/portfolio/evidence";
import { initiateUpload } from "@/server/files/attachments";
import { notFoundProblem, problem } from "@/server/http/problem";
import { withApi } from "@/server/http/withApi";
import { resolveTenantForApi } from "@/server/http/tenant";

export const POST = withApi({ bodySchema: initiateUploadRequest }, async ({ actor, body, request, requestId }) => {
  const tenantId = await resolveTenantForApi(actor, request);
  if (!tenantId) return notFoundProblem(requestId);
  const access = await getEvidenceWithAccess(actor, tenantId, body.entryId);
  if (!access || !access.decision.allow) return notFoundProblem(requestId);

  const result = await initiateUpload(
    actor,
    access,
    {
      filename: body.filename,
      mediaTypeClaimed: body.mediaTypeClaimed,
      sizeBytes: body.sizeBytes,
      attachmentId: body.attachmentId,
      encrypted: body.encrypted,
      nameEnc: body.nameEnc,
    },
    requestId,
  );
  if (!result.ok) {
    if (result.reason === "denied") return notFoundProblem(requestId);
    return problem("upload-policy", requestId, { detail: result.reason });
  }
  return NextResponse.json(
    { ok: true, attachmentId: result.attachmentId },
    { status: 201 },
  );
});
