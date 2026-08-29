import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { uuidv7 } from "uuidv7";
import { getDb } from "@/server/db/client";

// End-to-end encryption at the storage layer (ADR-007): once a row is
// `encrypted`, the database itself refuses plaintext in the columns the
// browser no longer fills — a defence against any future code path that
// forgets the rule.

const db = getDb();

async function expectDbRejection(promise: Promise<unknown>, pattern: RegExp): Promise<void> {
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

const envelope = JSON.stringify({ v: 1, alg: "A256GCM", kid: 1, iv: "AAAAAAAAAAAAAAAA", ct: "A".repeat(40) });

async function fixture() {
  const tenantId = uuidv7();
  const userId = uuidv7();
  const programmeId = uuidv7();
  const cohortId = uuidv7();
  const enrolmentId = uuidv7();
  const suffix = tenantId.slice(-12);
  await db.execute(sql`INSERT INTO tenant (id, name, slug) VALUES (${tenantId}::uuid, 'Sealing test', ${`seal-${suffix}`})`);
  await db.execute(sql`INSERT INTO app_user (id, email_normalised, display_name) VALUES (${userId}::uuid, ${`seal-${suffix}@test.example.org`}, 'Seal Fellow')`);
  await db.execute(sql`INSERT INTO programme (id, tenant_id, code, name) VALUES (${programmeId}::uuid, ${tenantId}::uuid, ${`P-${suffix}`}, 'P')`);
  await db.execute(sql`INSERT INTO cohort (id, tenant_id, programme_id, code, name, status) VALUES (${cohortId}::uuid, ${tenantId}::uuid, ${programmeId}::uuid, ${`C-${suffix}`}, 'C', 'active')`);
  await db.execute(sql`
    INSERT INTO enrolment (id, tenant_id, cohort_id, fellow_user_id, starts_on, status, diary_state)
    VALUES (${enrolmentId}::uuid, ${tenantId}::uuid, ${cohortId}::uuid, ${userId}::uuid, current_date, 'active', 'open')
  `);
  return { tenantId, userId, enrolmentId };
}

function insertEntry(f: { tenantId: string; userId: string; enrolmentId: string }, opts: { encrypted: boolean; title: string; text: string; withEnc: boolean }) {
  return db.execute(sql`
    INSERT INTO evidence_item (id, tenant_id, enrolment_id, author_user_id, title, narrative_doc, narrative_text, encrypted, content_enc, created_by, updated_by)
    VALUES (${uuidv7()}::uuid, ${f.tenantId}::uuid, ${f.enrolmentId}::uuid, ${f.userId}::uuid, ${opts.title},
            '{"type":"doc","content":[]}'::jsonb, ${opts.text}, ${opts.encrypted},
            ${opts.withEnc ? sql`${JSON.stringify({ title: JSON.parse(envelope), narrative: JSON.parse(envelope) })}::jsonb` : sql`NULL`},
            ${f.userId}::uuid, ${f.userId}::uuid)
    RETURNING id
  `);
}

describe("sealed rows carry no plaintext", () => {
  it("evidence_item: encrypted rows must have empty title/text and an envelope", async () => {
    const f = await fixture();
    const sealed = await insertEntry(f, { encrypted: true, title: "", text: "", withEnc: true });
    expect(sealed.rows).toHaveLength(1);
    await expectDbRejection(
      insertEntry(f, { encrypted: true, title: "leaked title", text: "", withEnc: true }),
      /evidence_item_encrypted_no_plaintext_check/,
    );
    await expectDbRejection(
      insertEntry(f, { encrypted: true, title: "", text: "leaked words", withEnc: true }),
      /evidence_item_encrypted_no_plaintext_check/,
    );
    await expectDbRejection(
      insertEntry(f, { encrypted: true, title: "", text: "", withEnc: false }),
      /evidence_item_encrypted_no_plaintext_check/,
    );
    // Legacy plaintext rows are still allowed until the browser seals them.
    const plain = await insertEntry(f, { encrypted: false, title: "Plain", text: "words", withEnc: false });
    expect(plain.rows).toHaveLength(1);
  });

  it("external_link and attachment: encrypted rows must be opaque", async () => {
    const f = await fixture();
    const entry = await insertEntry(f, { encrypted: true, title: "", text: "", withEnc: true });
    const entryId = entry.rows[0]!.id as string;
    await expectDbRejection(
      db.execute(sql`
        INSERT INTO external_link (id, tenant_id, evidence_item_id, url, host, encrypted, link_enc, created_by, updated_by)
        VALUES (${uuidv7()}::uuid, ${f.tenantId}::uuid, ${entryId}::uuid, 'https://leak.example', 'leak.example', true, ${envelope}::jsonb, ${f.userId}::uuid, ${f.userId}::uuid)
      `),
      /external_link_encrypted_no_plaintext_check/,
    );
    const link = await db.execute(sql`
      INSERT INTO external_link (id, tenant_id, evidence_item_id, url, host, encrypted, link_enc, created_by, updated_by)
      VALUES (${uuidv7()}::uuid, ${f.tenantId}::uuid, ${entryId}::uuid, '', '', true, ${envelope}::jsonb, ${f.userId}::uuid, ${f.userId}::uuid)
      RETURNING id
    `);
    expect(link.rows).toHaveLength(1);

    await expectDbRejection(
      db.execute(sql`
        INSERT INTO attachment (id, tenant_id, parent_id, object_key, original_filename, display_name, media_type_claimed, size_bytes, encrypted, name_enc, created_by, updated_by)
        VALUES (${uuidv7()}::uuid, ${f.tenantId}::uuid, ${entryId}::uuid, ${`k-${uuidv7()}`}, 'secret.pdf', 'secret.pdf', 'application/octet-stream', 10, true, ${envelope}::jsonb, ${f.userId}::uuid, ${f.userId}::uuid)
      `),
      /attachment_encrypted_no_plaintext_check/,
    );
    const file = await db.execute(sql`
      INSERT INTO attachment (id, tenant_id, parent_id, object_key, original_filename, display_name, media_type_claimed, size_bytes, encrypted, name_enc, created_by, updated_by)
      VALUES (${uuidv7()}::uuid, ${f.tenantId}::uuid, ${entryId}::uuid, ${`k-${uuidv7()}`}, 'sealed', 'sealed', 'application/octet-stream', 10, true, ${envelope}::jsonb, ${f.userId}::uuid, ${f.userId}::uuid)
      RETURNING id
    `);
    expect(file.rows).toHaveLength(1);
  });

  it("scan_status accepts the sealed state for browser-encrypted files", async () => {
    const rows = await db.execute(sql`SELECT enumlabel FROM pg_enum WHERE enumtypid = 'scan_status'::regtype`);
    expect(rows.rows.map((r) => r.enumlabel)).toContain("sealed");
  });
});
