import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { getDb } from "@/server/db/client";
import { enrolment, exportJob } from "@/server/db/schema";
import { appendAudit } from "@/server/audit/audit";
import { enqueue } from "@/server/outbox/outbox";
import type { Actor } from "@/server/policy/actor";
import type { EnrolmentContext } from "@/server/policy/policy";
import { createDiaryExportJob } from "./export";

export const DIARY_ACCESS_DAYS = 90;

export async function finishDiary(
  actor: Actor,
  context: EnrolmentContext,
  requestId: string | null,
): Promise<{ ok: true; exportJobId: string; accessEndsAt: Date } | { ok: false }> {
  if (
    context.fellowUserId !== actor.userId ||
    context.diaryState !== "open" ||
    !actor.memberships.some((membership) => membership.tenantId === context.tenantId)
  ) {
    return { ok: false };
  }

  const db = getDb();
  const finishedAt = new Date();
  const accessEndsAt = new Date(
    finishedAt.getTime() + DIARY_ACCESS_DAYS * 24 * 60 * 60 * 1000,
  );
  const finishCycle = context.diaryFinishCycle + 1;

  return db.transaction(async (tx) => {
    const updated = await tx
      .update(enrolment)
      .set({
        diaryState: "finished",
        diaryFinishCycle: finishCycle,
        diaryFinishedAt: finishedAt,
        diaryAccessEndsAt: accessEndsAt,
        updatedAt: finishedAt,
        updatedBy: actor.userId,
        rowVersion: sql`${enrolment.rowVersion} + 1`,
      })
      .where(
        and(
          eq(enrolment.id, context.id),
          eq(enrolment.tenantId, context.tenantId),
          eq(enrolment.fellowUserId, actor.userId),
          eq(enrolment.diaryState, "open"),
          eq(enrolment.diaryFinishCycle, context.diaryFinishCycle),
        ),
      )
      .returning({ id: enrolment.id });
    if (!updated[0]) return { ok: false as const };

    const finishedContext: EnrolmentContext = {
      ...context,
      diaryState: "finished",
      diaryFinishCycle: finishCycle,
      diaryAccessEndsAt: accessEndsAt,
    };
    const job = await createDiaryExportJob(tx as Db, actor, finishedContext, {
      kind: "final",
      finishCycle,
    });

    const reminder = async (
      kind: "thirty_days" | "seven_days" | "one_day",
      daysBefore: number,
    ) =>
      enqueue(
        tx as Db,
        "diary_reminder",
        { enrolmentId: context.id, finishCycle, kind },
        new Date(accessEndsAt.getTime() - daysBefore * 24 * 60 * 60 * 1000),
      );
    await reminder("thirty_days", 30);
    await reminder("seven_days", 7);
    await reminder("one_day", 1);
    await enqueue(
      tx as Db,
      "purge_diary",
      { enrolmentId: context.id, finishCycle },
      accessEndsAt,
    );

    await appendAudit(tx as Db, {
      tenantId: context.tenantId,
      actorUserId: actor.userId,
      action: "diary.finished",
      targetType: "enrolment",
      targetId: context.id,
      enrolmentId: context.id,
      requestId,
      metadata: { finishCycle, accessEndsAt: accessEndsAt.toISOString() },
    });
    return { ok: true as const, exportJobId: job.id, accessEndsAt };
  });
}

export async function reopenDiary(
  actor: Actor,
  context: EnrolmentContext,
  requestId: string | null,
): Promise<boolean> {
  const now = new Date();
  if (
    context.fellowUserId !== actor.userId ||
    context.diaryState !== "finished" ||
    !context.diaryAccessEndsAt ||
    context.diaryAccessEndsAt <= now
  ) {
    return false;
  }

  const db = getDb();
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(enrolment)
      .set({
        diaryState: "open",
        diaryFinishedAt: null,
        diaryAccessEndsAt: null,
        updatedAt: now,
        updatedBy: actor.userId,
        rowVersion: sql`${enrolment.rowVersion} + 1`,
      })
      .where(
        and(
          eq(enrolment.id, context.id),
          eq(enrolment.tenantId, context.tenantId),
          eq(enrolment.fellowUserId, actor.userId),
          eq(enrolment.diaryState, "finished"),
          eq(enrolment.diaryFinishCycle, context.diaryFinishCycle),
        ),
      )
      .returning({ id: enrolment.id });
    if (!updated[0]) return false;

    const finalJobs = await tx
      .update(exportJob)
      .set({ status: "superseded", updatedAt: now })
      .where(
        and(
          eq(exportJob.enrolmentId, context.id),
          eq(exportJob.kind, "final"),
          eq(exportJob.finishCycle, context.diaryFinishCycle),
          inArray(exportJob.status, ["queued", "processing", "ready"]),
        ),
      )
      .returning({ id: exportJob.id });
    for (const job of finalJobs) {
      await enqueue(tx as Db, "expire_diary_export", { exportJobId: job.id }, now);
    }

    await appendAudit(tx as Db, {
      tenantId: context.tenantId,
      actorUserId: actor.userId,
      action: "diary.reopened",
      targetType: "enrolment",
      targetId: context.id,
      enrolmentId: context.id,
      requestId,
      metadata: { invalidatedFinishCycle: context.diaryFinishCycle },
    });
    return true;
  });
}
