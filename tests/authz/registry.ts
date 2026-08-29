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
    body: () => ({
      token: "invalid-token-invalid-token",
      acknowledgedNotices: [
        { noticeType: "privacy_notice", noticeVersion: "t" },
        { noticeType: "acceptable_use", noticeVersion: "t" },
        { noticeType: "no_patient_data", noticeVersion: "t" },
      ],
    }),
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

  {
    id: "health",
    routeFile: "src/app/api/health/route.ts",
    kind: "api",
    method: "GET",
    path: () => "/api/health",
    allowed: [],
    public: true,
  },
  {
    id: "security-txt",
    routeFile: "src/app/.well-known/security.txt/route.ts",
    kind: "api",
    method: "GET",
    path: () => "/.well-known/security.txt",
    allowed: [],
    public: true,
    notes: "404 unless SECURITY_CONTACT is configured.",
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
    id: "me.diary-key.get",
    routeFile: "src/app/api/v1/me/diary-key/route.ts",
    kind: "api",
    method: "GET",
    path: () => "/api/v1/me/diary-key",
    // Wrapped key material only (ADR-007); any live session may read its own.
    allowed: [...TENANT_MEMBERS, "wrongTenantFellow", "noRoleUser"],
  },
  {
    id: "me.diary-key.put",
    routeFile: "src/app/api/v1/me/diary-key/route.ts",
    kind: "api",
    method: "PUT",
    path: () => "/api/v1/me/diary-key",
    // Deliberately invalid material (iterations below the floor): proves the
    // authentication gate without writing a key that would seal a persona's
    // diary for the rest of the matrix.
    body: () => ({
      material: {
        keyVersion: 1,
        kdf: { alg: "PBKDF2-SHA256", iterations: 1 },
        passphraseSalt: "AAAAAAAAAAAAAAAAAAAAAA",
        wrappedByPassphrase: { iv: "AAAAAAAAAAAAAAAA", ct: "A".repeat(64) },
        recoverySalt: "AAAAAAAAAAAAAAAAAAAAAA",
        wrappedByRecovery: { iv: "AAAAAAAAAAAAAAAA", ct: "A".repeat(64) },
      },
    }),
    allowed: [...TENANT_MEMBERS, "wrongTenantFellow", "noRoleUser"],
    allowStatus: 422,
  },
  {
    id: "me.unsealed",
    routeFile: "src/app/api/v1/me/unsealed/route.ts",
    kind: "api",
    method: "GET",
    path: () => "/api/v1/me/unsealed",
    allowed: [...TENANT_MEMBERS, "wrongTenantFellow", "noRoleUser"],
  },
  {
    id: "enrolments.export-bundle",
    routeFile: "src/app/api/v1/enrolments/[enrolmentId]/export-bundle/route.ts",
    kind: "api",
    method: "GET",
    path: (f) => `/api/v1/enrolments/${f.enrolmentId}/export-bundle`,
    allowed: ["owner"],
  },
  {
    id: "evidence.list",
    routeFile: "src/app/api/v1/enrolments/[enrolmentId]/diary-entries/route.ts",
    kind: "api",
    method: "GET",
    path: (f) => `/api/v1/enrolments/${f.enrolmentId}/diary-entries`,
    allowed: ["owner"],
  },
  {
    id: "evidence.create",
    routeFile: "src/app/api/v1/enrolments/[enrolmentId]/diary-entries/route.ts",
    kind: "api",
    method: "POST",
    path: (f) => `/api/v1/enrolments/${f.enrolmentId}/diary-entries`,
    body: (f) => ({ title: "matrix create probe", evidenceTypeId: f.evidenceTypeId }),
    allowed: ["owner"],
    allowStatus: 201,
  },
  {
    id: "evidence.read.private",
    routeFile: "src/app/api/v1/diary-entries/[evidenceId]/route.ts",
    kind: "api",
    method: "GET",
    path: (f) => `/api/v1/diary-entries/${f.privateDraftId}`,
    allowed: ["owner"],
  },
  {
    id: "evidence.read.sharedSupervisors",
    routeFile: "src/app/api/v1/diary-entries/[evidenceId]/route.ts",
    kind: "api",
    method: "GET",
    path: (f) => `/api/v1/diary-entries/${f.sharedSupervisorsId}`,
    allowed: ["owner"],
  },
  {
    id: "evidence.read.facultyShared",
    routeFile: "src/app/api/v1/diary-entries/[evidenceId]/route.ts",
    kind: "api",
    method: "GET",
    path: (f) => `/api/v1/diary-entries/${f.facultySharedId}`,
    allowed: ["owner"],
  },
  {
    id: "evidence.read.archived",
    routeFile: "src/app/api/v1/diary-entries/[evidenceId]/route.ts",
    kind: "api",
    method: "GET",
    path: (f) => `/api/v1/diary-entries/${f.archivedSharedId}`,
    // Archived items stay readable to the author; hidden from others' lists
    // but readable if directly permitted — M1 position: author only.
    allowed: ["owner"],
  },
  {
    id: "evidence.read.softDeleted",
    routeFile: "src/app/api/v1/diary-entries/[evidenceId]/route.ts",
    kind: "api",
    method: "GET",
    path: (f) => `/api/v1/diary-entries/${f.softDeletedId}`,
    allowed: ["owner"],
  },
  {
    id: "evidence.update",
    routeFile: "src/app/api/v1/diary-entries/[evidenceId]/route.ts",
    kind: "api",
    method: "PATCH",
    path: (f) => `/api/v1/diary-entries/${f.sharedSupervisorsId}`,
    body: () => ({ title: "matrix update probe" }),
    // Only the author edits (FR-EV-011). Allowed persona hits 428 (no
    // If-Match) which proves authorization passed without mutating.
    allowed: ["owner"],
    allowStatus: 428,
  },
  {
    id: "evidence.delete",
    routeFile: "src/app/api/v1/diary-entries/[evidenceId]/route.ts",
    kind: "api",
    method: "DELETE",
    path: (f) => `/api/v1/diary-entries/${f.archivedSharedId}`,
    // Archived items are not editable; even the owner is denied here, which
    // exercises the object-state row of the matrix.
    allowed: [],
  },
  {
    id: "evidence.archive",
    routeFile: "src/app/api/v1/diary-entries/[evidenceId]/archive/route.ts",
    kind: "api",
    method: "POST",
    path: (f) => `/api/v1/diary-entries/${f.archivedSharedId}/archive`,
    // Already archived → wrong state, denied for all (owner included).
    allowed: [],
  },
  {
    id: "evidence.restore",
    routeFile: "src/app/api/v1/diary-entries/[evidenceId]/restore/route.ts",
    kind: "api",
    method: "POST",
    path: (f) => `/api/v1/diary-entries/${f.archivedSharedId}/restore`,
    allowed: ["owner"],
  },
  {
    id: "evidence.revisions.read",
    routeFile: "src/app/api/v1/diary-entries/[evidenceId]/revisions/route.ts",
    kind: "api",
    method: "GET",
    path: (f) => `/api/v1/diary-entries/${f.privateDraftId}/revisions`,
    allowed: ["owner"],
  },
  {
    id: "evidence.revisions.backup",
    routeFile: "src/app/api/v1/diary-entries/[evidenceId]/revisions/route.ts",
    kind: "api",
    method: "POST",
    path: (f) => `/api/v1/diary-entries/${f.privateDraftId}/revisions`,
    body: () => ({ snapshot: { probe: true } }),
    allowed: ["owner"],
    allowStatus: 201,
  },
  {
    id: "evidence.objectives.put",
    routeFile: "src/app/api/v1/diary-entries/[evidenceId]/objectives/route.ts",
    kind: "api",
    method: "PUT",
    path: (f) => `/api/v1/diary-entries/${f.privateDraftId}/objectives`,
    body: () => ({ objectiveIds: [] }),
    allowed: ["owner"],
  },
  {
    id: "evidence.links.read",
    routeFile: "src/app/api/v1/diary-entries/[evidenceId]/links/route.ts",
    kind: "api",
    method: "GET",
    path: (f) => `/api/v1/diary-entries/${f.sharedSupervisorsId}/links`,
    allowed: ["owner"],
  },
  {
    id: "evidence.links.add",
    routeFile: "src/app/api/v1/diary-entries/[evidenceId]/links/route.ts",
    kind: "api",
    method: "POST",
    path: (f) => `/api/v1/diary-entries/${f.privateDraftId}/links`,
    body: () => ({ url: "https://example.org/authz-probe" }),
    allowed: ["owner"],
    allowStatus: 201,
  },
  {
    id: "evidence.attachments.list",
    routeFile: "src/app/api/v1/diary-entries/[evidenceId]/attachments/route.ts",
    kind: "api",
    method: "GET",
    path: (f) => `/api/v1/diary-entries/${f.sharedSupervisorsId}/attachments`,
    allowed: ["owner"],
  },
  {
    id: "attachments.initiate",
    routeFile: "src/app/api/v1/attachments/initiate/route.ts",
    kind: "api",
    method: "POST",
    path: () => "/api/v1/attachments/initiate",
    body: (f) => ({
      entryId: f.privateDraftId,
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
    allowed: ["owner"],
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
  {
    id: "exports.create",
    routeFile: "src/app/api/v1/exports/route.ts",
    kind: "api",
    method: "POST",
    path: () => "/api/v1/exports",
    body: (f) => ({ enrolmentId: f.lifecycleEnrolmentId }),
    allowed: ["otherFellow"],
    allowStatus: 202,
  },
  {
    id: "exports.status",
    routeFile: "src/app/api/v1/exports/[exportId]/route.ts",
    kind: "api",
    method: "GET",
    path: (f) => `/api/v1/exports/${f.exportJobId}`,
    allowed: ["owner"],
  },
  {
    id: "exports.download",
    routeFile: "src/app/api/v1/exports/[exportId]/download/route.ts",
    kind: "api",
    method: "GET",
    path: (f) => `/api/v1/exports/${f.exportJobId}/download`,
    allowed: ["owner"],
    allowStatus: 303,
  },
  {
    id: "diary.finish",
    routeFile: "src/app/api/v1/enrolments/[enrolmentId]/diary/finish/route.ts",
    kind: "api",
    method: "POST",
    path: (f) => `/api/v1/enrolments/${f.lifecycleEnrolmentId}/diary/finish`,
    body: () => ({ confirmation: "FINISH MY DIARY" }),
    allowed: ["otherFellow"],
  },
  {
    id: "diary.reopen",
    routeFile: "src/app/api/v1/enrolments/[enrolmentId]/diary/reopen/route.ts",
    kind: "api",
    method: "POST",
    path: (f) => `/api/v1/enrolments/${f.lifecycleEnrolmentId}/diary/reopen`,
    body: () => ({ confirmation: "REOPEN MY DIARY" }),
    allowed: ["otherFellow"],
  },
  {
    id: "retention-hold.place",
    routeFile: "src/app/api/v1/enrolments/[enrolmentId]/retention-hold/route.ts",
    kind: "api",
    method: "POST",
    path: (f) => `/api/v1/enrolments/${f.lifecycleEnrolmentId}/retention-hold`,
    body: () => ({ reason: "Authorization matrix retention hold probe." }),
    allowed: ["tenantAdmin"],
    allowStatus: 201,
  },
  {
    id: "retention-hold.release",
    routeFile: "src/app/api/v1/enrolments/[enrolmentId]/retention-hold/route.ts",
    kind: "api",
    method: "DELETE",
    path: (f) => `/api/v1/enrolments/${f.lifecycleEnrolmentId}/retention-hold`,
    body: () => ({ confirmation: "RELEASE HOLD" }),
    allowed: ["tenantAdmin"],
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
    allowed: ["owner", "otherFellow"],
  },
  {
    id: "page.log.new",
    routeFile: "src/app/t/[tenantSlug]/(shell)/log/new/page.tsx",
    kind: "page",
    method: "GET",
    path: (f) => `/t/${f.tenantASlug}/log/new`,
    allowed: ["owner", "otherFellow"],
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
    allowed: ["owner"],
  },
  {
    id: "page.curriculum",
    routeFile: "src/app/t/[tenantSlug]/(shell)/curriculum/page.tsx",
    kind: "page",
    method: "GET",
    path: (f) => `/t/${f.tenantASlug}/curriculum`,
    // The curriculum page is the fellow's own view of their pinned release.
    allowed: ["owner", "otherFellow"],
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
    id: "page.diary-export",
    routeFile: "src/app/t/[tenantSlug]/(shell)/diary-export/page.tsx",
    kind: "page",
    method: "GET",
    path: (f) => `/t/${f.tenantASlug}/diary-export`,
    allowed: ["owner", "otherFellow"],
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
    id: "page.about",
    routeFile: "src/app/(public)/about/page.tsx",
    kind: "page",
    method: "GET",
    path: () => "/about",
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
    id: "page.privacy",
    routeFile: "src/app/(public)/privacy/page.tsx",
    kind: "page",
    method: "GET",
    path: () => "/privacy",
    allowed: [],
    public: true,
  },
  {
    id: "page.accessibility",
    routeFile: "src/app/(public)/accessibility/page.tsx",
    kind: "page",
    method: "GET",
    path: () => "/accessibility",
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
