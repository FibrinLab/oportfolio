import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import {
  appUser,
  cohort,
  enrolment,
  profile,
  programme,
  supervisorAssignment,
} from "@/server/db/schema";
import type { Actor } from "@/server/policy/actor";

// The signed-in fellow's own programme context (S-03 Today). Reads only the
// caller's rows — never another fellow's.

export interface FellowContext {
  enrolmentId: string;
  programmeId: string;
  cohortId: string;
  programmeName: string;
  cohortName: string;
  startsOn: string | null;
  endsOn: string | null;
  enrolmentStatus: string;
  frameworkReleaseId: string | null;
  frameworkTitle: string | null;
  frameworkVersion: string | null;
  supervisorNames: string[];
  preferredName: string | null;
}

export async function getFellowContext(
  actor: Actor,
  tenantId: string,
): Promise<FellowContext | null> {
  const isFellow = actor.memberships.some(
    (m) => m.tenantId === tenantId && m.role === "fellow",
  );
  if (!isFellow) return null;

  const db = getDb();
  const rows = await db
    .select({
      enrolmentId: enrolment.id,
      programmeId: programme.id,
      cohortId: cohort.id,
      programmeName: programme.name,
      cohortName: cohort.name,
      startsOn: enrolment.startsOn,
      endsOn: enrolment.endsOn,
      enrolmentStatus: enrolment.status,
      frameworkReleaseId: enrolment.frameworkReleaseId,
    })
    .from(enrolment)
    .innerJoin(cohort, eq(enrolment.cohortId, cohort.id))
    .innerJoin(programme, eq(cohort.programmeId, programme.id))
    .where(
      and(
        eq(enrolment.tenantId, tenantId),
        eq(enrolment.fellowUserId, actor.userId),
        inArray(enrolment.status, ["active", "paused"]),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const supervisors = await db
    .select({ displayName: appUser.displayName })
    .from(supervisorAssignment)
    .innerJoin(appUser, eq(supervisorAssignment.supervisorUserId, appUser.id))
    .where(
      and(
        eq(supervisorAssignment.enrolmentId, row.enrolmentId),
        sql`${supervisorAssignment.startsAt} <= now()`,
        isNull(supervisorAssignment.endsAt),
      ),
    );

  const profiles = await db
    .select({ preferredName: profile.preferredName })
    .from(profile)
    .where(and(eq(profile.tenantId, tenantId), eq(profile.userId, actor.userId)))
    .limit(1);

  // Framework release title/version joined once the framework tables exist
  // (framework phase populates them).
  let frameworkTitle: string | null = null;
  let frameworkVersion: string | null = null;
  if (row.frameworkReleaseId) {
    const release = await db.execute(sql`
      SELECT fr.version AS version, f.title AS title
      FROM framework_release fr
      JOIN framework f ON f.id = fr.framework_id
      WHERE fr.id = ${row.frameworkReleaseId}
      LIMIT 1
    `).catch(() => ({ rows: [] as Array<Record<string, unknown>> }));
    frameworkTitle = (release.rows[0]?.title as string | undefined) ?? null;
    frameworkVersion = (release.rows[0]?.version as string | undefined) ?? null;
  }

  return {
    ...row,
    frameworkTitle,
    frameworkVersion,
    supervisorNames: supervisors.map((s) => s.displayName),
    preferredName: profiles[0]?.preferredName ?? null,
  };
}
