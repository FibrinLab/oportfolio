import { sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";

// Data minimisation for the auth tables (spec/12): spent or expired tokens
// and revoked sessions carry no value once their window has passed, and the
// rate-limit table grows with every distinct email/IP. Audit rows are never
// touched here — they are append-only by design.
export async function runHousekeeping(): Promise<void> {
  const db = getDb();
  await db.execute(sql`DELETE FROM login_rate WHERE window_started_at < now() - interval '1 day'`);
  await db.execute(sql`
    DELETE FROM magic_link_token
    WHERE (used_at IS NOT NULL OR expires_at < now()) AND created_at < now() - interval '7 days'
  `);
  await db.execute(sql`
    DELETE FROM auth_session
    WHERE (revoked_at IS NOT NULL OR absolute_expires_at < now())
      AND coalesce(revoked_at, absolute_expires_at) < now() - interval '30 days'
  `);
}
