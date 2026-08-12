import type { Actor } from "./actor";

// Pure, synchronous policy functions over already-loaded rows. Default deny:
// every decision combines tenant membership + scoped role + active dated
// assignment + ownership + workflow state + visibility (spec/01, spec/12).
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

function isAssignedSupervisor(actor: Actor, enrolmentId: string): boolean {
  return actor.assignments.some((a) => a.enrolmentId === enrolmentId);
}

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
  if (isAssignedSupervisor(actor, enrolment.id)) return allow;
  if (hasFacultyScope(actor, enrolment)) return allow;
  return deny("not_assigned");
}

// The pinned curriculum is readable by anyone who can read the enrolment.
export const canReadCurriculum = canReadEnrolment;

export function canReadEvidence(
  actor: Actor,
  evidence: EvidenceContext,
  enrolment: EnrolmentContext,
): Decision {
  if (!hasTenantMembership(actor, evidence.tenantId)) return deny("no_tenant_membership");
  if (evidence.tenantId !== enrolment.tenantId || evidence.enrolmentId !== enrolment.id) {
    return deny("not_visible");
  }
  if (evidence.deletedAt) {
    // The author retains grace-period access to restore; nobody else reads it.
    return evidence.authorUserId === actor.userId ? allow : deny("deleted");
  }
  if (evidence.authorUserId === actor.userId) return allow;

  // Non-authors never see private content, whatever their role (spec/01).
  if (evidence.visibility === "private") return deny("not_visible");
  if (evidence.visibility === "supervisors") {
    return isAssignedSupervisor(actor, enrolment.id) ? allow : deny("not_visible");
  }
  // faculty visibility: assigned supervisors and scoped faculty.
  if (isAssignedSupervisor(actor, enrolment.id)) return allow;
  if (hasFacultyScope(actor, enrolment)) return allow;
  return deny("not_visible");
}

export function canEditEvidence(
  actor: Actor,
  evidence: EvidenceContext,
  enrolment: EnrolmentContext,
): Decision {
  if (!hasTenantMembership(actor, evidence.tenantId)) return deny("no_tenant_membership");
  // Only the author fellow edits their evidence — supervisors comment, they
  // never edit fellow-authored work (FR-EV-011).
  if (evidence.authorUserId !== actor.userId) return deny("not_owner");
  if (!isOwnEnrolment(actor, enrolment)) return deny("not_owner");
  if (evidence.deletedAt) return deny("deleted");
  if (evidence.archivedAt) return deny("wrong_state");
  return allow;
}

export const canShareEvidence = canEditEvidence;
export const canDeleteEvidence = canEditEvidence;

export function canCreateEvidence(actor: Actor, enrolment: EnrolmentContext): Decision {
  if (!hasTenantMembership(actor, enrolment.tenantId)) return deny("no_tenant_membership");
  if (!isOwnEnrolment(actor, enrolment)) return deny("not_owner");
  return allow;
}

export interface AttachmentContext {
  tenantId: string;
  parentType: string;
  scanStatus: string;
  deletedAt: Date | null;
}

// Attachments inherit their parent's visibility exactly in MVP (spec/05):
// the caller passes the parent evidence decision.
export function canDownloadAttachment(
  attachment: AttachmentContext,
  parentDecision: Decision,
): Decision {
  if (!parentDecision.allow) return parentDecision;
  if (attachment.deletedAt) return deny("deleted");
  if (attachment.scanStatus !== "clean") return deny("wrong_state");
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
