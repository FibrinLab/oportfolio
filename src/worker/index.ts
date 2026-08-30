import { getEnv } from "@/server/config/env";
import { runHousekeeping } from "./housekeeping";
import { processOne } from "./processor";

// Background worker: polls the Postgres outbox with FOR UPDATE SKIP LOCKED.
// One modular monolith, two processes (`pnpm dev` + `pnpm worker`).

const POLL_INTERVAL_MS = 1000;
const HOUSEKEEPING_INTERVAL_MS = 60 * 60 * 1000;

async function main() {
  // Fail fast on a misconfigured deployment (same checks as the web app).
  getEnv();
  console.log("[worker] started");
  let running = true;
  let lastHousekeeping = 0;
  const stop = () => {
    running = false;
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  while (running) {
    try {
      if (Date.now() - lastHousekeeping > HOUSEKEEPING_INTERVAL_MS) {
        lastHousekeeping = Date.now();
        await runHousekeeping();
      }
      const didWork = await processOne();
      if (!didWork) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    } catch (error) {
      console.error("[worker] poll error", error);
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS * 5));
    }
  }
  console.log("[worker] stopped");
  process.exit(0);
}

main();
