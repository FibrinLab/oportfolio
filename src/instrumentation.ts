// Runs once when the Next.js server boots. Validating configuration here
// means a misconfigured production deployment fails at startup (visible in
// the container logs / health check) rather than on the first request.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getEnv } = await import("@/server/config/env");
    getEnv();
  }
}
