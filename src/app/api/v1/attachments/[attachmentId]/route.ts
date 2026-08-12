import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { attachment } from "@/server/db/schema";
import { getEvidenceWithAccess } from "@/server/portfolio/evidence";
import { softDeleteAttachment } from "@/server/files/attachments";
import { notFoundProblem } from "@/server/http/problem";
import { withApi } from "@/server/http/withApi";
import { resolveTenantForApi } from "@/server/http/tenant";

export const DELETE = withApi({}, async ({ actor, params, request, requestId }) => {
  const tenantId = await resolveTenantForApi(actor, request);
  if (!tenantId) return notFoundProblem(requestId);

  const rows = await getDb()
    .select({ parentId: attachment.parentId })
    .from(attachment)
    .where(and(eq(attachment.id, params.attachmentId!), eq(attachment.tenantId, tenantId)))
    .limit(1);
  if (!rows[0]) return notFoundProblem(requestId);

  const access = await getEvidenceWithAccess(actor, tenantId, rows[0].parentId);
  if (!access || !access.decision.allow) return notFoundProblem(requestId);

  const ok = await softDeleteAttachment(actor, access, params.attachmentId!, requestId);
  if (!ok) return notFoundProblem(requestId);
  return NextResponse.json({ ok: true });
});
