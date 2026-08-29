import { NextResponse } from "next/server";
import {
  addLinkRequest,
  conflictBackupRequest,
  createEvidenceRequest,
  patchEvidenceRequest,
  removeLinkRequest,
  setObjectivesRequest,
} from "./apiSchemas";
import { notFoundProblem, problem } from "./problem";
import { resolveTenantForApi } from "./tenant";
import { withApi } from "./withApi";
import { loadEnrolmentContext } from "@/server/framework/queries";
import {
  archiveEvidence,
  createConflictBackup,
  createEvidence,
  getActiveObjectiveIds,
  getEvidenceWithAccess,
  listEvidence,
  listRevisions,
  restoreEvidence,
  setObjectives,
  softDeleteEvidence,
  updateEvidence,
} from "@/server/portfolio/evidence";
import { canEditEvidence } from "@/server/policy/policy";
import { addLink, listLinks, removeLink } from "@/server/portfolio/links";
import { listAttachments } from "@/server/files/attachments";

export const listDiaryEntriesGET = withApi(
  {},
  async ({ actor, params, request, requestId }) => {
    const tenantId = await resolveTenantForApi(actor, request);
    if (!tenantId) return notFoundProblem(requestId);
    const enrolment = await loadEnrolmentContext(tenantId, params.enrolmentId!);
    if (!enrolment || enrolment.fellowUserId !== actor.userId || enrolment.diaryState === "purged") {
      return notFoundProblem(requestId);
    }
    return NextResponse.json({ items: await listEvidence(actor, enrolment) });
  },
);

export const createDiaryEntryPOST = withApi(
  { bodySchema: createEvidenceRequest },
  async ({ actor, body, params, request, requestId }) => {
    const tenantId = await resolveTenantForApi(actor, request);
    if (!tenantId) return notFoundProblem(requestId);
    const enrolment = await loadEnrolmentContext(tenantId, params.enrolmentId!);
    if (!enrolment) return notFoundProblem(requestId);
    const result = await createEvidence(actor, enrolment, {
      id: body.id,
      title: body.title,
      activityDate: body.activityDate ?? null,
      evidenceTypeId: body.evidenceTypeId ?? null,
      narrativeDoc: body.narrativeDoc,
      contentEnc: body.contentEnc,
      reflectionAcknowledged: body.reflectionAcknowledged,
      requestId,
    });
    if ("error" in result) {
      if (result.error === "denied") return notFoundProblem(requestId);
      return problem("validation-failed", requestId, {
        errors: (result.issues ?? []).map((message) => ({ pointer: "/narrativeDoc", message })),
      });
    }
    return NextResponse.json(result, {
      status: 201,
      headers: { ETag: `"${result.rowVersion}"` },
    });
  },
);

export const diaryEntryGET = withApi({}, async ({ actor, params, request, requestId }) => {
  const tenantId = await resolveTenantForApi(actor, request);
  if (!tenantId) return notFoundProblem(requestId);
  const access = await getEvidenceWithAccess(actor, tenantId, params.evidenceId!);
  if (!access || !access.decision.allow) return notFoundProblem(requestId);
  const { evidence, enrolment } = access;
  const objectiveIds = await getActiveObjectiveIds(evidence.id);
  return NextResponse.json(
    {
      id: evidence.id,
      enrolmentId: evidence.enrolmentId,
      title: evidence.title,
      activityDate: evidence.activityDate,
      activityEndedOn: evidence.activityEndedOn,
      entryTypeId: evidence.evidenceTypeId,
      narrativeDoc: evidence.narrativeDoc,
      encrypted: evidence.encrypted,
      contentEnc: evidence.contentEnc,
      archivedAt: evidence.archivedAt,
      objectiveIds,
      rowVersion: evidence.rowVersion,
      updatedAt: evidence.updatedAt,
      editable: canEditEvidence(actor, evidence, enrolment).allow,
    },
    { headers: { ETag: `"${evidence.rowVersion}"` } },
  );
});

export const diaryEntryPATCH = withApi(
  { bodySchema: patchEvidenceRequest },
  async ({ actor, body, params, request, requestId }) => {
    const tenantId = await resolveTenantForApi(actor, request);
    if (!tenantId) return notFoundProblem(requestId);
    const access = await getEvidenceWithAccess(actor, tenantId, params.evidenceId!);
    if (!access || !access.decision.allow || !canEditEvidence(actor, access.evidence, access.enrolment).allow) {
      return notFoundProblem(requestId);
    }
    const ifMatch = request.headers.get("if-match");
    const rowVersion = ifMatch ? Number(ifMatch.replaceAll('"', "")) : NaN;
    if (!Number.isInteger(rowVersion)) return problem("precondition-required", requestId);
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
        detail: "This entry was saved elsewhere since you loaded it.",
      });
    }
    return NextResponse.json(
      { rowVersion: result.rowVersion, savedAt: result.savedAt },
      { headers: { ETag: `"${result.rowVersion}"` } },
    );
  },
);

export const diaryEntryDELETE = withApi({}, async ({ actor, params, request, requestId }) => {
  const tenantId = await resolveTenantForApi(actor, request);
  if (!tenantId) return notFoundProblem(requestId);
  const access = await getEvidenceWithAccess(actor, tenantId, params.evidenceId!);
  if (!access || !access.decision.allow || !(await softDeleteEvidence(actor, access, requestId))) {
    return notFoundProblem(requestId);
  }
  return NextResponse.json({ ok: true });
});

export const archiveDiaryEntryPOST = withApi({}, async ({ actor, params, request, requestId }) => {
  const tenantId = await resolveTenantForApi(actor, request);
  if (!tenantId) return notFoundProblem(requestId);
  const access = await getEvidenceWithAccess(actor, tenantId, params.evidenceId!);
  if (!access || !access.decision.allow || !(await archiveEvidence(actor, access, requestId))) {
    return notFoundProblem(requestId);
  }
  return NextResponse.json({ ok: true });
});

export const restoreDiaryEntryPOST = withApi({}, async ({ actor, params, request, requestId }) => {
  const tenantId = await resolveTenantForApi(actor, request);
  if (!tenantId) return notFoundProblem(requestId);
  const access = await getEvidenceWithAccess(actor, tenantId, params.evidenceId!);
  if (!access || !access.decision.allow || !(await restoreEvidence(actor, access, requestId))) {
    return notFoundProblem(requestId);
  }
  return NextResponse.json({ ok: true });
});

export const diaryRevisionsGET = withApi({}, async ({ actor, params, request, requestId }) => {
  const tenantId = await resolveTenantForApi(actor, request);
  if (!tenantId) return notFoundProblem(requestId);
  const access = await getEvidenceWithAccess(actor, tenantId, params.evidenceId!);
  if (!access || !access.decision.allow) return notFoundProblem(requestId);
  const revisions = await listRevisions(actor, access);
  return revisions ? NextResponse.json({ revisions }) : notFoundProblem(requestId);
});

export const diaryRevisionsPOST = withApi(
  { bodySchema: conflictBackupRequest },
  async ({ actor, body, params, request, requestId }) => {
    const tenantId = await resolveTenantForApi(actor, request);
    if (!tenantId) return notFoundProblem(requestId);
    const access = await getEvidenceWithAccess(actor, tenantId, params.evidenceId!);
    if (!access || !access.decision.allow) return notFoundProblem(requestId);
    const result = await createConflictBackup(
      actor,
      access,
      { ...body.snapshot, conflictBackup: true },
      requestId,
    );
    return result.ok
      ? NextResponse.json({ ok: true }, { status: 201 })
      : notFoundProblem(requestId);
  },
);

export const diaryObjectivesPUT = withApi(
  { bodySchema: setObjectivesRequest },
  async ({ actor, body, params, request, requestId }) => {
    const tenantId = await resolveTenantForApi(actor, request);
    if (!tenantId) return notFoundProblem(requestId);
    const access = await getEvidenceWithAccess(actor, tenantId, params.evidenceId!);
    if (!access || !access.decision.allow) return notFoundProblem(requestId);
    const result = await setObjectives(actor, access, body.objectiveIds, requestId);
    if (!result.ok) {
      if (result.error === "denied") return notFoundProblem(requestId);
      return problem("validation-failed", requestId, {
        detail: "One or more objectives are not part of your pinned curriculum.",
      });
    }
    return NextResponse.json({ ok: true });
  },
);

export const diaryLinksGET = withApi({}, async ({ actor, params, request, requestId }) => {
  const tenantId = await resolveTenantForApi(actor, request);
  if (!tenantId) return notFoundProblem(requestId);
  const access = await getEvidenceWithAccess(actor, tenantId, params.evidenceId!);
  if (!access || !access.decision.allow) return notFoundProblem(requestId);
  return NextResponse.json({ links: await listLinks(params.evidenceId!, tenantId) });
});

export const diaryLinksPOST = withApi(
  { bodySchema: addLinkRequest },
  async ({ actor, body, params, request, requestId }) => {
    const tenantId = await resolveTenantForApi(actor, request);
    if (!tenantId) return notFoundProblem(requestId);
    const access = await getEvidenceWithAccess(actor, tenantId, params.evidenceId!);
    if (!access || !access.decision.allow) return notFoundProblem(requestId);
    const result = await addLink(actor, access, body, requestId);
    if (!result.ok) {
      return result.reason === "denied"
        ? notFoundProblem(requestId)
        : problem("validation-failed", requestId, { detail: result.reason });
    }
    return NextResponse.json(result, { status: 201 });
  },
);

export const diaryLinksDELETE = withApi(
  { bodySchema: removeLinkRequest },
  async ({ actor, body, params, request, requestId }) => {
    const tenantId = await resolveTenantForApi(actor, request);
    if (!tenantId) return notFoundProblem(requestId);
    const access = await getEvidenceWithAccess(actor, tenantId, params.evidenceId!);
    if (!access || !access.decision.allow || !(await removeLink(actor, access, body.linkId, requestId))) {
      return notFoundProblem(requestId);
    }
    return NextResponse.json({ ok: true });
  },
);

export const diaryAttachmentsGET = withApi({}, async ({ actor, params, request, requestId }) => {
  const tenantId = await resolveTenantForApi(actor, request);
  if (!tenantId) return notFoundProblem(requestId);
  const access = await getEvidenceWithAccess(actor, tenantId, params.evidenceId!);
  if (!access || !access.decision.allow) return notFoundProblem(requestId);
  return NextResponse.json({ attachments: await listAttachments(params.evidenceId!, tenantId) });
});
