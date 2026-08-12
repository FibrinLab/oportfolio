import { sql } from "drizzle-orm";
import { getPool, getDb } from "@/server/db/client";
import { computeEventHash, GENESIS_HASH } from "@/server/audit/hashChain";

// Re-walks every tenant's audit chain and recomputes each hash. Exits
// non-zero on any break — run in CI and on demand (spec/05 tamper detection).

async function main() {
  const db = getDb();
  const tenants = await db.execute(sql`SELECT DISTINCT tenant_id FROM audit_event`);
  let checked = 0;
  let broken = 0;

  for (const tenantRow of tenants.rows) {
    const tenantId = tenantRow.tenant_id as string;
    const events = await db.execute(sql`
      SELECT id, occurred_at, actor_user_id, actor_type, action, target_type,
             target_id, enrolment_id, request_id, outcome, reason_code,
             metadata_json, previous_event_hash, event_hash
      FROM audit_event
      WHERE tenant_id = ${tenantId}
      ORDER BY occurred_at ASC, id ASC
    `);

    let expectedPrevious = GENESIS_HASH;
    for (const row of events.rows) {
      checked += 1;
      if (row.previous_event_hash !== expectedPrevious) {
        console.error(
          `CHAIN BREAK tenant=${tenantId} event=${row.id}: previous_event_hash mismatch`,
        );
        broken += 1;
      }
      const recomputed = computeEventHash(
        {
          occurredAt: new Date(row.occurred_at as string).toISOString(),
          actorUserId: (row.actor_user_id as string | null) ?? null,
          actorType: row.actor_type as string,
          action: row.action as string,
          targetType: row.target_type as string,
          targetId: (row.target_id as string | null) ?? null,
          enrolmentId: (row.enrolment_id as string | null) ?? null,
          requestId: (row.request_id as string | null) ?? null,
          outcome: row.outcome as string,
          reasonCode: (row.reason_code as string | null) ?? null,
          metadata: row.metadata_json ?? null,
        },
        row.previous_event_hash as string,
      );
      if (recomputed !== row.event_hash) {
        console.error(`HASH MISMATCH tenant=${tenantId} event=${row.id}`);
        broken += 1;
      }
      expectedPrevious = row.event_hash as string;
    }
  }

  await getPool().end();
  if (broken > 0) {
    console.error(`Audit chain verification FAILED: ${broken} problem(s) in ${checked} events.`);
    process.exit(1);
  }
  console.log(`Audit chain verified: ${checked} events across ${tenants.rows.length} tenant(s).`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
