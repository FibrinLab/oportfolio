import { isSealedDiary } from "@/server/diary/sealing";
import { getEnv } from "@/server/config/env";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb, type Db } from "@/server/db/client";
import {
  appUser,
  attachment,
  enrolment,
  evidenceItem,
  exportJob,
  retentionHold,
} from "@/server/db/schema";
import { appendAudit } from "@/server/audit/audit";
import {
  deleteCleanObject,
  deleteExportObject,
  deleteQuarantineObject,
} from "@/server/files/s3";
import { renderTemplate } from "@/server/mail/templates";
import { sendMail } from "@/server/mail/mailer";
import type { OutboxPayloads } from "@/server/outbox/outbox";

const DAYS_BY_REMINDER = {
  thirty_days: "30",
  seven_days: "7",
  one_day: "1",
} as const;

export async function handleDiaryReminder(
  payload: OutboxPayloads["diary_reminder"],
): Promise<void> {
  const db = getDb();
  const rows = await db
    .select({
      email: appUser.emailNormalised,
      state: enrolment.diaryState,
      finishCycle: enrolment.diaryFinishCycle,
      accessEndsAt: enrolment.diaryAccessEndsAt,
    })
    .from(enrolment)
    .innerJoin(appUser, eq(enrolment.fellowUserId, appUser.id))
    .where(eq(enrolment.id, payload.enrolmentId))
    .limit(1);
  const row = rows[0];
  if (
    !row ||
    row.state !== "finished" ||
    row.finishCycle !== payload.finishCycle ||
    !row.accessEndsAt ||
    row.accessEndsAt <= new Date()
  ) {
    return;
  }

  const rendered = renderTemplate("diary_deletion_reminder", {
    daysRemaining: DAYS_BY_REMINDER[payload.kind],
    appUrl: getEnv().APP_BASE_URL,
  });
  if (!rendered) throw new Error("diary reminder template missing");
  await sendMail(row.email, rendered.subject, rendered.text);
}

export async function handlePurgeDiary(
  payload: OutboxPayloads["purge_diary"],
): Promise<void> {
  const db = getDb();
  const lifecycleRows = await db
    .select({
      tenantId: enrolment.tenantId,
      state: enrolment.diaryState,
      finishCycle: enrolment.diaryFinishCycle,
      accessEndsAt: enrolment.diaryAccessEndsAt,
      holdId: retentionHold.id,
    })
    .from(enrolment)
    .leftJoin(
      retentionHold,
      and(eq(retentionHold.enrolmentId, enrolment.id), isNull(retentionHold.releasedAt)),
    )
    .where(eq(enrolment.id, payload.enrolmentId))
    .limit(1);
  const lifecycle = lifecycleRows[0];
  if (
    !lifecycle ||
    lifecycle.state !== "finished" ||
    lifecycle.finishCycle !== payload.finishCycle
  ) {
    return;
  }
  if (lifecycle.holdId) return;
  if (!lifecycle.accessEndsAt || lifecycle.accessEndsAt > new Date()) {
    throw new Error("diary_purge_not_due");
  }

  const successfulFinal = await db
    .select({ id: exportJob.id })
    .from(exportJob)
    .where(
      and(
        eq(exportJob.enrolmentId, payload.enrolmentId),
        eq(exportJob.kind, "final"),
        eq(exportJob.finishCycle, payload.finishCycle),
        eq(exportJob.status, "ready"),
      ),
    )
    .limit(1);
  if (!successfulFinal[0] && !(await isSealedDiary(db, payload.enrolmentId))) {
    throw new Error("final_export_not_ready");
  }

  const [attachmentObjects, exportObjects] = await Promise.all([
    db
      .select({ objectKey: attachment.objectKey })
      .from(attachment)
      .innerJoin(
        evidenceItem,
        and(
          eq(attachment.parentType, "evidence_item"),
          eq(attachment.parentId, evidenceItem.id),
        ),
      )
      .where(eq(evidenceItem.enrolmentId, payload.enrolmentId)),
    db
      .select({ objectKey: exportJob.objectKey })
      .from(exportJob)
      .where(eq(exportJob.enrolmentId, payload.enrolmentId)),
  ]);

  for (const object of attachmentObjects) {
    await Promise.all([
      deleteCleanObject(object.objectKey),
      deleteQuarantineObject(object.objectKey),
    ]);
  }
  for (const object of exportObjects) {
    if (object.objectKey) await deleteExportObject(object.objectKey);
  }

  await db.transaction(async (tx) => {
    const result = await tx.execute(sql`
      SELECT purge_diary_contents(${payload.enrolmentId}::uuid, ${payload.finishCycle}::integer) AS purged
    `);
    if (result.rows[0]?.purged !== true) throw new Error("diary_purge_precondition_failed");
    await appendAudit(tx as Db, {
      tenantId: lifecycle.tenantId,
      actorType: "worker",
      action: "diary.purged",
      targetType: "enrolment",
      targetId: payload.enrolmentId,
      enrolmentId: payload.enrolmentId,
      metadata: { finishCycle: payload.finishCycle },
    });
  });
}
