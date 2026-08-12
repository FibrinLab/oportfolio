import { readFileSync } from "node:fs";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getDb } from "@/server/db/client";
import {
  appUser,
  cohort,
  duty,
  enrolment,
  membership,
  policySet,
  profile,
  programme,
  supervisorAssignment,
  tenant,
} from "@/server/db/schema";
import { createInvitation } from "@/server/identity/invitations";

// Synthetic fixtures only — no real people or patients (NFR-S-007).
// Idempotent: re-running updates nothing that already exists.
//
// Creates: demo tenant + policy set, FCAI programme + cohort (pinned to the
// fcai release when one has been imported and published), synthetic faculty
// and supervisor accounts, and a fellow invitation with a provisional
// enrolment. Prints the invitation URL.

const TENANT_SLUG = "demo";

async function main() {
  const db = getDb();

  const result = await db.transaction(async (tx) => {
    // Tenant
    let tenantId: string;
    const existingTenant = await tx
      .select({ id: tenant.id })
      .from(tenant)
      .where(eq(tenant.slug, TENANT_SLUG))
      .limit(1);
    if (existingTenant[0]) {
      tenantId = existingTenant[0].id;
    } else {
      tenantId = uuidv7();
      await tx.insert(tenant).values({
        id: tenantId,
        name: "Demo Teaching Trust",
        slug: TENANT_SLUG,
        controllerName: "Demo Teaching Trust (synthetic)",
        privacyNoticeUrl: "https://example.org/privacy",
      });
      const policySetId = uuidv7();
      await tx.insert(policySet).values({
        id: policySetId,
        tenantId,
        settingsJson: {
          upload: {
            maxFileBytes: 25 * 1024 * 1024,
            maxFilesPerItem: 10,
            allowedExtensions: ["pdf", "png", "jpg", "jpeg", "txt", "md", "csv", "docx", "pptx"],
          },
          visibilityOptions: ["private", "supervisors", "faculty"],
          reportingThreshold: 7,
          breakGlassEnabled: false,
        },
      });
      await tx.update(tenant).set({ activePolicySetId: policySetId }).where(eq(tenant.id, tenantId));
    }

    // Programme + cohort
    let programmeId: string;
    const existingProgramme = await tx
      .select({ id: programme.id })
      .from(programme)
      .where(sql`${programme.tenantId} = ${tenantId} AND ${programme.code} = 'FCAI'`)
      .limit(1);
    if (existingProgramme[0]) {
      programmeId = existingProgramme[0].id;
    } else {
      programmeId = uuidv7();
      await tx.insert(programme).values({
        id: programmeId,
        tenantId,
        code: "FCAI",
        name: "Fellowship in Clinical AI",
        description: "Twelve-month clinical AI fellowship alongside a clinical role.",
        defaultDurationMonths: 12,
      });
    }

    // Fellowship duties: programme-scoped copies of the package taxonomy
    // (spec/05: duty is versioned programme data).
    try {
      const packageJson = JSON.parse(
        readFileSync(path.join(process.cwd(), "spec/frameworks/fcai/v3.2/framework.json"), "utf8"),
      ) as { duties: Array<{ stableId: string; code: string; title: string; description: string; sortOrder: number }> };
      for (const item of packageJson.duties) {
        await tx
          .insert(duty)
          .values({
            id: uuidv7(),
            tenantId,
            programmeId,
            stableCode: item.stableId,
            label: item.title,
            description: item.description,
            sortOrder: item.sortOrder,
          })
          .onConflictDoNothing();
      }
    } catch (error) {
      console.warn("Could not seed duties from package:", (error as Error).message);
    }

    // Pin the cohort to the published FCAI release when it exists.
    let frameworkReleaseId: string | null = null;
    try {
      const release = await tx.execute(sql`
        SELECT fr.id FROM framework_release fr
        JOIN framework f ON f.id = fr.framework_id
        WHERE f.namespace = 'fcai' AND fr.status = 'published'
        ORDER BY fr.version DESC LIMIT 1
      `);
      frameworkReleaseId = (release.rows[0]?.id as string | undefined) ?? null;
    } catch {
      frameworkReleaseId = null; // framework tables not migrated yet
    }

    let cohortId: string;
    const existingCohort = await tx
      .select({ id: cohort.id, frameworkReleaseId: cohort.frameworkReleaseId })
      .from(cohort)
      .where(sql`${cohort.programmeId} = ${programmeId} AND ${cohort.code} = 'C5'`)
      .limit(1);
    if (existingCohort[0]) {
      cohortId = existingCohort[0].id;
      if (!existingCohort[0].frameworkReleaseId && frameworkReleaseId) {
        await tx
          .update(cohort)
          .set({ frameworkReleaseId, status: "active" })
          .where(eq(cohort.id, cohortId));
      }
    } else {
      cohortId = uuidv7();
      await tx.insert(cohort).values({
        id: cohortId,
        tenantId,
        programmeId,
        code: "C5",
        name: "Cohort 5",
        startsOn: "2026-09-01",
        endsOn: "2027-08-31",
        frameworkReleaseId,
        status: frameworkReleaseId ? "active" : "planned",
      });
    }

    // Synthetic faculty + supervisor accounts (they sign in via magic link).
    async function ensureUser(email: string, displayName: string): Promise<string> {
      const existing = await tx
        .select({ id: appUser.id })
        .from(appUser)
        .where(eq(appUser.emailNormalised, email))
        .limit(1);
      if (existing[0]) return existing[0].id;
      const id = uuidv7();
      await tx.insert(appUser).values({
        id,
        identitySubject: `seed:${email}`,
        emailNormalised: email,
        displayName,
      });
      return id;
    }

    async function ensureMembership(
      userId: string,
      role: "fellow" | "supervisor" | "faculty" | "tenant_admin",
    ) {
      await tx
        .insert(membership)
        .values({ id: uuidv7(), tenantId, userId, role, grantReason: "seed" })
        .onConflictDoNothing();
    }

    const facultyId = await ensureUser("frankie.faculty@example.org", "Frankie Faculty");
    await ensureMembership(facultyId, "faculty");
    const supervisorId = await ensureUser("sam.supervisor@example.org", "Sam Supervisor");
    await ensureMembership(supervisorId, "supervisor");
    await tx
      .insert(profile)
      .values({ id: uuidv7(), tenantId, userId: supervisorId, preferredName: "Sam" })
      .onConflictDoNothing();

    // Fellow invitation + provisional enrolment + primary assignment.
    const fellowEmail = "fiona.fellow@example.org";
    const existingEnrolment = await tx
      .select({ id: enrolment.id })
      .from(enrolment)
      .where(sql`${enrolment.cohortId} = ${cohortId}`)
      .limit(1);

    let inviteUrl: string | null = null;
    if (!existingEnrolment[0]) {
      const enrolmentId = uuidv7();
      await tx.insert(enrolment).values({
        id: enrolmentId,
        tenantId,
        cohortId,
        fellowUserId: null,
        frameworkReleaseId,
        startsOn: "2026-09-01",
        endsOn: "2027-08-31",
        status: "provisional",
        createdBy: facultyId,
      });
      await tx.insert(supervisorAssignment).values({
        id: uuidv7(),
        tenantId,
        enrolmentId,
        supervisorUserId: supervisorId,
        assignmentType: "primary",
        canSign: true,
        appointedBy: facultyId,
        reason: "seed",
      });
      const { token } = await createInvitation(tx, {
        tenantId,
        email: fellowEmail,
        displayName: "Fiona Fellow",
        role: "fellow",
        enrolmentId,
        createdBy: facultyId,
      });
      const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
      inviteUrl = `${baseUrl}/invite/${token}`;
    }

    return { tenantId, frameworkReleaseId, inviteUrl };
  });

  console.log(`Seeded tenant '${TENANT_SLUG}' (${result.tenantId}).`);
  console.log(
    result.frameworkReleaseId
      ? `Cohort pinned to framework release ${result.frameworkReleaseId}.`
      : "No published fcai framework release found — run `pnpm framework:import spec/frameworks/fcai/v3.2/framework.json --publish` and re-run seed to pin the cohort.",
  );
  if (result.inviteUrl) {
    console.log(`Fellow invitation (also emailed via outbox): ${result.inviteUrl}`);
  } else {
    console.log("Fellow enrolment already exists — no new invitation created.");
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
