import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import {
  appUser,
  cohort,
  enrolment,
  invitation,
  membership,
  programme,
  supervisorAssignment,
} from "@/server/db/schema";
import type { Actor } from "@/server/policy/actor";
import { canInvite } from "@/server/policy/policy";

// Faculty People view (S-18 subset): enrolments, invitation states and
// supervisor options for the invite form. Metadata only — no portfolio content.

export interface PeopleView {
  cohorts: Array<{ id: string; name: string; programmeName: string }>;
  supervisors: Array<{ userId: string; displayName: string }>;
  enrolments: Array<{
    id: string;
    cohortName: string;
    fellowName: string | null;
    fellowEmail: string | null;
    status: string;
    supervisorNames: string[];
  }>;
  pendingInvitations: Array<{
    id: string;
    email: string;
    displayName: string;
    role: string;
    expiresAt: Date;
  }>;
}

export async function getPeopleView(actor: Actor, tenantId: string): Promise<PeopleView | null> {
  if (!canInvite(actor, tenantId).allow) return null;
  const db = getDb();

  const cohorts = await db
    .select({ id: cohort.id, name: cohort.name, programmeName: programme.name })
    .from(cohort)
    .innerJoin(programme, eq(cohort.programmeId, programme.id))
    .where(eq(cohort.tenantId, tenantId));

  const supervisors = await db
    .selectDistinct({ userId: appUser.id, displayName: appUser.displayName })
    .from(appUser)
    .innerJoin(membership, eq(membership.userId, appUser.id))
    .where(
      and(
        eq(membership.tenantId, tenantId),
        eq(membership.role, "supervisor"),
        eq(membership.status, "active"),
      ),
    );

  const enrolments = await db
    .select({
      id: enrolment.id,
      status: enrolment.status,
      cohortName: cohort.name,
      fellowName: appUser.displayName,
      fellowEmail: appUser.emailNormalised,
    })
    .from(enrolment)
    .innerJoin(cohort, eq(enrolment.cohortId, cohort.id))
    .leftJoin(appUser, eq(enrolment.fellowUserId, appUser.id))
    .where(eq(enrolment.tenantId, tenantId))
    .orderBy(desc(enrolment.createdAt));

  const assignments = await db
    .select({
      enrolmentId: supervisorAssignment.enrolmentId,
      supervisorName: appUser.displayName,
    })
    .from(supervisorAssignment)
    .innerJoin(appUser, eq(supervisorAssignment.supervisorUserId, appUser.id))
    .where(and(eq(supervisorAssignment.tenantId, tenantId), isNull(supervisorAssignment.endsAt)));

  const pendingInvitations = await db
    .select({
      id: invitation.id,
      email: invitation.emailNormalised,
      displayName: invitation.invitedDisplayName,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    })
    .from(invitation)
    .where(
      and(
        eq(invitation.tenantId, tenantId),
        isNull(invitation.acceptedAt),
        isNull(invitation.revokedAt),
        sql`${invitation.expiresAt} > now()`,
      ),
    );

  return {
    cohorts,
    supervisors: supervisors.map((s) => ({ userId: s.userId, displayName: s.displayName })),
    enrolments: enrolments.map((e) => ({
      id: e.id,
      cohortName: e.cohortName,
      fellowName: e.fellowName,
      fellowEmail: e.fellowEmail,
      status: e.status,
      supervisorNames: assignments
        .filter((a) => a.enrolmentId === e.id)
        .map((a) => a.supervisorName),
    })),
    pendingInvitations,
  };
}
