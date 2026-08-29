import { describe, expect, it } from "vitest";
import type { Actor } from "@/server/policy/actor";
import {
  canCreateEvidence,
  canDownloadAttachment,
  canEditEvidence,
  canExportDiary,
  canInvite,
  canReadEnrolment,
  canReadEvidence,
  type EnrolmentContext,
  type EvidenceContext,
} from "@/server/policy/policy";

// Truth tables for the pure policy functions (spec/01 permission matrix).

const TENANT_A = "aaaaaaaa-0000-0000-0000-000000000001";
const TENANT_B = "bbbbbbbb-0000-0000-0000-000000000001";
const ENROLMENT = "eeeeeeee-0000-0000-0000-000000000001";
const PROGRAMME = "eeeeeeee-0000-0000-0000-00000000000a";
const COHORT = "eeeeeeee-0000-0000-0000-00000000000b";

const FELLOW = "11111111-0000-0000-0000-000000000001";
const OTHER_FELLOW = "11111111-0000-0000-0000-000000000002";
const SUPERVISOR = "22222222-0000-0000-0000-000000000001";
const FACULTY = "33333333-0000-0000-0000-000000000001";

function actor(overrides: Partial<Actor>): Actor {
  return {
    userId: FELLOW,
    displayName: "Test",
    emailNormalised: "test@example.org",
    memberships: [],
    assignments: [],
    ...overrides,
  };
}

const enrolment: EnrolmentContext = {
  id: ENROLMENT,
  tenantId: TENANT_A,
  fellowUserId: FELLOW,
  programmeId: PROGRAMME,
  cohortId: COHORT,
  diaryState: "open",
  diaryFinishCycle: 0,
  diaryAccessEndsAt: null,
};

function evidence(overrides: Partial<EvidenceContext> = {}): EvidenceContext {
  return {
    id: "44444444-0000-0000-0000-000000000001",
    tenantId: TENANT_A,
    enrolmentId: ENROLMENT,
    authorUserId: FELLOW,
    visibility: "private",
    workflowState: "draft",
    deletedAt: null,
    archivedAt: null,
    ...overrides,
  };
}

const ownerFellow = actor({
  memberships: [{ tenantId: TENANT_A, role: "fellow", scopeType: "tenant", scopeId: null }],
});
const otherFellow = actor({
  userId: OTHER_FELLOW,
  memberships: [{ tenantId: TENANT_A, role: "fellow", scopeType: "tenant", scopeId: null }],
});
const assignedSupervisor = actor({
  userId: SUPERVISOR,
  memberships: [{ tenantId: TENANT_A, role: "supervisor", scopeType: "tenant", scopeId: null }],
  assignments: [
    { tenantId: TENANT_A, enrolmentId: ENROLMENT, assignmentType: "primary", canSign: true },
  ],
});
const priorSupervisor = actor({
  userId: SUPERVISOR,
  memberships: [{ tenantId: TENANT_A, role: "supervisor", scopeType: "tenant", scopeId: null }],
  assignments: [], // dated assignment ended — actor loader excludes it
});
const facultyMember = actor({
  userId: FACULTY,
  memberships: [{ tenantId: TENANT_A, role: "faculty", scopeType: "tenant", scopeId: null }],
});
const wrongProgrammeFaculty = actor({
  userId: FACULTY,
  memberships: [
    {
      tenantId: TENANT_A,
      role: "faculty",
      scopeType: "programme",
      scopeId: "99999999-0000-0000-0000-000000000009",
    },
  ],
});
const wrongTenantFellow = actor({
  memberships: [{ tenantId: TENANT_B, role: "fellow", scopeType: "tenant", scopeId: null }],
});

describe("canReadEvidence", () => {
  it("author always reads their own item", () => {
    expect(canReadEvidence(ownerFellow, evidence(), enrolment).allow).toBe(true);
  });

  it("private items are invisible to everyone but the author", () => {
    const item = evidence({ visibility: "private" });
    expect(canReadEvidence(otherFellow, item, enrolment).allow).toBe(false);
    expect(canReadEvidence(assignedSupervisor, item, enrolment).allow).toBe(false);
    expect(canReadEvidence(facultyMember, item, enrolment).allow).toBe(false);
  });

  it("legacy supervisor visibility never grants diary access", () => {
    const item = evidence({ visibility: "supervisors", workflowState: "shared" });
    expect(canReadEvidence(ownerFellow, item, enrolment).allow).toBe(true);
    expect(canReadEvidence(assignedSupervisor, item, enrolment).allow).toBe(false);
    expect(canReadEvidence(priorSupervisor, item, enrolment).allow).toBe(false);
    expect(canReadEvidence(otherFellow, item, enrolment).allow).toBe(false);
    expect(canReadEvidence(facultyMember, item, enrolment).allow).toBe(false);
  });

  it("legacy faculty visibility never grants diary access", () => {
    const item = evidence({ visibility: "faculty", workflowState: "shared" });
    expect(canReadEvidence(facultyMember, item, enrolment).allow).toBe(false);
    expect(canReadEvidence(wrongProgrammeFaculty, item, enrolment).allow).toBe(false);
    expect(canReadEvidence(assignedSupervisor, item, enrolment).allow).toBe(false);
  });

  it("cross-tenant actors are denied whatever the visibility", () => {
    const item = evidence({ visibility: "faculty", workflowState: "shared" });
    expect(canReadEvidence(wrongTenantFellow, item, enrolment).allow).toBe(false);
  });

  it("deleted items are readable only by the author (grace restore)", () => {
    const item = evidence({ deletedAt: new Date(), visibility: "supervisors", workflowState: "shared" });
    expect(canReadEvidence(ownerFellow, item, enrolment).allow).toBe(true);
    expect(canReadEvidence(assignedSupervisor, item, enrolment).allow).toBe(false);
  });
});

describe("canEditEvidence", () => {
  it("only the author fellow edits — supervisors never do (FR-EV-011)", () => {
    const item = evidence({ visibility: "supervisors", workflowState: "shared" });
    expect(canEditEvidence(ownerFellow, item, enrolment).allow).toBe(true);
    expect(canEditEvidence(assignedSupervisor, item, enrolment).allow).toBe(false);
    expect(canEditEvidence(facultyMember, item, enrolment).allow).toBe(false);
  });

  it("archived and deleted items are not editable", () => {
    expect(canEditEvidence(ownerFellow, evidence({ archivedAt: new Date() }), enrolment).allow).toBe(false);
    expect(canEditEvidence(ownerFellow, evidence({ deletedAt: new Date() }), enrolment).allow).toBe(false);
  });

  it("a finished or purged diary is read-only", () => {
    expect(
      canEditEvidence(ownerFellow, evidence(), { ...enrolment, diaryState: "finished" }).allow,
    ).toBe(false);
    expect(
      canEditEvidence(ownerFellow, evidence(), { ...enrolment, diaryState: "purged" }).allow,
    ).toBe(false);
  });
});

describe("canReadEnrolment / canCreateEvidence", () => {
  it("the fellow and scoped programme staff read enrolment metadata", () => {
    expect(canReadEnrolment(ownerFellow, enrolment).allow).toBe(true);
    expect(canReadEnrolment(assignedSupervisor, enrolment).allow).toBe(false);
    expect(canReadEnrolment(facultyMember, enrolment).allow).toBe(true);
    expect(canReadEnrolment(otherFellow, enrolment).allow).toBe(false);
    expect(canReadEnrolment(priorSupervisor, enrolment).allow).toBe(false);
    expect(canReadEnrolment(wrongTenantFellow, enrolment).allow).toBe(false);
  });

  it("only the enrolled fellow creates evidence", () => {
    expect(canCreateEvidence(ownerFellow, enrolment).allow).toBe(true);
    expect(canCreateEvidence(assignedSupervisor, enrolment).allow).toBe(false);
    expect(canCreateEvidence(facultyMember, enrolment).allow).toBe(false);
    expect(canCreateEvidence(ownerFellow, { ...enrolment, diaryState: "finished" }).allow).toBe(false);
  });
});

describe("canDownloadAttachment", () => {
  const cleanAttachment = {
    tenantId: TENANT_A,
    parentType: "evidence_item",
    scanStatus: "clean",
    deletedAt: null,
  };

  it("follows the parent decision", () => {
    expect(canDownloadAttachment(cleanAttachment, { allow: true }).allow).toBe(true);
    expect(
      canDownloadAttachment(cleanAttachment, { allow: false, reason: "not_visible" }).allow,
    ).toBe(false);
  });

  it("blocks anything not scanned clean (FR-FI-002)", () => {
    for (const scanStatus of ["awaiting_upload", "pending_scan", "rejected", "quarantined"]) {
      expect(
        canDownloadAttachment({ ...cleanAttachment, scanStatus }, { allow: true }).allow,
      ).toBe(false);
    }
  });
});

describe("canExportDiary", () => {
  it("allows only the owner before the access deadline", () => {
    expect(canExportDiary(ownerFellow, enrolment).allow).toBe(true);
    expect(canExportDiary(facultyMember, enrolment).allow).toBe(false);
    expect(canExportDiary(assignedSupervisor, enrolment).allow).toBe(false);
    expect(
      canExportDiary(ownerFellow, {
        ...enrolment,
        diaryState: "finished",
        diaryAccessEndsAt: new Date(Date.now() + 60_000),
      }).allow,
    ).toBe(true);
    expect(
      canExportDiary(ownerFellow, {
        ...enrolment,
        diaryState: "finished",
        diaryAccessEndsAt: new Date(Date.now() - 60_000),
      }).allow,
    ).toBe(false);
    expect(
      canExportDiary(ownerFellow, { ...enrolment, diaryState: "purged" }).allow,
    ).toBe(false);
  });
});

describe("canInvite", () => {
  it("faculty and tenant admins invite; fellows and supervisors do not", () => {
    expect(canInvite(facultyMember, TENANT_A).allow).toBe(true);
    expect(canInvite(ownerFellow, TENANT_A).allow).toBe(false);
    expect(canInvite(assignedSupervisor, TENANT_A).allow).toBe(false);
    expect(canInvite(facultyMember, TENANT_B).allow).toBe(false);
  });
});
