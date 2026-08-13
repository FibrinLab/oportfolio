import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          // Real Postgres/MinIO/clamd via docker compose; run serially so
          // transactions and seeds don't interleave.
          fileParallelism: false,
          testTimeout: 30000,
          hookTimeout: 60000,
        },
      },
      {
        extends: true,
        test: {
          name: "authz",
          include: ["tests/authz/**/*.test.ts"],
          environment: "node",
          fileParallelism: false,
          testTimeout: 30000,
          hookTimeout: 120000,
        },
      },
    ],
  },
});
