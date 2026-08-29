import { NextResponse } from "next/server";
import { getDb } from "@/server/db/client";
import { appendAudit } from "@/server/audit/audit";
import { buildDiaryExportBundle } from "@/server/diary/export";
import { loadEnrolmentContext } from "@/server/framework/queries";
import { notFoundProblem } from "@/server/http/problem";
import { resolveTenantForApi } from "@/server/http/tenant";
import { withApi } from "@/server/http/withApi";
import { canExportDiary } from "@/server/policy/policy";

// Everything the browser needs to build a diary archive locally (ADR-007):
// metadata plus ciphertext envelopes. Sealed content stays sealed on the
// wire; the browser decrypts, renders the PDF and zips it.
export const GET = withApi({}, async ({ actor, params, request, requestId }) => {
  const tenantId = await resolveTenantForApi(actor, request);
  if (!tenantId) return notFoundProblem(requestId);
  const enrolment = await loadEnrolmentContext(tenantId, params.enrolmentId!);
  if (!enrolment || !canExportDiary(actor, enrolment).allow) return notFoundProblem(requestId);

  const db = getDb();
  const bundle = await buildDiaryExportBundle(db, enrolment);
  await appendAudit(db, {
    tenantId,
    actorUserId: actor.userId,
    action: "export.bundle_issued",
    targetType: "enrolment",
    targetId: enrolment.id,
    enrolmentId: enrolment.id,
    requestId,
    metadata: { entries: bundle.entries.length, clientSide: true },
  });
  return NextResponse.json(bundle, { headers: { "Cache-Control": "no-store" } });
});
