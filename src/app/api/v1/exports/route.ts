import { NextResponse } from "next/server";
import { getDb, type Db } from "@/server/db/client";
import { appendAudit } from "@/server/audit/audit";
import {
  createDiaryExportJob,
  DiaryExportValidationError,
} from "@/server/diary/export";
import { loadEnrolmentContext } from "@/server/framework/queries";
import { exportDiaryRequest } from "@/server/http/apiSchemas";
import { notFoundProblem, problem } from "@/server/http/problem";
import { resolveTenantForApi } from "@/server/http/tenant";
import { withApi } from "@/server/http/withApi";

export const POST = withApi(
  { bodySchema: exportDiaryRequest },
  async ({ actor, body, request, requestId }) => {
    const tenantId = await resolveTenantForApi(actor, request);
    if (!tenantId) return notFoundProblem(requestId);
    const enrolment = await loadEnrolmentContext(tenantId, body.enrolmentId);
    if (!enrolment || enrolment.fellowUserId !== actor.userId) {
      return notFoundProblem(requestId);
    }

    try {
      const result = await getDb().transaction(async (tx) => {
        const job = await createDiaryExportJob(tx as Db, actor, enrolment, {
          kind: "standard",
        });
        await appendAudit(tx as Db, {
          tenantId,
          actorUserId: actor.userId,
          action: "export.requested",
          targetType: "export_job",
          targetId: job.id,
          enrolmentId: enrolment.id,
          requestId,
          metadata: { kind: "standard" },
        });
        return job;
      });
      return NextResponse.json(
        {
          id: result.id,
          status: "queued",
          statusUrl: `/api/v1/exports/${result.id}`,
        },
        { status: 202 },
      );
    } catch (error) {
      if (error instanceof DiaryExportValidationError) {
        return problem("validation-failed", requestId, {
          detail: "Every retained attachment must finish its safety check before exporting.",
          attachmentNames: error.attachmentNames,
        });
      }
      if (error instanceof Error && error.message === "denied") {
        return notFoundProblem(requestId);
      }
      throw error;
    }
  },
);
