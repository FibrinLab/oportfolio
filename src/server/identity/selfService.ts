import { and, eq, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import type { Db } from "@/server/db/client";
import {
  appUser,
  cohort,
  enrolment,
  membership,
  profile,
  programme,
  tenant,
} from "@/server/db/schema";
import { appendAudit } from "@/server/audit/audit";
import { getEnv } from "@/server/config/env";
import { OPERATOR_NAME, PRIVACY_NOTICE_PATH } from "@/lib/notices";

export interface SelfServiceAccount {
  userId: string;
  permissionsVersion: number;
  created: boolean;
}

export function displayNameFromEmail(email: string): string {
  const localPart = email.split("@", 1)[0]?.split("+", 1)[0] ?? "";
  const words = localPart
    .replace(/[._-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return (words.join(" ") || "Diary user").slice(0, 160);
}

/**
 * Return an active account for a verified address. A first-time user receives
 * a private, single-member diary workspace. The advisory lock prevents two
 * valid links for the same new address from creating duplicate workspaces.
 */
export async function ensureSelfServiceAccount(
  tx: Db,
  email: string,
  requestId: string | null,
): Promise<SelfServiceAccount | null> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`signup:${email}`}))`);

  const existing = await tx
    .select({
      id: appUser.id,
      status: appUser.status,
      permissionsVersion: appUser.permissionsVersion,
    })
    .from(appUser)
    .where(eq(appUser.emailNormalised, email))
    .limit(1);
  const current = existing[0];
  if (current?.status === "suspended") return null;

  if (current) {
    const activeMembership = await tx
      .select({ id: membership.id })
      .from(membership)
      .where(
        and(
          eq(membership.userId, current.id),
          eq(membership.status, "active"),
        ),
      )
      .limit(1);
    if (activeMembership[0]) {
      return {
        userId: current.id,
        permissionsVersion: current.permissionsVersion,
        created: false,
      };
    }
  }

  const userId = current?.id ?? uuidv7();
  const displayName = displayNameFromEmail(email);
  if (!current) {
    await tx.insert(appUser).values({
      id: userId,
      identitySubject: `magic-link:${userId}`,
      emailNormalised: email,
      displayName,
      createdBy: userId,
      updatedBy: userId,
    });
  }

  const tenantId = uuidv7();
  const programmeId = uuidv7();
  const cohortId = uuidv7();
  const enrolmentId = uuidv7();
  const membershipId = uuidv7();
  const today = new Date().toISOString().slice(0, 10);

  await tx.insert(tenant).values({
    id: tenantId,
    name: "My diary",
    slug: `diary-${userId}`,
    // The operator is the controller for self-service diaries (docs/dpia.md).
    controllerName: `${OPERATOR_NAME} (service operator)`,
    privacyNoticeUrl: `${getEnv().APP_BASE_URL}${PRIVACY_NOTICE_PATH}`,
    createdBy: userId,
    updatedBy: userId,
  });
  await tx.insert(programme).values({
    id: programmeId,
    tenantId,
    code: "PERSONAL",
    name: "Personal diary",
    description: "A private, self-service learning log.",
    createdBy: userId,
    updatedBy: userId,
  });
  await tx.insert(cohort).values({
    id: cohortId,
    tenantId,
    programmeId,
    code: "SELF-SERVICE",
    name: "Personal log",
    startsOn: today,
    status: "active",
    createdBy: userId,
    updatedBy: userId,
  });
  await tx.insert(enrolment).values({
    id: enrolmentId,
    tenantId,
    cohortId,
    fellowUserId: userId,
    startsOn: today,
    status: "active",
    diaryState: "open",
    createdBy: userId,
    updatedBy: userId,
  });
  await tx.insert(membership).values({
    id: membershipId,
    tenantId,
    userId,
    role: "fellow",
    grantReason: "self_signup",
    createdBy: userId,
    updatedBy: userId,
  });
  await tx.insert(profile).values({
    id: uuidv7(),
    tenantId,
    userId,
    preferredName: displayName,
    createdBy: userId,
    updatedBy: userId,
  });

  await appendAudit(tx, {
    tenantId,
    actorUserId: userId,
    action: "auth.sign_up",
    targetType: "app_user",
    targetId: userId,
    requestId,
  });
  await appendAudit(tx, {
    tenantId,
    actorUserId: userId,
    action: "membership.granted",
    targetType: "membership",
    targetId: membershipId,
    requestId,
    metadata: { role: "fellow", reason: "self_signup" },
  });
  await appendAudit(tx, {
    tenantId,
    actorUserId: userId,
    action: "enrolment.activated",
    targetType: "enrolment",
    targetId: enrolmentId,
    enrolmentId,
    requestId,
  });

  return {
    userId,
    permissionsVersion: current?.permissionsVersion ?? 1,
    created: !current,
  };
}
