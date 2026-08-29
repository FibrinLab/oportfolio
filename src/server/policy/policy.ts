import type { Actor } from "./actor";

// Pure, synchronous policy functions over already-loaded rows. Default deny:
// every decision combines tenant membership, scope, ownership and lifecycle
// state. Diary content has no staff audience.
//
// Deny reasons are for audit/reason codes only — object-read denials render
// as a uniform 404 so existence never leaks.

export type DenyReason =
  | "no_tenant_membership"
  | "no_role"
  | "not_owner"
  | "not_assigned"
  | "not_visible"
  | "wrong_state"
  | "deleted";

export type Decision = { allow: true } | { allow: false; reason: DenyReason };

const deny = (reason: DenyReason): Decision => ({ allow: false, reason });
const allow: Decision = { allow: true };

export type Visibility = "private" | "supervisors" | "faculty";

export interface EnrolmentContext {
  id: string;
  tenantId: string;
  fellowUserId: string | null;
  programmeId: string;
  cohortId: string;
  diaryState: "open" | "finished" | "purged";
  diaryFinishCycle: number;
  diaryAccessEndsAt: Date | null;
}

export interface EvidenceContext {
  id: string;
  tenantId: string;
  enrolmentId: string;
  authorUserId: string;
  visibility: Visibility;
  workflowState: "draft" | "shared" | "review_requested";
  deletedAt: Date | null;
  archivedAt: Date | null;
}

function hasTenantMembership(actor: Actor, tenantId: string): boolean {
  return actor.memberships.some((m) => m.tenantId === tenantId);
}

function hasRole(actor: Actor, tenantId: string, role: ActorRole): boolean {
  return actor.memberships.some((m) => m.tenantId === tenantId && m.role === role);
}

type ActorRole = "fellow" | "supervisor" | "faculty" | "tenant_admin";

// Faculty scope: tenant-wide faculty membership, or programme/cohort-scoped
// membership matching this enrolment's programme/cohort.
function hasFacultyScope(actor: Actor, enrolment: EnrolmentContext): boolean {
  return actor.memberships.some(
    (m) =>
      m.tenantId === enrolment.tenantId &&
      m.role === "faculty" &&
      (m.scopeType === "tenant" ||
        (m.scopeType === "programme" && m.scopeId === enrolment.programmeId) ||
        (m.scopeType === "cohort" && m.scopeId === enrolment.cohortId)),
  );
}

export function isOwnEnrolment(actor: Actor, enrolment: EnrolmentContext): boolean {
  return enrolment.fellowUserId === actor.userId;
}

export function canReadEnrolment(actor: Actor, enrolment: EnrolmentContext): Decision {
  if (!hasTenantMembership(actor, enrolment.tenantId)) return deny("no_tenant_membership");
  if (isOwnEnrolment(actor, enrolment)) return allow;
  if (hasRole(actor, enrolment.tenantId, "tenant_admin")) return allow;
  if (hasFacultyScope(actor, enrolment)) return allow;
  return deny("no_role");
}

// The curriculum is part of the fellow's private diary context. Programme
// staff manage framework metadata elsewhere but never enter a fellow diary.
export function canReadCurriculum(actor: Actor, enrolment: EnrolmentContext): Decision {
  if (!hasTenantMembership(actor, enrolment.tenantId)) return deny("no_tenant_membership");
  return isOwnEnrolment(actor, enrolment) ? allow : deny("not_owner");
}

export function canReadEvidence(
  actor: Actor,
  evidence: EvidenceContext,
  enrolment: EnrolmentContext,
): Decision {
  if (!hasTenantMembership(actor, evidence.tenantId)) return deny("no_tenant_membership");
  if (evidence.tenantId !== enrolment.tenantId || evidence.enrolmentId !== enrolment.id) {
    return deny("not_visible");
  }
  // Diary content is author-only. Roles and assignments deliberately have no
  // effect here, including for archived and grace-period-deleted entries.
  if (evidence.authorUserId !== actor.userId || !isOwnEnrolment(actor, enrolment)) {
    return deny("not_owner");
  }
  if (enrolment.diaryState === "purged") return deny("deleted");
  return allow;
}

export function canEditEvidence(
  actor: Actor,
  evidence: EvidenceContext,
  enrolment: EnrolmentContext,
): Decision {
  if (!hasTenantMembership(actor, evidence.tenantId)) return deny("no_tenant_membership");
  // Only the author fellow can edit their diary.
  if (evidence.authorUserId !== actor.userId) return deny("not_owner");
  if (!isOwnEnrolment(actor, enrolment)) return deny("not_owner");
  if (enrolment.diaryState !== "open") return deny("wrong_state");
  if (evidence.deletedAt) return deny("deleted");
  if (evidence.archivedAt) return deny("wrong_state");
  return allow;
}

export const canDeleteEvidence = canEditEvidence;

export function canCreateEvidence(actor: Actor, enrolment: EnrolmentContext): Decision {
  if (!hasTenantMembership(actor, enrolment.tenantId)) return deny("no_tenant_membership");
  if (!isOwnEnrolment(actor, enrolment)) return deny("not_owner");
  if (enrolment.diaryState !== "open") return deny("wrong_state");
  return allow;
}

export function canExportDiary(actor: Actor, enrolment: EnrolmentContext): Decision {
  if (!hasTenantMembership(actor, enrolment.tenantId)) return deny("no_tenant_membership");
  if (!isOwnEnrolment(actor, enrolment)) return deny("not_owner");
  if (enrolment.diaryState === "purged") return deny("deleted");
  if (
    enrolment.diaryState === "finished" &&
    enrolment.diaryAccessEndsAt &&
    enrolment.diaryAccessEndsAt.getTime() <= Date.now()
  ) {
    return deny("wrong_state");
  }
  return allow;
}

export interface AttachmentContext {
  tenantId: string;
  parentType: string;
  scanStatus: string;
  deletedAt: Date | null;
}

// Attachments inherit their owner-only parent decision.
export function canDownloadAttachment(
  attachment: AttachmentContext,
  parentDecision: Decision,
): Decision {
  if (!parentDecision.allow) return parentDecision;
  if (attachment.deletedAt) return deny("deleted");
  // `sealed` = encrypted in the browser, integrity-checked, not scannable
  // (ADR-007); only the author can open it, so it is downloadable.
  if (attachment.scanStatus !== "clean" && attachment.scanStatus !== "sealed") {
    return deny("wrong_state");
  }
  return allow;
}

export function canInvite(actor: Actor, tenantId: string): Decision {
  if (!hasTenantMembership(actor, tenantId)) return deny("no_tenant_membership");
  if (hasRole(actor, tenantId, "faculty") || hasRole(actor, tenantId, "tenant_admin")) {
    return allow;
  }
  return deny("no_role");
}

export function canManageFrameworks(actor: Actor, tenantId: string): Decision {
  return canInvite(actor, tenantId);
}
