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
      max: 10,
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
