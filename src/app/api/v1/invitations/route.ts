import { NextResponse } from "next/server";
import { uuidv7 } from "uuidv7";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { cohort, enrolment, supervisorAssignment } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import { createInvitation } from "@/server/identity/invitations";
import { canInvite } from "@/server/policy/policy";
import { appendAudit } from "@/server/audit/audit";
import { problem, notFoundProblem } from "@/server/http/problem";
import { withApi } from "@/server/http/withApi";
import { withIdempotency } from "@/server/http/idempotency";

const bodySchema = z.object({
  tenantId: z.string().uuid(),
  email: z.string().email().max(320),
  displayName: z.string().min(1).max(160),
  role: z.enum(["fellow", "supervisor", "faculty"]),
  // Fellow invitations create a provisional enrolment (FR-ID-003).
  cohortId: z.string().uuid().optional(),
  primarySupervisorUserId: z.string().uuid().optional(),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const POST = withApi({ bodySchema }, async ({ actor, body, request, requestId }) => {
  const decision = canInvite(actor, body.tenantId);
  if (!decision.allow) return notFoundProblem(requestId);

  if (body.role === "fellow" && !body.cohortId) {
    return problem("validation-failed", requestId, {
      detail: "A fellow invitation requires a cohort.",
    });
  }

  return withIdempotency(request, body.tenantId, requestId, async () => {
    const db = getDb();
    const result = await db.transaction(async (tx) => {
      let enrolmentId: string | null = null;

      if (body.role === "fellow" && body.cohortId) {
        const cohorts = await tx
          .select({
            id: cohort.id,
            frameworkReleaseId: cohort.frameworkReleaseId,
            startsOn: cohort.startsOn,
            endsOn: cohort.endsOn,
          })
          .from(cohort)
          .where(and(eq(cohort.tenantId, body.tenantId), eq(cohort.id, body.cohortId)))
          .limit(1);
        const cohortRow = cohorts[0];
        if (!cohortRow) return null;

        enrolmentId = uuidv7();
        await tx.insert(enrolment).values({
          id: enrolmentId,
          tenantId: body.tenantId,
          cohortId: cohortRow.id,
          fellowUserId: null,
          // Pinned at creation from the cohort (FR-FW-003).
          frameworkReleaseId: cohortRow.frameworkReleaseId,
          startsOn: body.startsOn ?? cohortRow.startsOn,
          endsOn: body.endsOn ?? cohortRow.endsOn,
          status: "provisional",
          createdBy: actor.userId,
        });

        if (body.primarySupervisorUserId) {
          await tx.insert(supervisorAssignment).values({
            id: uuidv7(),
            tenantId: body.tenantId,
            enrolmentId,
            supervisorUserId: body.primarySupervisorUserId,
            assignmentType: "primary",
            canSign: true,
            appointedBy: actor.userId,
            reason: "invitation",
          });
          await appendAudit(tx, {
            tenantId: body.tenantId,
            actorUserId: actor.userId,
            action: "assignment.created",
            targetType: "supervisor_assignment",
            targetId: enrolmentId,
            enrolmentId,
            requestId,
            metadata: { assignmentType: "primary" },
          });
        }
      }

      const { invitationId } = await createInvitation(tx, {
        tenantId: body.tenantId,
        email: body.email,
        displayName: body.displayName,
        role: body.role,
        enrolmentId,
        createdBy: actor.userId,
        requestId,
      });
      return { invitationId, enrolmentId };
    });

    if (!result) return notFoundProblem(requestId);
    return NextResponse.json(result, { status: 201 });
  });
});
