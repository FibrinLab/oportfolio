import { NextResponse } from "next/server";
import { DiaryExportValidationError } from "@/server/diary/export";
import { finishDiary } from "@/server/diary/lifecycle";
import { loadEnrolmentContext } from "@/server/framework/queries";
import { finishDiaryRequest } from "@/server/http/apiSchemas";
import { notFoundProblem, problem } from "@/server/http/problem";
import { resolveTenantForApi } from "@/server/http/tenant";
import { withApi } from "@/server/http/withApi";

export const POST = withApi(
  { bodySchema: finishDiaryRequest },
  async ({ actor, params, request, requestId }) => {
    const tenantId = await resolveTenantForApi(actor, request);
    if (!tenantId) return notFoundProblem(requestId);
    const enrolment = await loadEnrolmentContext(tenantId, params.enrolmentId!);
    if (!enrolment) return notFoundProblem(requestId);
    try {
      const result = await finishDiary(actor, enrolment, requestId);
      if (!result.ok) return notFoundProblem(requestId);
      return NextResponse.json({
        diaryState: "finished",
        exportJobId: result.exportJobId,
        accessEndsAt: result.accessEndsAt,
      });
    } catch (error) {
      if (error instanceof DiaryExportValidationError) {
        return problem("validation-failed", requestId, {
          detail: "Every retained attachment must finish its safety check before finishing the diary.",
          attachmentNames: error.attachmentNames,
        });
      }
      throw error;
    }
  },
);
