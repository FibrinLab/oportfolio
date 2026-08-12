import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { appUser, cohort, enrolment, programme, supervisorAssignment } from "@/server/db/schema";
import type { Actor } from "@/server/policy/actor";

// The supervisor's assigned fellows (spec/02): access flows from active dated
// assignments only. A prior supervisor's list is empty (spec/01).

export interface AssignedFellow {
  enrolmentId: string;
  fellowName: string | null;
  cohortName: string;
  programmeName: string;
  enrolmentStatus: string;
  assignmentType: string;
  startsAt: Date;
}

export async function getAssignedFellows(
  actor: Actor,
  tenantId: string,
): Promise<AssignedFellow[]> {
  const enrolmentIds = actor.assignments
    .filter((a) => a.tenantId === tenantId)
    .map((a) => a.enrolmentId);
  if (enrolmentIds.length === 0) return [];

  const db = getDb();
  const rows = await db
    .select({
      enrolmentId: enrolment.id,
      fellowName: appUser.displayName,
      cohortName: cohort.name,
      programmeName: programme.name,
      enrolmentStatus: enrolment.status,
      assignmentType: supervisorAssignment.assignmentType,
      startsAt: supervisorAssignment.startsAt,
    })
    .from(supervisorAssignment)
    .innerJoin(enrolment, eq(supervisorAssignment.enrolmentId, enrolment.id))
    .innerJoin(cohort, eq(enrolment.cohortId, cohort.id))
    .innerJoin(programme, eq(cohort.programmeId, programme.id))
    .leftJoin(appUser, eq(enrolment.fellowUserId, appUser.id))
    .where(
      and(
        eq(supervisorAssignment.tenantId, tenantId),
        eq(supervisorAssignment.supervisorUserId, actor.userId),
        isNull(supervisorAssignment.endsAt),
        sql`${supervisorAssignment.startsAt} <= now()`,
        inArray(enrolment.id, enrolmentIds),
      ),
    );
  return rows;
}
