import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { Readable } from "node:stream";
import { getDb } from "@/server/db/client";
import { attachment } from "@/server/db/schema";
import { getEvidenceWithAccess } from "@/server/portfolio/evidence";
import { issueDownload } from "@/server/files/attachments";
import { getCleanStream } from "@/server/files/s3";
import { notFoundProblem } from "@/server/http/problem";
import { withApi } from "@/server/http/withApi";
import { resolveTenantForApi } from "@/server/http/tenant";

// Current access is checked before every URL issue (spec/12); the presigned
// URL itself expires within 5 minutes (NFR-S-006). Sealed files (ADR-007)
// are streamed through the app as opaque bytes so the browser can decrypt
// them without cross-origin access to the bucket.
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

  const wantsStream = request.nextUrl.searchParams.get("stream") === "1";
  if ("sealed" in result || wantsStream) {
    const stream = await getCleanStream(result.objectKey);
    const body = Readable.toWeb(stream) as unknown as ReadableStream;
    const safeName = "sealed" in result ? "sealed.bin" : result.displayName.replace(/[^\w.\- ]+/g, "_").slice(0, 120);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "sealed" in result ? "application/octet-stream" : result.mediaType,
        "Content-Length": String(result.sizeBytes),
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
      },
    });
  }

  const response = NextResponse.redirect(result.url, 302);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Cache-Control", "no-store");
  return response;
});
