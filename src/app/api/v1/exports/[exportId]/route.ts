import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { exportJob } from "@/server/db/schema";
import { notFoundProblem } from "@/server/http/problem";
import { resolveTenantForApi } from "@/server/http/tenant";
import { withApi } from "@/server/http/withApi";

export const GET = withApi({}, async ({ actor, params, request, requestId }) => {
  const tenantId = await resolveTenantForApi(actor, request);
  if (!tenantId) return notFoundProblem(requestId);
  const rows = await getDb()
    .select({
      id: exportJob.id,
      status: exportJob.status,
      kind: exportJob.kind,
      failureDetail: exportJob.failureDetail,
      artifactExpiresAt: exportJob.artifactExpiresAt,
      completedAt: exportJob.completedAt,
      downloadedAt: exportJob.downloadedAt,
      createdAt: exportJob.createdAt,
    })
    .from(exportJob)
    .where(
      and(
        eq(exportJob.id, params.exportId!),
        eq(exportJob.tenantId, tenantId),
        eq(exportJob.requestedBy, actor.userId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return notFoundProblem(requestId);
  return NextResponse.json({
    ...row,
    downloadUrl:
      row.status === "ready" ? `/api/v1/exports/${row.id}/download` : null,
  });
});
