import { defineConfig } from "drizzle-kit";

// Migrations are generated SQL, then hand-edited to add triggers, composite
// tenant FKs, partial indexes and append-only guards. Never `drizzle-kit push`.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema",
  out: "./db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://oportfolio:oportfolio_dev@localhost:5432/oportfolio",
  },
});
