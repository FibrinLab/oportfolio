import { eq, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getDb } from "@/server/db/client";
import {
  appUser,
  attachment,
  cohort,
  enrolment,
  evidenceItem,
  evidenceType,
  membership,
  programme,
  supervisorAssignment,
  tenant,
} from "@/server/db/schema";
import { createSession } from "@/server/identity/sessions";

// Builds the two-tenant persona/object fixture set behind the authorization
// matrix (spec/15:156-173). Fresh slugs per run keep it self-contained.

export type PersonaId =
  | "unauth"
  | "wrongTenantFellow"
  | "noRoleUser"
  | "owner"
  | "otherFellow"
  | "assignedSupervisor"
  | "priorSupervisor"
  | "facultyTenant"
  | "facultyWrongProgramme"
  | "suspended"
  | "tenantAdmin";

export interface Fixtures {
  tenantASlug: string;
  tenantBSlug: string;
  tenantAId: string;
  enrolmentId: string;
  cohortId: string;
  // Evidence in each state the matrix needs.
  privateDraftId: string;
  sharedSupervisorsId: string;
  facultySharedId: string;
  archivedSharedId: string;
  softDeletedId: string;
  cleanAttachmentOnSharedId: string;
  cleanAttachmentOnPrivateId: string;
  evidenceTypeId: string;
  // Session cookie value per persona ("" for unauth).
  cookies: Record<PersonaId, string>;
}

export async function buildFixtures(): Promise<Fixtures> {
  const db = getDb();
  const suffix = uuidv7().slice(-8);
  const tenantASlug = `authz-a-${suffix}`;
  const tenantBSlug = `authz-b-${suffix}`;

  const tenantAId = uuidv7();
  const tenantBId = uuidv7();
  await db.insert(tenant).values([
    { id: tenantAId, name: "AuthZ Tenant A", slug: tenantASlug },
    { id: tenantBId, name: "AuthZ Tenant B", slug: tenantBSlug },
  ]);

  const programmeAId = uuidv7();
  const programmeOtherId = uuidv7();
  await db.insert(programme).values([
    { id: programmeAId, tenantId: tenantAId, code: `PA-${suffix}`, name: "Programme A" },
    { id: programmeOtherId, tenantId: tenantAId, code: `PX-${suffix}`, name: "Programme X" },
  ]);
  // Pin the published FCAI release (from `pnpm seed`) so editor/curriculum
  // pages resolve for the owner fellow.
  const releaseRows = await db.execute(
    sql`SELECT fr.id FROM framework_release fr JOIN framework f ON f.id = fr.framework_id
        WHERE f.namespace = 'fcai' AND fr.status = 'published' LIMIT 1`,
  );
  const frameworkReleaseId = (releaseRows.rows[0]?.id as string | undefined) ?? null;
  if (!frameworkReleaseId) {
    throw new Error("Publish the FCAI framework first (pnpm framework:import ... --publish).");
  }

  const cohortId = uuidv7();
  await db.insert(cohort).values({
    id: cohortId,
    tenantId: tenantAId,
    programmeId: programmeAId,
    code: `C-${suffix}`,
    name: "Cohort A",
    frameworkReleaseId,
  });

  async function makeUser(
    name: string,
    role: "fellow" | "supervisor" | "faculty" | "tenant_admin" | null,
    tenantId: string,
    scope?: { scopeType: "programme"; scopeId: string },
  ): Promise<{ userId: string; cookie: string }> {
    const userId = uuidv7();
    await db.insert(appUser).values({
      id: userId,
      identitySubject: `authz:${name}-${suffix}`,
      emailNormalised: `${name}-${suffix}@authz.example.org`,
      displayName: `AuthZ ${name}`,
    });
    if (role) {
      await db.insert(membership).values({
        id: uuidv7(),
        tenantId,
        userId,
        role,
        scopeType: scope?.scopeType ?? "tenant",
        scopeId: scope?.scopeId ?? null,
        grantReason: "authz-fixture",
      });
    }
    const { token } = await createSession(db, userId, 1);
    return { userId, cookie: token };
  }

  const owner = await makeUser("owner", "fellow", tenantAId);
  const otherFellow = await makeUser("other-fellow", "fellow", tenantAId);
  const assignedSupervisor = await makeUser("assigned-sup", "supervisor", tenantAId);
  const priorSupervisor = await makeUser("prior-sup", "supervisor", tenantAId);
  const facultyTenant = await makeUser("faculty", "faculty", tenantAId);
  const facultyWrongProgramme = await makeUser("faculty-wrong", "faculty", tenantAId, {
    scopeType: "programme",
    scopeId: programmeOtherId,
  });
  const tenantAdmin = await makeUser("admin", "tenant_admin", tenantAId);
  const noRoleUser = await makeUser("no-role", null, tenantAId);
  const wrongTenantFellow = await makeUser("b-fellow", "fellow", tenantBId);
  const suspended = await makeUser("suspended", "fellow", tenantAId);
  await db.update(appUser).set({ status: "suspended" }).where(eq(appUser.id, suspended.userId));

  const enrolmentId = uuidv7();
  await db.insert(enrolment).values({
    id: enrolmentId,
    tenantId: tenantAId,
    cohortId,
    fellowUserId: owner.userId,
    frameworkReleaseId,
    status: "active",
  });

  await db.insert(supervisorAssignment).values([
    {
      id: uuidv7(),
      tenantId: tenantAId,
      enrolmentId,
      supervisorUserId: assignedSupervisor.userId,
      assignmentType: "primary",
      canSign: true,
    },
    {
      // Ended assignment: the prior supervisor must have no live access.
      id: uuidv7(),
      tenantId: tenantAId,
      enrolmentId,
      supervisorUserId: priorSupervisor.userId,
      assignmentType: "co_supervisor",
      canSign: false,
      startsAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
  ]);

  const typeRows = await db
    .select({ id: evidenceType.id })
    .from(evidenceType)
    .where(eq(evidenceType.stableCode, "learning_record"))
    .limit(1);
  const typeId = typeRows[0]?.id;
  if (!typeId) throw new Error("Seed the canonical evidence types first (pnpm seed).");

  async function makeEvidence(input: {
    title: string;
    visibility: "private" | "supervisors" | "faculty";
    workflowState: "draft" | "shared";
    archived?: boolean;
    deleted?: boolean;
  }): Promise<string> {
    const id = uuidv7();
    await db.insert(evidenceItem).values({
      id,
      tenantId: tenantAId,
      enrolmentId,
      authorUserId: owner.userId,
      title: input.title,
      evidenceTypeId: typeId!,
      narrativeDoc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "fixture" }] }] },
      narrativeText: "fixture",
      visibility: input.visibility,
      workflowState: input.workflowState,
      archivedAt: input.archived ? new Date() : null,
      deletedAt: input.deleted ? new Date() : null,
      createdBy: owner.userId,
      updatedBy: owner.userId,
    });
    return id;
  }

  const privateDraftId = await makeEvidence({
    title: "AUTHZ-PRIVATE-CANARY",
    visibility: "private",
    workflowState: "draft",
  });
  const sharedSupervisorsId = await makeEvidence({
    title: "AUTHZ-SHARED-SUP",
    visibility: "supervisors",
    workflowState: "shared",
  });
  const facultySharedId = await makeEvidence({
    title: "AUTHZ-SHARED-FACULTY",
    visibility: "faculty",
    workflowState: "shared",
  });
  const archivedSharedId = await makeEvidence({
    title: "AUTHZ-ARCHIVED",
    visibility: "supervisors",
    workflowState: "shared",
    archived: true,
  });
  const softDeletedId = await makeEvidence({
    title: "AUTHZ-DELETED",
    visibility: "supervisors",
    workflowState: "shared",
    deleted: true,
  });

  async function makeCleanAttachment(parentId: string): Promise<string> {
    const id = uuidv7();
    await db.insert(attachment).values({
      id,
      tenantId: tenantAId,
      parentType: "evidence_item",
      parentId,
      objectKey: `${tenantAId}/attachment/${id}`,
      originalFilename: "fixture.pdf",
      displayName: "fixture.pdf",
      mediaTypeClaimed: "application/pdf",
      mediaTypeDetected: "application/pdf",
      sizeBytes: 100,
      scanStatus: "clean",
      createdBy: owner.userId,
      updatedBy: owner.userId,
    });
    return id;
  }
  const cleanAttachmentOnSharedId = await makeCleanAttachment(sharedSupervisorsId);
  const cleanAttachmentOnPrivateId = await makeCleanAttachment(privateDraftId);

  return {
    tenantASlug,
    tenantBSlug,
    tenantAId,
    enrolmentId,
    cohortId,
    privateDraftId,
    sharedSupervisorsId,
    facultySharedId,
    archivedSharedId,
    softDeletedId,
    cleanAttachmentOnSharedId,
    cleanAttachmentOnPrivateId,
    evidenceTypeId: typeId,
    cookies: {
      unauth: "",
      wrongTenantFellow: wrongTenantFellow.cookie,
      noRoleUser: noRoleUser.cookie,
      owner: owner.cookie,
      otherFellow: otherFellow.cookie,
      assignedSupervisor: assignedSupervisor.cookie,
      priorSupervisor: priorSupervisor.cookie,
      facultyTenant: facultyTenant.cookie,
      facultyWrongProgramme: facultyWrongProgramme.cookie,
      suspended: suspended.cookie,
      tenantAdmin: tenantAdmin.cookie,
    },
  };
}
