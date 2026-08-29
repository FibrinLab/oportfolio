import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { uuidv7 } from "uuidv7";
import { getDb } from "@/server/db/client";

const db = getDb();

async function expectDbRejection(
  promise: Promise<unknown>,
  pattern: RegExp,
): Promise<void> {
  try {
    await promise;
  } catch (error) {
    const messages: string[] = [];
    let current: unknown = error;
    while (current instanceof Error) {
      messages.push(current.message);
      current = current.cause;
    }
    expect(messages.join(" | ")).toMatch(pattern);
    return;
  }
  expect.fail(`expected query to be rejected with ${pattern}`);
}

async function createDiaryFixture(input: {
  state: "open" | "finished";
  hold?: boolean;
}) {
  const tenantId = uuidv7();
  const userId = uuidv7();
  const programmeId = uuidv7();
  const cohortId = uuidv7();
  const enrolmentId = uuidv7();
  const entryId = uuidv7();
  const exportId = uuidv7();
  const holdId = input.hold ? uuidv7() : null;
  const suffix = tenantId.slice(-12);
  const accessEndsAt = new Date(Date.now() - 60_000);

  await db.transaction(async (tx) => {
    await tx.execute(sql`
      INSERT INTO tenant (id, name, slug)
      VALUES (${tenantId}::uuid, 'Diary lifecycle test', ${`diary-test-${suffix}`})
    `);
    await tx.execute(sql`
      INSERT INTO app_user (id, email_normalised, display_name)
      VALUES (${userId}::uuid, ${`diary-${suffix}@test.example.org`}, 'Diary Test Fellow')
    `);
    await tx.execute(sql`
      INSERT INTO programme (id, tenant_id, code, name)
      VALUES (${programmeId}::uuid, ${tenantId}::uuid, ${`P-${suffix}`}, 'Test Programme')
    `);
    await tx.execute(sql`
      INSERT INTO cohort (id, tenant_id, programme_id, code, name, status)
      VALUES (${cohortId}::uuid, ${tenantId}::uuid, ${programmeId}::uuid,
              ${`C-${suffix}`}, 'Test Cohort', 'active')
    `);
    await tx.execute(sql`
      INSERT INTO enrolment (
        id, tenant_id, cohort_id, fellow_user_id, status, diary_state,
        diary_finish_cycle, diary_finished_at, diary_access_ends_at
      ) VALUES (
        ${enrolmentId}::uuid, ${tenantId}::uuid, ${cohortId}::uuid,
        ${userId}::uuid, 'active', ${input.state},
        ${input.state === "finished" ? 1 : 0},
        ${input.state === "finished" ? accessEndsAt : null},
        ${input.state === "finished" ? accessEndsAt : null}
      )
    `);
    await tx.execute(sql`
      INSERT INTO evidence_item (
        id, tenant_id, enrolment_id, author_user_id, title,
        narrative_doc, narrative_text, visibility, workflow_state
      ) VALUES (
        ${entryId}::uuid, ${tenantId}::uuid, ${enrolmentId}::uuid,
        ${userId}::uuid, 'Private lifecycle entry',
        '{"type":"doc","content":[]}'::jsonb, 'private words', 'private', 'draft'
      )
    `);
    await tx.execute(sql`
      INSERT INTO evidence_revision (
        id, evidence_item_id, revision_number, snapshot_json,
        content_sha256, created_by
      ) VALUES (
        ${uuidv7()}::uuid, ${entryId}::uuid, 1, '{"title":"Private lifecycle entry"}'::jsonb,
        ${"a".repeat(64)}, ${userId}::uuid
      )
    `);
    await tx.execute(sql`
      INSERT INTO export_job (
        id, tenant_id, enrolment_id, requested_by, kind, status,
        finish_cycle, snapshot_json, object_key, artifact_expires_at, completed_at
      ) VALUES (
        ${exportId}::uuid, ${tenantId}::uuid, ${enrolmentId}::uuid,
        ${userId}::uuid, 'final', 'ready',
        ${input.state === "finished" ? 1 : null}, '{"contains":"private snapshot"}'::jsonb,
        ${`${tenantId}/export/${exportId}.zip`}, ${accessEndsAt}, now()
      )
    `);
    if (holdId) {
      await tx.execute(sql`
        INSERT INTO retention_hold (id, tenant_id, enrolment_id, reason, placed_by)
        VALUES (${holdId}::uuid, ${tenantId}::uuid, ${enrolmentId}::uuid,
                'Integration test retention hold', ${userId}::uuid)
      `);
    }
  });

  return { enrolmentId, entryId, exportId, holdId, userId };
}

describe("private diary database invariants", () => {
  it("rejects reintroducing a staff-visible diary audience", async () => {
    const fixture = await createDiaryFixture({ state: "open" });
    await expectDbRejection(
      db.execute(sql`
        UPDATE evidence_item
        SET visibility = 'supervisors', workflow_state = 'shared'
        WHERE id = ${fixture.entryId}::uuid
      `),
      /evidence_item_private_only_check/,
    );
  });

  it("keeps revisions append-only outside the guarded purge", async () => {
    const fixture = await createDiaryFixture({ state: "open" });
    await expectDbRejection(
      db.execute(sql`
        DELETE FROM evidence_revision WHERE evidence_item_id = ${fixture.entryId}::uuid
      `),
      /append-only/,
    );
  });

  it("requires a due finished cycle and no active hold before purging", async () => {
    const fixture = await createDiaryFixture({ state: "finished", hold: true });
    const held = await db.execute(sql`
      SELECT purge_diary_contents(${fixture.enrolmentId}::uuid, 1) AS purged
    `);
    expect(held.rows[0]?.purged).toBe(false);

    await db.execute(sql`
      UPDATE retention_hold
      SET released_at = now(), released_by = ${fixture.userId}::uuid
      WHERE id = ${fixture.holdId!}::uuid
    `);
    const released = await db.execute(sql`
      SELECT purge_diary_contents(${fixture.enrolmentId}::uuid, 1) AS purged
    `);
    expect(released.rows[0]?.purged).toBe(true);

    const result = await db.execute(sql`
      SELECT
        e.diary_state,
        (SELECT count(*) FROM evidence_item WHERE enrolment_id = ${fixture.enrolmentId}::uuid) AS entries,
        (SELECT snapshot_json FROM export_job WHERE id = ${fixture.exportId}::uuid) AS snapshot,
        (SELECT object_key FROM export_job WHERE id = ${fixture.exportId}::uuid) AS object_key
      FROM enrolment e WHERE e.id = ${fixture.enrolmentId}::uuid
    `);
    expect(result.rows[0]?.diary_state).toBe("purged");
    expect(Number(result.rows[0]?.entries)).toBe(0);
    expect(result.rows[0]?.snapshot).toEqual({ purged: true });
    expect(result.rows[0]?.object_key).toBeNull();
  });
});
