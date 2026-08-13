import type { Fixtures, PersonaId } from "./fixtures";

// Every HTTP surface, with the personas allowed on it — the generated matrix
// denies everyone else (spec/15: generated policy-table cases so new
// endpoints cannot omit the matrix silently). A companion test fails when a
// route file on disk is missing from this registry.

export interface Surface {
  id: string;
  // Repo file that implements it — used by the completeness check.
  routeFile: string;
  kind: "api" | "page";
  method: string;
  path: (f: Fixtures) => string;
  body?: (f: Fixtures) => unknown;
  allowed: PersonaId[];
  // Expected status for an allowed persona (default 200; pages allow 200).
  allowStatus?: number;
  // Public surfaces skip persona iteration (uniform-response endpoints).
  public?: boolean;
  // Suspended/unauth behave like unauthenticated: API 401, pages redirect.
  notes?: string;
}

export const ALL_PERSONAS: PersonaId[] = [
  "unauth",
  "wrongTenantFellow",
  "noRoleUser",
  "owner",
  "otherFellow",
  "assignedSupervisor",
  "priorSupervisor",
  "facultyTenant",
  "facultyWrongProgramme",
  "suspended",
  "tenantAdmin",
];

// "Same tenant, no role" (noRoleUser) is always denied — membership grants
// are role-scoped, and a user with no active grant resolves no tenant at all.
const TENANT_MEMBERS: PersonaId[] = [
  "owner",
  "otherFellow",
  "assignedSupervisor",
  "priorSupervisor",
  "facultyTenant",
  "facultyWrongProgramme",
  "tenantAdmin",
];

export const SURFACES: Surface[] = [
  // ---- public auth surfaces (uniform responses; not persona-iterated) ----
  {
    id: "auth.magic-link",
    routeFile: "src/app/api/v1/auth/magic-link/route.ts",
    kind: "api",
    method: "POST",
    path: () => "/api/v1/auth/magic-link",
    body: () => ({ email: "nobody@authz.example.org" }),
    allowed: [],
    public: true,
  },
  {
    id: "auth.verify",
    routeFile: "src/app/api/v1/auth/verify/route.ts",
    kind: "api",
    method: "POST",
    path: () => "/api/v1/auth/verify",
    body: () => ({ token: "invalid-token-invalid-token" }),
    allowed: [],
    public: true,
  },
  {
    id: "auth.sign-out",
    routeFile: "src/app/api/v1/auth/sign-out/route.ts",
    kind: "api",
    method: "POST",
    path: () => "/api/v1/auth/sign-out",
    body: () => ({}),
    allowed: [],
    public: true,
  },
  {
    id: "invitations.accept",
    routeFile: "src/app/api/v1/invitations/accept/route.ts",
    kind: "api",
    method: "POST",
    path: () => "/api/v1/invitations/accept",
    body: () => ({
      token: "invalid-token-invalid-token",
      preferredName: "X",
      acknowledgedNotices: [
        { noticeType: "privacy_notice", noticeVersion: "t" },
        { noticeType: "acceptable_use", noticeVersion: "t" },
        { noticeType: "no_patient_data", noticeVersion: "t" },
      ],
    }),
    allowed: [],
    public: true,
  },

  // ---- authenticated API surfaces ----
  {
    id: "me",
    routeFile: "src/app/api/v1/me/route.ts",
    kind: "api",
    method: "GET",
    path: () => "/api/v1/me",
    // Any live session may introspect itself — even with no memberships.
    allowed: [...TENANT_MEMBERS, "wrongTenantFellow", "noRoleUser"],
  },
  {
    id: "evidence.list",
    routeFile: "src/app/api/v1/enrolments/[enrolmentId]/evidence/route.ts",
    kind: "api",
    method: "GET",
    path: (f) => `/api/v1/enrolments/${f.enrolmentId}/evidence`,
    allowed: ["owner", "assignedSupervisor", "facultyTenant"],
  },
  {
    id: "evidence.create",
    routeFile: "src/app/api/v1/enrolments/[enrolmentId]/evidence/route.ts",
    kind: "api",
    method: "POST",
    path: (f) => `/api/v1/enrolments/${f.enrolmentId}/evidence`,
    body: (f) => ({ title: "matrix create probe", evidenceTypeId: f.evidenceTypeId }),
    allowed: ["owner"],
    allowStatus: 201,
  },
  {
    id: "evidence.read.private",
    routeFile: "src/app/api/v1/evidence/[evidenceId]/route.ts",
    kind: "api",
    method: "GET",
    path: (f) => `/api/v1/evidence/${f.privateDraftId}`,
    allowed: ["owner"],
  },
  {
    id: "evidence.read.sharedSupervisors",
    routeFile: "src/app/api/v1/evidence/[evidenceId]/route.ts",
    kind: "api",
    method: "GET",
    path: (f) => `/api/v1/evidence/${f.sharedSupervisorsId}`,
    allowed: ["owner", "assignedSupervisor"],
  },
  {
    id: "evidence.read.facultyShared",
    routeFile: "src/app/api/v1/evidence/[evidenceId]/route.ts",
    kind: "api",
    method: "GET",
    path: (f) => `/api/v1/evidence/${f.facultySharedId}`,
    allowed: ["owner", "assignedSupervisor", "facultyTenant"],
  },
  {
    id: "evidence.read.archived",
    routeFile: "src/app/api/v1/evidence/[evidenceId]/route.ts",
    kind: "api",
    method: "GET",
    path: (f) => `/api/v1/evidence/${f.archivedSharedId}`,
    // Archived items stay readable to the author; hidden from others' lists
    // but readable if directly permitted — M1 position: author only.
    allowed: ["owner", "assignedSupervisor"],
    notes: "archived keeps prior audience for direct reads",
  },
  {
    id: "evidence.read.softDeleted",
    routeFile: "src/app/api/v1/evidence/[evidenceId]/route.ts",
    kind: "api",
    method: "GET",
    path: (f) => `/api/v1/evidence/${f.softDeletedId}`,
    allowed: ["owner"],
  },
  {
    id: "evidence.update",
    routeFile: "src/app/api/v1/evidence/[evidenceId]/route.ts",
    kind: "api",
    method: "PATCH",
    path: (f) => `/api/v1/evidence/${f.sharedSupervisorsId}`,
    body: () => ({ title: "matrix update probe" }),
    // Only the author edits (FR-EV-011). Allowed persona hits 428 (no
    // If-Match) which proves authorization passed without mutating.
    allowed: ["owner"],
    allowStatus: 428,
  },
  {
    id: "evidence.delete",
    routeFile: "src/app/api/v1/evidence/[evidenceId]/route.ts",
    kind: "api",
    method: "DELETE",
    path: (f) => `/api/v1/evidence/${f.archivedSharedId}`,
    // Archived items are not editable; even the owner is denied here, which
    // exercises the object-state row of the matrix.
    allowed: [],
  },
  {
    id: "evidence.share",
    routeFile: "src/app/api/v1/evidence/[evidenceId]/share/route.ts",
    kind: "api",
    method: "POST",
    path: (f) => `/api/v1/evidence/${f.privateDraftId}`.replace(/$/, "/share"),
    body: () => ({ visibility: "private", audienceConfirmed: true }),
    // No-op transition (already private) keeps the fixture stable.
    allowed: ["owner"],
  },
  {
    id: "evidence.archive",
    routeFile: "src/app/api/v1/evidence/[evidenceId]/archive/route.ts",
    kind: "api",
    method: "POST",
    path: (f) => `/api/v1/evidence/${f.archivedSharedId}/archive`,
    // Already archived → wrong state, denied for all (owner included).
    allowed: [],
  },
  {
    id: "evidence.restore",
    routeFile: "src/app/api/v1/evidence/[evidenceId]/restore/route.ts",
    kind: "api",
    method: "POST",
    path: (f) => `/api/v1/evidence/${f.archivedSharedId}/restore`,
    allowed: ["owner"],
  },
  {
    id: "evidence.revisions.read",
    routeFile: "src/app/api/v1/evidence/[evidenceId]/revisions/route.ts",
    kind: "api",
    method: "GET",
    path: (f) => `/api/v1/evidence/${f.privateDraftId}/revisions`,
    allowed: ["owner"],
  },
  {
    id: "evidence.revisions.backup",
    routeFile: "src/app/api/v1/evidence/[evidenceId]/revisions/route.ts",
    kind: "api",
    method: "POST",
    path: (f) => `/api/v1/evidence/${f.privateDraftId}/revisions`,
    body: () => ({ snapshot: { probe: true } }),
    allowed: ["owner"],
    allowStatus: 201,
  },
  {
    id: "evidence.objectives.put",
    routeFile: "src/app/api/v1/evidence/[evidenceId]/objectives/route.ts",
    kind: "api",
    method: "PUT",
    path: (f) => `/api/v1/evidence/${f.privateDraftId}/objectives`,
    body: () => ({ objectiveIds: [] }),
    allowed: ["owner"],
  },
  {
    id: "evidence.duties.put",
    routeFile: "src/app/api/v1/evidence/[evidenceId]/duties/route.ts",
    kind: "api",
    method: "PUT",
    path: (f) => `/api/v1/evidence/${f.privateDraftId}/duties`,
    body: () => ({ dutyIds: [] }),
    allowed: ["owner"],
  },
  {
    id: "evidence.links.read",
    routeFile: "src/app/api/v1/evidence/[evidenceId]/links/route.ts",
    kind: "api",
    method: "GET",
    path: (f) => `/api/v1/evidence/${f.sharedSupervisorsId}/links`,
    allowed: ["owner", "assignedSupervisor"],
  },
  {
    id: "evidence.links.add",
    routeFile: "src/app/api/v1/evidence/[evidenceId]/links/route.ts",
    kind: "api",
    method: "POST",
    path: (f) => `/api/v1/evidence/${f.privateDraftId}/links`,
    body: () => ({ url: "https://example.org/authz-probe" }),
    allowed: ["owner"],
    allowStatus: 201,
  },
  {
    id: "evidence.attachments.list",
    routeFile: "src/app/api/v1/evidence/[evidenceId]/attachments/route.ts",
    kind: "api",
    method: "GET",
    path: (f) => `/api/v1/evidence/${f.sharedSupervisorsId}/attachments`,
    allowed: ["owner", "assignedSupervisor"],
  },
  {
    id: "attachments.initiate",
    routeFile: "src/app/api/v1/attachments/initiate/route.ts",
    kind: "api",
    method: "POST",
    path: () => "/api/v1/attachments/initiate",
    body: (f) => ({
      evidenceId: f.privateDraftId,
      filename: "probe.pdf",
      mediaTypeClaimed: "application/pdf",
      sizeBytes: 1000,
      patientDataConfirmed: true,
    }),
    allowed: ["owner"],
    allowStatus: 201,
  },
  {
    id: "attachments.complete",
    routeFile: "src/app/api/v1/attachments/[attachmentId]/complete/route.ts",
    kind: "api",
    method: "POST",
    path: (f) => `/api/v1/attachments/${f.cleanAttachmentOnPrivateId}/complete`,
    body: () => ({}),
    // Already clean → wrong state; denied for all (state row of the matrix).
    allowed: [],
  },
  {
    id: "attachments.download.onShared",
    routeFile: "src/app/api/v1/attachments/[attachmentId]/download/route.ts",
    kind: "api",
    method: "GET",
    path: (f) => `/api/v1/attachments/${f.cleanAttachmentOnSharedId}/download`,
    allowed: ["owner", "assignedSupervisor"],
    allowStatus: 302,
  },
  {
    id: "attachments.download.onPrivate",
    routeFile: "src/app/api/v1/attachments/[attachmentId]/download/route.ts",
    kind: "api",
    method: "GET",
    path: (f) => `/api/v1/attachments/${f.cleanAttachmentOnPrivateId}/download`,
    allowed: ["owner"],
    allowStatus: 302,
  },
  {
    id: "attachments.delete",
    routeFile: "src/app/api/v1/attachments/[attachmentId]/route.ts",
    kind: "api",
    method: "DELETE",
    path: (f) => `/api/v1/attachments/${f.cleanAttachmentOnPrivateId}`,
    // Defined after the download surfaces: tests run in registry order, so
    // the owner's successful delete cannot break the earlier download cases.
    allowed: ["owner"],
  },
  {
    id: "invitations.create",
    routeFile: "src/app/api/v1/invitations/route.ts",
    kind: "api",
    method: "POST",
    path: () => "/api/v1/invitations",
    body: (f) => ({
      tenantId: f.tenantAId,
      email: `matrix-invite-${f.tenantASlug}@authz.example.org`,
      displayName: "Matrix Probe",
      role: "supervisor",
    }),
    allowed: ["facultyTenant", "facultyWrongProgramme", "tenantAdmin"],
    allowStatus: 201,
  },

  // ---- pages ----
  {
    id: "page.today",
    routeFile: "src/app/t/[tenantSlug]/(shell)/today/page.tsx",
    kind: "page",
    method: "GET",
    path: (f) => `/t/${f.tenantASlug}/today`,
    allowed: TENANT_MEMBERS,
  },
  {
    id: "page.log",
    routeFile: "src/app/t/[tenantSlug]/(shell)/log/page.tsx",
    kind: "page",
    method: "GET",
    path: (f) => `/t/${f.tenantASlug}/log`,
    allowed: ["owner"],
  },
  {
    id: "page.log.new",
    routeFile: "src/app/t/[tenantSlug]/(shell)/log/new/page.tsx",
    kind: "page",
    method: "GET",
    path: (f) => `/t/${f.tenantASlug}/log/new`,
    allowed: ["owner"],
  },
  {
    id: "page.evidence.private",
    routeFile: "src/app/t/[tenantSlug]/(shell)/log/[evidenceId]/page.tsx",
    kind: "page",
    method: "GET",
    path: (f) => `/t/${f.tenantASlug}/log/${f.privateDraftId}`,
    allowed: ["owner"],
  },
  {
    id: "page.evidence.shared",
    routeFile: "src/app/t/[tenantSlug]/(shell)/log/[evidenceId]/page.tsx",
    kind: "page",
    method: "GET",
    path: (f) => `/t/${f.tenantASlug}/log/${f.sharedSupervisorsId}`,
    allowed: ["owner", "assignedSupervisor"],
  },
  {
    id: "page.evidence.share",
    routeFile: "src/app/t/[tenantSlug]/(shell)/log/[evidenceId]/share/page.tsx",
    kind: "page",
    method: "GET",
    path: (f) => `/t/${f.tenantASlug}/log/${f.privateDraftId}/share`,
    allowed: ["owner"],
  },
  {
    id: "page.curriculum",
    routeFile: "src/app/t/[tenantSlug]/(shell)/curriculum/page.tsx",
    kind: "page",
    method: "GET",
    path: (f) => `/t/${f.tenantASlug}/curriculum`,
    // The curriculum page is the fellow's own view of their pinned release.
    allowed: ["owner"],
  },
  {
    id: "page.curriculum.objective",
    routeFile: "src/app/t/[tenantSlug]/(shell)/curriculum/[objectiveId]/page.tsx",
    kind: "page",
    method: "GET",
    path: (f) => `/t/${f.tenantASlug}/curriculum/${f.privateDraftId}`,
    allowed: [],
  },
  {
    id: "page.account",
    routeFile: "src/app/t/[tenantSlug]/(shell)/account/page.tsx",
    kind: "page",
    method: "GET",
    path: (f) => `/t/${f.tenantASlug}/account`,
    allowed: TENANT_MEMBERS,
  },
  {
    id: "page.supervisor.fellows",
    routeFile: "src/app/t/[tenantSlug]/(shell)/supervisor/fellows/page.tsx",
    kind: "page",
    method: "GET",
    path: (f) => `/t/${f.tenantASlug}/supervisor/fellows`,
    allowed: ["assignedSupervisor", "priorSupervisor"],
    notes: "role-gated list; prior supervisor sees an empty list, never items",
  },
  {
    id: "page.supervisor.fellow",
    routeFile: "src/app/t/[tenantSlug]/(shell)/supervisor/fellows/[enrolmentId]/page.tsx",
    kind: "page",
    method: "GET",
    path: (f) => `/t/${f.tenantASlug}/supervisor/fellows/${f.enrolmentId}`,
    allowed: ["assignedSupervisor"],
  },
  {
    id: "page.faculty.people",
    routeFile: "src/app/t/[tenantSlug]/(shell)/faculty/people/page.tsx",
    kind: "page",
    method: "GET",
    path: (f) => `/t/${f.tenantASlug}/faculty/people`,
    allowed: ["facultyTenant", "facultyWrongProgramme", "tenantAdmin"],
  },

  // ---- public pages (rendered for everyone) ----
  {
    id: "page.sign-in",
    routeFile: "src/app/(public)/sign-in/page.tsx",
    kind: "page",
    method: "GET",
    path: () => "/sign-in",
    allowed: [],
    public: true,
  },
  {
    id: "page.auth.verify",
    routeFile: "src/app/(public)/auth/verify/page.tsx",
    kind: "page",
    method: "GET",
    path: () => "/auth/verify",
    allowed: [],
    public: true,
  },
  {
    id: "page.invite",
    routeFile: "src/app/(public)/invite/[token]/page.tsx",
    kind: "page",
    method: "GET",
    path: () => "/invite/not-a-real-token-authz",
    allowed: [],
    public: true,
  },
  {
    id: "page.root",
    routeFile: "src/app/page.tsx",
    kind: "page",
    method: "GET",
    path: () => "/",
    allowed: [],
    public: true,
  },
];
