import { z } from "zod";

// Single source of truth for runtime configuration (spec/13: documented
// environment variables/secrets; spec/12: least privilege, no dev credentials
// in production).
//
// - Development: every value has a docker-compose default so `pnpm dev`
//   works from a fresh clone.
// - Production (NODE_ENV=production): required values MUST be provided and
//   known development credentials are refused. Validation runs once at
//   startup (src/instrumentation.ts and the worker) so a misconfigured
//   deployment fails fast instead of silently talking to localhost.

const DEV_DATABASE_URL = "postgres://oportfolio:oportfolio_dev@localhost:5432/oportfolio";
const DEV_SECRETS = new Set(["oportfolio", "oportfolio_dev"]);

const bool = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === "boolean" ? v : ["1", "true", "yes", "on"].includes(v.toLowerCase())));

const port = z.coerce.number().int().min(1).max(65535);

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Public origin the browser uses (magic links, invitation links, CSRF origin check).
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),

  DATABASE_URL: z.string().min(1).default(DEV_DATABASE_URL),

  S3_ENDPOINT: z.string().url().default("http://localhost:9000"),
  // Endpoint the *browser* reaches for presigned uploads/downloads.
  S3_PUBLIC_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().min(1).default("us-east-1"),
  S3_ACCESS_KEY_ID: z.string().min(1).default("oportfolio"),
  S3_SECRET_ACCESS_KEY: z.string().min(1).default("oportfolio_dev"),
  S3_BUCKET_QUARANTINE: z.string().min(1).default("oportfolio-quarantine"),
  S3_BUCKET_CLEAN: z.string().min(1).default("oportfolio-clean"),
  S3_BUCKET_EXPORT: z.string().min(1).default("oportfolio-exports"),

  CLAMD_HOST: z.string().min(1).default("localhost"),
  CLAMD_PORT: port.default(3310),

  SMTP_HOST: z.string().min(1).default("localhost"),
  SMTP_PORT: port.default(1025),
  SMTP_FROM: z.string().min(1).default("oPortfolio <no-reply@oportfolio.local>"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  // Implicit TLS (usually port 465). When false, STARTTLS is used and — in
  // production — required, so credentials and links never travel in clear.
  SMTP_SECURE: bool.default(false),
  SMTP_REQUIRE_TLS: bool.optional(),

  // Number of trusted reverse proxies in front of the app. The client IP used
  // for auth rate limiting is taken from X-Forwarded-For at that depth; 0 means
  // the header is ignored (direct exposure, or an unknown proxy chain).
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).max(10).optional(),

  // Published at /.well-known/security.txt (RFC 9116) when set.
  SECURITY_CONTACT: z.string().optional(),
  SECURITY_POLICY_URL: z.string().url().optional(),

  // Guard rails for synthetic fixtures.
  ALLOW_SEED: bool.default(false),
});

export type Env = z.infer<typeof schema> & {
  isProduction: boolean;
  s3PublicEndpoint: string;
  smtpRequireTls: boolean;
  trustedProxyHops: number;
};

function productionChecks(env: z.infer<typeof schema>): string[] {
  const problems: string[] = [];
  const provided = (key: keyof typeof env) => process.env[key] !== undefined && process.env[key] !== "";

  for (const key of [
    "APP_BASE_URL",
    "DATABASE_URL",
    "S3_ENDPOINT",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
    "SMTP_HOST",
    "SMTP_FROM",
  ] as const) {
    if (!provided(key)) problems.push(`${key} must be set in production`);
  }

  if (!env.APP_BASE_URL.startsWith("https://")) {
    problems.push("APP_BASE_URL must be an https:// origin in production (secure cookies, HSTS)");
  }
  const publicS3 = env.S3_PUBLIC_ENDPOINT ?? env.S3_ENDPOINT;
  if (!publicS3.startsWith("https://")) {
    problems.push("S3_PUBLIC_ENDPOINT (or S3_ENDPOINT) must be https:// in production — browsers upload directly to it");
  }
  if (env.DATABASE_URL === DEV_DATABASE_URL || /oportfolio_dev/.test(env.DATABASE_URL)) {
    problems.push("DATABASE_URL uses the docker-compose development password");
  }
  if (DEV_SECRETS.has(env.S3_ACCESS_KEY_ID) || DEV_SECRETS.has(env.S3_SECRET_ACCESS_KEY)) {
    problems.push("S3 credentials are the docker-compose development credentials");
  }
  if (/oportfolio\.local/.test(env.SMTP_FROM)) {
    problems.push("SMTP_FROM is the development placeholder address");
  }
  if (env.ALLOW_SEED) {
    problems.push("ALLOW_SEED must not be enabled in production");
  }
  return problems;
}

let cached: Env | undefined;

export function getEnv(): Env {
  if (cached) return cached;

  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n  - ${issues.join("\n  - ")}`);
  }
  const env = parsed.data;
  const isProduction = env.NODE_ENV === "production";

  // `next build` runs with NODE_ENV=production while collecting page data;
  // that is not a deployment, so the deployment checks are deferred to the
  // real server start (src/instrumentation.ts) and the worker.
  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

  if (isProduction && !isBuildPhase) {
    const problems = productionChecks(env);
    if (problems.length > 0) {
      throw new Error(
        `Refusing to start with an unsafe production configuration:\n  - ${problems.join("\n  - ")}\n` +
          "See docs/deployment.md for the required variables.",
      );
    }
  }

  cached = {
    ...env,
    isProduction,
    s3PublicEndpoint: env.S3_PUBLIC_ENDPOINT ?? env.S3_ENDPOINT,
    smtpRequireTls: env.SMTP_REQUIRE_TLS ?? isProduction,
    trustedProxyHops: env.TRUSTED_PROXY_HOPS ?? (isProduction ? 1 : 0),
  };
  return cached;
}

// Test hook: forget the memoised configuration.
export function resetEnvForTests(): void {
  cached = undefined;
}
