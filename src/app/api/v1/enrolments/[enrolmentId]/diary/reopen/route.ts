import { NextResponse } from "next/server";
import { reopenDiary } from "@/server/diary/lifecycle";
import { loadEnrolmentContext } from "@/server/framework/queries";
import { reopenDiaryRequest } from "@/server/http/apiSchemas";
import { notFoundProblem } from "@/server/http/problem";
import { resolveTenantForApi } from "@/server/http/tenant";
import { withApi } from "@/server/http/withApi";

export const POST = withApi(
  { bodySchema: reopenDiaryRequest },
  async ({ actor, params, request, requestId }) => {
    const tenantId = await resolveTenantForApi(actor, request);
    if (!tenantId) return notFoundProblem(requestId);
    const enrolment = await loadEnrolmentContext(tenantId, params.enrolmentId!);
    if (!enrolment || !(await reopenDiary(actor, enrolment, requestId))) {
      return notFoundProblem(requestId);
    }
    return NextResponse.json({ diaryState: "open" });
  },
);
