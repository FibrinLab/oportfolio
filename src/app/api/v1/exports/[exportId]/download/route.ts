import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, type Db } from "@/server/db/client";
import { exportJob } from "@/server/db/schema";
import { appendAudit } from "@/server/audit/audit";
import { presignExportDownload } from "@/server/files/s3";
import { notFoundProblem } from "@/server/http/problem";
import { resolveTenantForApi } from "@/server/http/tenant";
import { withApi } from "@/server/http/withApi";

export const GET = withApi({}, async ({ actor, params, request, requestId }) => {
  const tenantId = await resolveTenantForApi(actor, request);
  if (!tenantId) return notFoundProblem(requestId);
  const rows = await getDb()
    .select()
    .from(exportJob)
    .where(
      and(
        eq(exportJob.id, params.exportId!),
        eq(exportJob.tenantId, tenantId),
        eq(exportJob.requestedBy, actor.userId),
        eq(exportJob.status, "ready"),
      ),
    )
    .limit(1);
  const job = rows[0];
  if (!job?.objectKey || !job.artifactExpiresAt || job.artifactExpiresAt <= new Date()) {
    return notFoundProblem(requestId);
  }
  const url = await presignExportDownload(
    job.objectKey,
    `private-diary-${job.createdAt.toISOString().slice(0, 10)}.zip`,
  );
  await getDb().transaction(async (tx) => {
    await tx
      .update(exportJob)
      .set({ downloadedAt: new Date(), updatedAt: new Date() })
      .where(eq(exportJob.id, job.id));
    await appendAudit(tx as Db, {
      tenantId,
      actorUserId: actor.userId,
      action: "export.download_issued",
      targetType: "export_job",
      targetId: job.id,
      enrolmentId: job.enrolmentId,
      requestId,
    });
  });
  return NextResponse.redirect(url, 303);
});
