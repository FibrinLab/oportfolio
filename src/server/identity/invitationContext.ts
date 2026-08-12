import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import {
  appUser,
  cohort,
  enrolment,
  programme,
  supervisorAssignment,
  tenant,
} from "@/server/db/schema";
import { findPendingInvitation, type PendingInvitation } from "./invitations";

// Everything the onboarding page shows before acceptance (spec/04 §1):
// tenant/programme, dates, supervisor names, privacy notice URL. The pinned
// framework version renders once framework tables exist (framework phase).

export interface InvitationContext {
  invitation: PendingInvitation;
  tenantName: string;
  privacyNoticeUrl: string | null;
  programmeName: string | null;
  cohortName: string | null;
  startsOn: string | null;
  endsOn: string | null;
  supervisorNames: string[];
  frameworkReleaseId: string | null;
}

export async function getInvitationContext(
  db: Db,
  token: string,
): Promise<InvitationContext | null> {
  const invitation = await findPendingInvitation(db, token);
  if (!invitation) return null;

  const tenants = await db
    .select({ name: tenant.name, privacyNoticeUrl: tenant.privacyNoticeUrl })
    .from(tenant)
    .where(eq(tenant.id, invitation.tenantId))
    .limit(1);
  const tenantRow = tenants[0];
  if (!tenantRow) return null;

  let programmeName: string | null = null;
  let cohortName: string | null = null;
  let startsOn: string | null = null;
  let endsOn: string | null = null;
  let frameworkReleaseId: string | null = null;
  let supervisorNames: string[] = [];

  if (invitation.enrolmentId) {
    const rows = await db
      .select({
        startsOn: enrolment.startsOn,
        endsOn: enrolment.endsOn,
        frameworkReleaseId: enrolment.frameworkReleaseId,
        cohortName: cohort.name,
        programmeName: programme.name,
      })
      .from(enrolment)
      .innerJoin(cohort, eq(enrolment.cohortId, cohort.id))
      .innerJoin(programme, eq(cohort.programmeId, programme.id))
      .where(eq(enrolment.id, invitation.enrolmentId))
      .limit(1);
    const row = rows[0];
    if (row) {
      programmeName = row.programmeName;
      cohortName = row.cohortName;
      startsOn = row.startsOn;
      endsOn = row.endsOn;
      frameworkReleaseId = row.frameworkReleaseId;
    }

    const supervisors = await db
      .select({ displayName: appUser.displayName })
      .from(supervisorAssignment)
      .innerJoin(appUser, eq(supervisorAssignment.supervisorUserId, appUser.id))
      .where(
        and(
          eq(supervisorAssignment.enrolmentId, invitation.enrolmentId),
          isNull(supervisorAssignment.endsAt),
        ),
      );
    supervisorNames = supervisors.map((s) => s.displayName);
  }

  return {
    invitation,
    tenantName: tenantRow.name,
    privacyNoticeUrl: tenantRow.privacyNoticeUrl,
    programmeName,
    cohortName,
    startsOn,
    endsOn,
    supervisorNames,
    frameworkReleaseId,
  };
}
