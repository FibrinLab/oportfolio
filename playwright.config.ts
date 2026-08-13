import { defineConfig, devices } from "@playwright/test";

// E2E acceptance scenarios (spec/15 AC-01..05, AC-16) against the local dev
// stack: `docker compose up -d`, `pnpm db:migrate`, framework import, seed,
// `pnpm dev` + `pnpm worker` must be running.

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.APP_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
