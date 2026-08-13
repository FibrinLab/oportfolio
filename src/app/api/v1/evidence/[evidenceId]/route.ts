import { NextResponse } from "next/server";
import { patchEvidenceRequest } from "@/server/http/apiSchemas";
import {
  getActiveDutyIds,
  getActiveObjectiveIds,
  getEvidenceWithAccess,
  softDeleteEvidence,
  updateEvidence,
} from "@/server/portfolio/evidence";
import { notFoundProblem, problem } from "@/server/http/problem";
import { withApi } from "@/server/http/withApi";
import { resolveTenantForApi } from "@/server/http/tenant";
import { canEditEvidence } from "@/server/policy/policy";

export const GET = withApi({}, async ({ actor, params, request, requestId }) => {
  const tenantId = await resolveTenantForApi(actor, request);
  if (!tenantId) return notFoundProblem(requestId);
  const access = await getEvidenceWithAccess(actor, tenantId, params.evidenceId!);
  if (!access || !access.decision.allow) return notFoundProblem(requestId);

  const { evidence, enrolment } = access;
  const isAuthor = evidence.authorUserId === actor.userId;
  const [objectiveIds, dutyIds] = await Promise.all([
    getActiveObjectiveIds(evidence.id),
    getActiveDutyIds(evidence.id),
  ]);

  // Per-audience DTO: no fetch-then-redact downstream (spec/07).
  return NextResponse.json(
    {
      id: evidence.id,
      enrolmentId: evidence.enrolmentId,
      title: evidence.title,
      activityDate: evidence.activityDate,
      activityEndedOn: evidence.activityEndedOn,
      evidenceTypeId: evidence.evidenceTypeId,
      narrativeDoc: evidence.narrativeDoc,
      typeFieldsJson: evidence.typeFieldsJson,
      provenanceId: evidence.provenanceId,
      visibility: evidence.visibility,
      workflowState: evidence.workflowState,
      archivedAt: evidence.archivedAt,
      objectiveIds,
      dutyIds,
      rowVersion: evidence.rowVersion,
      updatedAt: evidence.updatedAt,
      editable: isAuthor && canEditEvidence(actor, evidence, enrolment).allow,
    },
    { headers: { ETag: `"${evidence.rowVersion}"` } },
  );
});

export const PATCH = withApi({ bodySchema: patchEvidenceRequest }, async ({ actor, body, params, request, requestId }) => {
  const tenantId = await resolveTenantForApi(actor, request);
  if (!tenantId) return notFoundProblem(requestId);
  const access = await getEvidenceWithAccess(actor, tenantId, params.evidenceId!);
  if (!access || !access.decision.allow) return notFoundProblem(requestId);

  // Authorization before protocol errors: a reader without edit rights gets
  // the uniform 404, never a 428 hinting the item is editable.
  if (!canEditEvidence(actor, access.evidence, access.enrolment).allow) {
    return notFoundProblem(requestId);
  }

  const ifMatch = request.headers.get("if-match");
  const rowVersion = ifMatch ? Number(ifMatch.replaceAll('"', "")) : NaN;
  if (!Number.isInteger(rowVersion)) {
    return problem("precondition-required", requestId, {
      detail: "Send If-Match with the item's current version.",
    });
  }

  const { explicitSave, ...patch } = body;
  const result = await updateEvidence(actor, access, patch, rowVersion, {
    explicitSave,
    requestId,
  });
  if (!result.ok) {
    if (result.error === "denied") return notFoundProblem(requestId);
    if (result.error === "invalid") {
      return problem("validation-failed", requestId, {
        errors: (result.issues ?? []).map((message) => ({ pointer: "/narrativeDoc", message })),
      });
    }
    return problem("conflict", requestId, {
      currentRowVersion: result.current?.rowVersion,
      serverSavedAt: result.current?.savedAt,
      serverSavedBy: result.current?.savedByName,
      detail: "This item was saved elsewhere since you loaded it.",
    });
  }
  return NextResponse.json(
    { rowVersion: result.rowVersion, savedAt: result.savedAt },
    { headers: { ETag: `"${result.rowVersion}"` } },
  );
});

export const DELETE = withApi({}, async ({ actor, params, request, requestId }) => {
  const tenantId = await resolveTenantForApi(actor, request);
  if (!tenantId) return notFoundProblem(requestId);
  const access = await getEvidenceWithAccess(actor, tenantId, params.evidenceId!);
  if (!access || !access.decision.allow) return notFoundProblem(requestId);

  const ok = await softDeleteEvidence(actor, access, requestId);
  if (!ok) return notFoundProblem(requestId);
  return NextResponse.json({ ok: true });
});
