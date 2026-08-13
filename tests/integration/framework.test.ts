import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getDb } from "@/server/db/client";

// Framework/package integration tests against the migrated, seeded database
// (spec/15:176-183). Requires `pnpm db:migrate && pnpm framework:import
// spec/frameworks/fcai/v3.2/framework.json --publish` to have run.

const db = getDb();

// Drizzle wraps Postgres errors ("Failed query: …") and keeps the original
// message on error.cause — assert against the whole chain.
async function expectDbRejection(promise: Promise<unknown>, pattern: RegExp): Promise<void> {
  try {
    await promise;
  } catch (error) {
    const chain: string[] = [];
    let current: unknown = error;
    while (current instanceof Error) {
      chain.push(current.message);
      current = current.cause;
    }
    expect(chain.join(" | ")).toMatch(pattern);
    return;
  }
  expect.fail(`expected query to be rejected with ${pattern}`);
}

async function releaseId(): Promise<string> {
  const rows = await db.execute(sql`
    SELECT fr.id FROM framework_release fr
    JOIN framework f ON f.id = fr.framework_id
    WHERE f.namespace = 'fcai' AND fr.version = '3.2'
  `);
  const id = rows.rows[0]?.id as string | undefined;
  if (!id) throw new Error("FCAI v3.2 not imported");
  return id;
}

describe("FCAI v3.2 seed", () => {
  it("holds exactly 5 domains, 30 objectives, 4 delivery methods, 48 mappings", async () => {
    const id = await releaseId();
    const counts = await db.execute(sql`
      SELECT
        (SELECT count(*) FROM domain WHERE framework_release_id = ${id}) AS domains,
        (SELECT count(*) FROM objective WHERE framework_release_id = ${id}) AS objectives,
        (SELECT count(*) FROM delivery_method WHERE framework_release_id = ${id}) AS delivery_methods,
        (SELECT count(*) FROM cross_mapping WHERE source_release_id = ${id}) AS cross_mappings,
        (SELECT count(*) FROM external_framework WHERE framework_release_id = ${id}) AS external_frameworks
    `);
    const row = counts.rows[0]!;
    expect(Number(row.domains)).toBe(5);
    expect(Number(row.objectives)).toBe(30);
    expect(Number(row.delivery_methods)).toBe(4);
    expect(Number(row.cross_mappings)).toBe(48);
    expect(Number(row.external_frameworks)).toBe(4);
  });

  it("keeps published HEE/FCI mappings at domain level", async () => {
    const id = await releaseId();
    const levels = await db.execute(sql`
      SELECT DISTINCT source_level FROM cross_mapping WHERE source_release_id = ${id}
    `);
    expect(levels.rows.map((r) => r.source_level)).toEqual(["domain"]);
  });
});

describe("published release immutability (ADR-001)", () => {
  it("rejects UPDATE of a published release's objectives", async () => {
    const id = await releaseId();
    await expectDbRejection(
      db.execute(
        sql`UPDATE objective SET title = 'tampered' WHERE framework_release_id = ${id} AND code = 'AF-01'`,
      ),
      /immutable/,
    );
  });

  it("rejects DELETE of a published release's domains", async () => {
    const id = await releaseId();
    await expectDbRejection(
      db.execute(sql`DELETE FROM domain WHERE framework_release_id = ${id}`),
      /immutable/,
    );
  });

  it("rejects deleting the release row itself", async () => {
    const id = await releaseId();
    await expectDbRejection(
      db.execute(sql`DELETE FROM framework_release WHERE id = ${id}`),
      /immutable/,
    );
  });

  it("still allows the published → superseded lifecycle transition", async () => {
    const id = await releaseId();
    await db.execute(sql`UPDATE framework_release SET status = 'superseded' WHERE id = ${id}`);
    await db.execute(sql`UPDATE framework_release SET status = 'published' WHERE id = ${id}`);
  });
});

describe("audit chain", () => {
  it("is append-only at the database level", async () => {
    const rows = await db.execute(sql`SELECT id FROM audit_event LIMIT 1`);
    const id = rows.rows[0]?.id as string | undefined;
    if (!id) return; // no events yet
    await expectDbRejection(
      db.execute(sql`UPDATE audit_event SET action = 'tampered' WHERE id = ${id}`),
      /append-only/,
    );
    await expectDbRejection(
      db.execute(sql`DELETE FROM audit_event WHERE id = ${id}`),
      /append-only/,
    );
  });
});

describe("evidence revisions", () => {
  it("are append-only at the database level", async () => {
    const rows = await db.execute(sql`SELECT id FROM evidence_revision LIMIT 1`);
    const id = rows.rows[0]?.id as string | undefined;
    if (!id) return;
    await expectDbRejection(
      db.execute(sql`UPDATE evidence_revision SET change_reason = 'tampered' WHERE id = ${id}`),
      /append-only/,
    );
  });
});

describe("evidence objective release pinning (invariant 2)", () => {
  it("rejects mapping an objective from a different release", async () => {
    // Any evidence item + an objective id that is NOT in its enrolment's
    // pinned release: fabricate by pointing at a random uuid — FK fails first,
    // so instead use an objective from the pinned release with a doctored
    // enrolment. Simplest real check: an objective id from the pinned release
    // maps fine; a made-up id fails FK; a cross-release id fails the trigger.
    const item = await db.execute(sql`
      SELECT ei.id, e.framework_release_id
      FROM evidence_item ei JOIN enrolment e ON e.id = ei.enrolment_id
      WHERE e.framework_release_id IS NOT NULL LIMIT 1
    `);
    const row = item.rows[0];
    if (!row) return;

    // Create a second (draft) release with one objective to map across.
    const releaseInsert = await db.execute(sql`
      INSERT INTO framework_release (id, framework_id, version, status, source_url, package_sha256, schema_version)
      SELECT gen_random_uuid(), framework_id, '99.' || floor(random()*100000)::text, 'draft', source_url, 'test', schema_version
      FROM framework_release WHERE id = ${row.framework_release_id}
      RETURNING id
    `);
    const otherReleaseId = releaseInsert.rows[0]!.id as string;
    const domainInsert = await db.execute(sql`
      INSERT INTO domain (id, framework_release_id, stable_id, code, title, sort_order)
      VALUES (gen_random_uuid(), ${otherReleaseId}, 'test.domain', 'ZZ', 'Test', 1)
      RETURNING id
    `);
    const objectiveInsert = await db.execute(sql`
      INSERT INTO objective (id, framework_release_id, domain_id, stable_id, code, title, source_text, sort_order)
      VALUES (gen_random_uuid(), ${otherReleaseId}, ${domainInsert.rows[0]!.id as string}, 'test.objective', 'ZZ-01', 'Test objective', 'Test', 1)
      RETURNING id
    `);

    await expectDbRejection(
      db.execute(sql`
        INSERT INTO evidence_objective (id, evidence_item_id, objective_id, mapped_by)
        VALUES (gen_random_uuid(), ${row.id as string}, ${objectiveInsert.rows[0]!.id as string}, gen_random_uuid())
      `),
      /pinned framework release/,
    );
  });
});
