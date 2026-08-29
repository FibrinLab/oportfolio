import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import {
  appUser,
  cohort,
  enrolment,
  invitation,
  programme,
} from "@/server/db/schema";
import type { Actor } from "@/server/policy/actor";
import { canInvite } from "@/server/policy/policy";

// Staff People view: enrolments and invitation states only. Diary content is
// never joined or materialised here.

export interface PeopleView {
  cohorts: Array<{ id: string; name: string; programmeName: string }>;
  enrolments: Array<{
    id: string;
    cohortName: string;
    fellowName: string | null;
    fellowEmail: string | null;
    status: string;
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
    enrolments: enrolments.map((e) => ({
      id: e.id,
      cohortName: e.cohortName,
      fellowName: e.fellowName,
      fellowEmail: e.fellowEmail,
      status: e.status,
    })),
    pendingInvitations,
  };
}
