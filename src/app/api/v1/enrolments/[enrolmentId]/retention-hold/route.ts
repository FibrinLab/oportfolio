import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getDb, type Db } from "@/server/db/client";
import { enrolment, retentionHold } from "@/server/db/schema";
import { appendAudit } from "@/server/audit/audit";
import { notFoundProblem, problem } from "@/server/http/problem";
import {
  placeRetentionHoldRequest,
  releaseRetentionHoldRequest,
} from "@/server/http/apiSchemas";
import { resolveTenantForApi } from "@/server/http/tenant";
import { withApi } from "@/server/http/withApi";
import { enqueue } from "@/server/outbox/outbox";

function isTenantAdmin(
  actor: { memberships: Array<{ tenantId: string; role: string }> },
  tenantId: string,
) {
  return actor.memberships.some(
    (membership) => membership.tenantId === tenantId && membership.role === "tenant_admin",
  );
}

export const POST = withApi(
  { bodySchema: placeRetentionHoldRequest },
  async ({ actor, body, params, request, requestId }) => {
    const tenantId = await resolveTenantForApi(actor, request);
    if (!tenantId || !isTenantAdmin(actor, tenantId)) return notFoundProblem(requestId);
    const rows = await getDb()
      .select({ id: enrolment.id })
      .from(enrolment)
      .where(and(eq(enrolment.id, params.enrolmentId!), eq(enrolment.tenantId, tenantId)))
      .limit(1);
    if (!rows[0]) return notFoundProblem(requestId);

    try {
      const id = uuidv7();
      await getDb().transaction(async (tx) => {
        await tx.insert(retentionHold).values({
          id,
          tenantId,
          enrolmentId: rows[0]!.id,
          reason: body.reason,
          placedBy: actor.userId,
        });
        await appendAudit(tx as Db, {
          tenantId,
          actorUserId: actor.userId,
          action: "retention_hold.placed",
          targetType: "retention_hold",
          targetId: id,
          enrolmentId: rows[0]!.id,
          requestId,
        });
      });
      return NextResponse.json({ id }, { status: 201 });
    } catch {
      return problem("invalid-state", requestId, { detail: "An active hold already exists." });
    }
  },
);

export const DELETE = withApi(
  { bodySchema: releaseRetentionHoldRequest },
  async ({ actor, params, request, requestId }) => {
    const tenantId = await resolveTenantForApi(actor, request);
    if (!tenantId || !isTenantAdmin(actor, tenantId)) return notFoundProblem(requestId);
    const now = new Date();
    const released = await getDb().transaction(async (tx) => {
      const rows = await tx
        .update(retentionHold)
        .set({ releasedAt: now, releasedBy: actor.userId })
        .where(
          and(
            eq(retentionHold.tenantId, tenantId),
            eq(retentionHold.enrolmentId, params.enrolmentId!),
            isNull(retentionHold.releasedAt),
          ),
        )
        .returning({ id: retentionHold.id });
      if (!rows[0]) return false;
      const lifecycle = await tx
        .select({
          state: enrolment.diaryState,
          finishCycle: enrolment.diaryFinishCycle,
          accessEndsAt: enrolment.diaryAccessEndsAt,
        })
        .from(enrolment)
        .where(and(eq(enrolment.id, params.enrolmentId!), eq(enrolment.tenantId, tenantId)))
        .limit(1);
      const current = lifecycle[0];
      if (
        current?.state === "finished" &&
        current.accessEndsAt &&
        current.accessEndsAt <= now
      ) {
        await enqueue(tx as Db, "purge_diary", {
          enrolmentId: params.enrolmentId!,
          finishCycle: current.finishCycle,
        });
      }
      await appendAudit(tx as Db, {
        tenantId,
        actorUserId: actor.userId,
        action: "retention_hold.released",
        targetType: "retention_hold",
        targetId: rows[0].id,
        enrolmentId: params.enrolmentId!,
        requestId,
      });
      return true;
    });
    if (!released) return notFoundProblem(requestId);
    return NextResponse.json({ ok: true });
  },
);
