import { Client } from "pg";

// Synthetic test environment reset: repeated e2e runs exhaust the per-email
// magic-link rate limit (5/hour — spec/12 behavior under test elsewhere).
// Clearing the fixed-window counters keeps reruns deterministic.
export default async function globalSetup() {
  const client = new Client({
    connectionString:
      process.env.DATABASE_URL ??
      "postgres://oportfolio:oportfolio_dev@localhost:5432/oportfolio",
  });
  await client.connect();
  await client.query("DELETE FROM login_rate");
  await client.end();
}
