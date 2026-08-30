import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getEnv } from "@/server/config/env";
import * as schema from "./schema";

// Pool lives on globalThis so Next.js dev hot-reload doesn't exhaust
// connections by re-creating it on every module refresh.
const globalForDb = globalThis as unknown as {
  pgPool?: Pool;
};

export function getPool(): Pool {
  if (!globalForDb.pgPool) {
    globalForDb.pgPool = new Pool({
      // TLS: append `?sslmode=verify-full` (or `require`) to DATABASE_URL —
      // node-postgres honours it. See docs/deployment.md.
      connectionString: getEnv().DATABASE_URL,
      // Cloudflare Workers cannot safely reuse a TCP socket that was opened
      // by an earlier request. Retire every checked-out client when it is
      // released, while retaining one pool so a transaction can keep its
      // connection for the duration of that transaction.
      maxUses: 1,
      // A Worker may have at most six simultaneous outbound connections.
      max: 5,
      // Fail with a normal API error instead of letting the Workers runtime
      // cancel a request that is waiting forever on a dead socket.
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 1_000,
      allowExitOnIdle: true,
    });
  }
  return globalForDb.pgPool;
}

export type Db = NodePgDatabase<typeof schema>;

let dbSingleton: Db | undefined;

export function getDb(): Db {
  if (!dbSingleton) {
    dbSingleton = drizzle(getPool(), { schema });
  }
  return dbSingleton;
}

export { schema };
