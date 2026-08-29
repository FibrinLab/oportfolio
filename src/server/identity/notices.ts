import { and, eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import type { Db } from "@/server/db/client";
import { noticeAcknowledgement } from "@/server/db/schema";
import type { NoticeType } from "@/lib/notices";

export interface NoticeInput {
  noticeType: NoticeType;
  noticeVersion: string;
}

// Records that a user saw and confirmed a notice version in a tenant. One row
// per (user, tenant, type, version): repeat sign-ins after the same
// confirmation add nothing, a new version adds a new row (spec/05: receipt /
// acknowledgement record, and the affirmative act for explicit consent —
// docs/dpia.md §4).
export async function recordNoticeAcknowledgements(
  tx: Db,
  tenantId: string,
  userId: string,
  notices: NoticeInput[],
  context: string,
): Promise<void> {
  for (const notice of notices) {
    const existing = await tx
      .select({ id: noticeAcknowledgement.id })
      .from(noticeAcknowledgement)
      .where(
        and(
          eq(noticeAcknowledgement.tenantId, tenantId),
          eq(noticeAcknowledgement.userId, userId),
          eq(noticeAcknowledgement.noticeType, notice.noticeType),
          eq(noticeAcknowledgement.noticeVersion, notice.noticeVersion),
        ),
      )
      .limit(1);
    if (existing[0]) continue;
    await tx.insert(noticeAcknowledgement).values({
      id: uuidv7(),
      tenantId,
      userId,
      noticeType: notice.noticeType,
      noticeVersion: notice.noticeVersion,
      context,
    });
  }
}
