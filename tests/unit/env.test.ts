import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getEnv, resetEnvForTests } from "@/server/config/env";

// Production configuration guard rails (spec/12: no development credentials
// or bypasses in a live deployment). The checks run at process start.

const ORIGINAL = { ...process.env };

function setEnv(values: Record<string, string | undefined>) {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL)) delete process.env[key];
  }
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

const PRODUCTION_OK: Record<string, string> = {
  NODE_ENV: "production",
  APP_BASE_URL: "https://diary.example.nhs.uk",
  DATABASE_URL: "postgres://app:s3cret-strong@db.internal:5432/oportfolio?sslmode=verify-full",
  S3_ENDPOINT: "https://s3.eu-west-2.amazonaws.com",
  S3_ACCESS_KEY_ID: "AKIAEXAMPLE",
  S3_SECRET_ACCESS_KEY: "example-secret-key",
  SMTP_HOST: "smtp.example.nhs.uk",
  SMTP_FROM: "oPortfolio <no-reply@example.nhs.uk>",
};

describe("environment validation", () => {
  beforeEach(() => resetEnvForTests());
  afterEach(() => {
    setEnv({});
    for (const [key, value] of Object.entries(ORIGINAL)) process.env[key] = value;
    resetEnvForTests();
  });

  it("fills development defaults when nothing is configured", () => {
    setEnv({
      NODE_ENV: "development",
      DATABASE_URL: undefined,
      APP_BASE_URL: undefined,
      S3_ENDPOINT: undefined,
      SMTP_HOST: undefined,
    });
    const env = getEnv();
    expect(env.isProduction).toBe(false);
    expect(env.DATABASE_URL).toContain("localhost:5432");
    expect(env.trustedProxyHops).toBe(0);
    expect(env.smtpRequireTls).toBe(false);
  });

  it("accepts a complete production configuration with hardened defaults", () => {
    setEnv(PRODUCTION_OK);
    const env = getEnv();
    expect(env.isProduction).toBe(true);
    expect(env.trustedProxyHops).toBe(1);
    expect(env.smtpRequireTls).toBe(true);
    expect(env.s3PublicEndpoint).toBe(PRODUCTION_OK.S3_ENDPOINT);
  });

  it("refuses development credentials in production", () => {
    setEnv({ ...PRODUCTION_OK, DATABASE_URL: "postgres://oportfolio:oportfolio_dev@db:5432/oportfolio" });
    expect(() => getEnv()).toThrow(/development password/);

    resetEnvForTests();
    setEnv({ ...PRODUCTION_OK, S3_SECRET_ACCESS_KEY: "oportfolio_dev" });
    expect(() => getEnv()).toThrow(/development credentials/);
  });

  it("requires https origins in production", () => {
    setEnv({ ...PRODUCTION_OK, APP_BASE_URL: "http://diary.example.nhs.uk" });
    expect(() => getEnv()).toThrow(/https/);

    resetEnvForTests();
    setEnv({ ...PRODUCTION_OK, S3_ENDPOINT: "http://minio:9000" });
    expect(() => getEnv()).toThrow(/S3_PUBLIC_ENDPOINT/);
  });

  it("lists every missing required value at once", () => {
    setEnv({ NODE_ENV: "production", APP_BASE_URL: undefined, DATABASE_URL: undefined, SMTP_HOST: undefined });
    expect(() => getEnv()).toThrow(/APP_BASE_URL must be set[\s\S]*DATABASE_URL must be set[\s\S]*SMTP_HOST must be set/);
  });

  it("never allows synthetic seeding in production", () => {
    setEnv({ ...PRODUCTION_OK, ALLOW_SEED: "1" });
    expect(() => getEnv()).toThrow(/ALLOW_SEED/);
  });
});
