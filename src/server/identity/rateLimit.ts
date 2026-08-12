import { sql } from "drizzle-orm";
import type { Db } from "@/server/db/client";

// Fixed-window rate limiting backed by Postgres (spec/12: rate-limit
// authentication/invitations). Uniform responses are the caller's job.

export async function checkRateLimit(
  db: Db,
  key: string,
  limit: number,
  windowMinutes: number,
): Promise<boolean> {
  const result = await db.execute(sql`
    INSERT INTO login_rate (key, window_started_at, count)
    VALUES (${key}, now(), 1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN login_rate.window_started_at < now() - make_interval(mins => ${windowMinutes})
        THEN 1
        ELSE login_rate.count + 1
      END,
      window_started_at = CASE
        WHEN login_rate.window_started_at < now() - make_interval(mins => ${windowMinutes})
        THEN now()
        ELSE login_rate.window_started_at
      END
    RETURNING count
  `);
  const count = result.rows[0]?.count as number | undefined;
  return (count ?? 0) <= limit;
}
