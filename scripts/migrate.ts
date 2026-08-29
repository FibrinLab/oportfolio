import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { getEnv } from "@/server/config/env";

// Applies db/migrations in order (the only schema path — never
// `drizzle-kit push`). Safe to re-run; runs before the app/worker start in
// every deployment (docs/deployment.md).
async function main() {
  const pool = new Pool({ connectionString: getEnv().DATABASE_URL });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: "./db/migrations" });
  await pool.end();
  console.log("Migrations applied.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
