import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { attachment } from "@/server/db/schema";
import { getEvidenceWithAccess } from "@/server/portfolio/evidence";
import { issueDownload } from "@/server/files/attachments";
import { notFoundProblem } from "@/server/http/problem";
import { withApi } from "@/server/http/withApi";
import { resolveTenantForApi } from "@/server/http/tenant";

// Current access is checked before every URL issue (spec/12); the presigned
// URL itself expires within 5 minutes (NFR-S-006).
export const GET = withApi({}, async ({ actor, params, request, requestId }) => {
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

  const result = await issueDownload(actor, access, params.attachmentId!, requestId);
  if (!result.ok) return notFoundProblem(requestId);

  const response = NextResponse.redirect(result.url, 302);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Cache-Control", "no-store");
  return response;
});
