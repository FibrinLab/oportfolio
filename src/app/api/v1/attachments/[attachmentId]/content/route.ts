import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { attachment } from "@/server/db/schema";
import { SEALED_FILE_OVERHEAD_BYTES } from "@/lib/crypto/envelope";
import { getEvidenceWithAccess } from "@/server/portfolio/evidence";
import { canEditEvidence } from "@/server/policy/policy";
import { MAX_FILE_BYTES } from "@/server/files/uploadPolicy";
import { putQuarantineObject } from "@/server/files/s3";
import { notFoundProblem, problem } from "@/server/http/problem";
import { withApi } from "@/server/http/withApi";
import { resolveTenantForApi } from "@/server/http/tenant";

const MAX_SEALED_BYTES = MAX_FILE_BYTES + SEALED_FILE_OVERHEAD_BYTES;

export const PUT = withApi({}, async ({ actor, params, request, requestId }) => {
  const tenantId = await resolveTenantForApi(actor, request);
  if (!tenantId) return notFoundProblem(requestId);

  const rows = await getDb()
    .select({
      parentId: attachment.parentId,
      objectKey: attachment.objectKey,
      sizeBytes: attachment.sizeBytes,
      encrypted: attachment.encrypted,
      scanStatus: attachment.scanStatus,
    })
    .from(attachment)
    .where(and(eq(attachment.id, params.attachmentId!), eq(attachment.tenantId, tenantId)))
    .limit(1);
  const row = rows[0];
  if (!row || !row.encrypted || row.scanStatus !== "awaiting_upload") {
    return notFoundProblem(requestId);
  }

  const access = await getEvidenceWithAccess(actor, tenantId, row.parentId);
  if (!access || !canEditEvidence(actor, access.evidence, access.enrolment).allow) {
    return notFoundProblem(requestId);
  }

  if (request.headers.get("content-type") !== "application/octet-stream") {
    return problem("upload-policy", requestId, {
      detail: "Encrypted uploads must use application/octet-stream.",
    });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_SEALED_BYTES) {
    return problem("upload-policy", requestId, { detail: "Files must be 25 MB or smaller." });
  }

  const body = new Uint8Array(await request.arrayBuffer());
  if (body.byteLength !== row.sizeBytes || body.byteLength > MAX_SEALED_BYTES) {
    return problem("upload-policy", requestId, {
      detail: "The encrypted upload size did not match the authorized file.",
    });
  }

  await putQuarantineObject(row.objectKey, body);
  return NextResponse.json({ ok: true });
});
