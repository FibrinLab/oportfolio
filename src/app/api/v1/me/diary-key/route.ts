import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { diaryKey, membership } from "@/server/db/schema";
import { appendAudit } from "@/server/audit/audit";
import { putDiaryKeyRequest } from "@/server/http/apiSchemas";
import { withApi } from "@/server/http/withApi";

// Wrapped diary-key material (ADR-007). The server stores and returns
// ciphertext it cannot open; unlocking happens entirely in the browser.

export const GET = withApi({}, async ({ actor }) => {
  const rows = await getDb()
    .select({ material: diaryKey.materialJson, keyVersion: diaryKey.keyVersion, updatedAt: diaryKey.updatedAt })
    .from(diaryKey)
    .where(eq(diaryKey.userId, actor.userId))
    .limit(1);
  const row = rows[0];
  return NextResponse.json(
    row ? { material: row.material, keyVersion: row.keyVersion, updatedAt: row.updatedAt } : { material: null },
    { headers: { "Cache-Control": "no-store" } },
  );
});

export const PUT = withApi({ bodySchema: putDiaryKeyRequest }, async ({ actor, body, requestId }) => {
  const db = getDb();
  const now = new Date();
  const created = await db.transaction(async (tx) => {
    const existing = await tx
      .select({ userId: diaryKey.userId })
      .from(diaryKey)
      .where(eq(diaryKey.userId, actor.userId))
      .limit(1);
    if (existing[0]) {
      await tx
        .update(diaryKey)
        .set({ materialJson: body.material, keyVersion: body.material.keyVersion, updatedAt: now })
        .where(eq(diaryKey.userId, actor.userId));
    } else {
      await tx.insert(diaryKey).values({
        userId: actor.userId,
        keyVersion: body.material.keyVersion,
        materialJson: body.material,
      });
    }
    // Audited in every tenant the user belongs to — key events matter to
    // each controller, and the audit row carries no key material.
    const tenants = await tx
      .selectDistinct({ tenantId: membership.tenantId })
      .from(membership)
      .where(eq(membership.userId, actor.userId));
    for (const row of tenants) {
      await appendAudit(tx, {
        tenantId: row.tenantId,
        actorUserId: actor.userId,
        action: existing[0] ? "diary_key.rewrapped" : "diary_key.created",
        targetType: "app_user",
        targetId: actor.userId,
        requestId,
        metadata: { keyVersion: body.material.keyVersion },
      });
    }
    return !existing[0];
  });
  return NextResponse.json({ ok: true, created }, { status: created ? 201 : 200 });
});
