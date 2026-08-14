import { readdirSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { buildFixtures, type Fixtures, type PersonaId } from "./fixtures";
import { ALL_PERSONAS, SURFACES } from "./registry";

// Generated authorization matrix (spec/15:156-173): every surface × every
// persona. Denials on object reads must be indistinguishable from not-found;
// unauthenticated/suspended sessions get 401 on APIs and a redirect on pages.
// Requires the app running at APP_BASE_URL and a seeded database.

const BASE_URL = process.env.APP_BASE_URL ?? "http://localhost:3000";

let fixtures: Fixtures;

beforeAll(async () => {
  fixtures = await buildFixtures();
});

async function call(
  surface: (typeof SURFACES)[number],
  persona: PersonaId,
): Promise<{ status: number; bodyText: string; redirected: string | null }> {
  const headers: Record<string, string> = {
    Origin: BASE_URL,
    "x-tenant": fixtures.tenantASlug,
  };
  const cookie = fixtures.cookies[persona];
  if (cookie) {
    headers.Cookie = `session=${cookie}`;
  }
  let body: string | undefined;
  if (surface.body) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(surface.body(fixtures));
  }
  const response = await fetch(`${BASE_URL}${surface.path(fixtures)}`, {
    method: surface.method,
    headers,
    body,
    redirect: "manual",
  });
  return {
    status: response.status,
    bodyText: await response.text(),
    redirected: response.headers.get("location"),
  };
}

describe("authorization matrix", () => {
  for (const surface of SURFACES) {
    if (surface.public) {
      it(`${surface.id}: public surface responds without a session`, async () => {
        const result = await call(surface, "unauth");
        // 404 covers env-gated public surfaces (demo sign-in) when disabled.
        expect([200, 307, 308, 404, 422].includes(result.status)).toBe(true);
      });
      continue;
    }

    for (const persona of ALL_PERSONAS) {
      const isAllowed = surface.allowed.includes(persona);
      it(`${surface.id} × ${persona} → ${isAllowed ? "allow" : "deny"}`, async () => {
        const result = await call(surface, persona);

        if (isAllowed) {
          const expected = surface.allowStatus ?? 200;
          expect(result.status).toBe(expected);
          return;
        }

        if (persona === "unauth" || persona === "suspended") {
          // No valid session: APIs answer 401; pages redirect to sign-in.
          if (surface.kind === "api") {
            expect(result.status).toBe(401);
          } else {
            expect([303, 307, 308]).toContain(result.status);
            expect(result.redirected ?? "").toContain("/sign-in");
          }
          return;
        }

        // Authenticated but not permitted: the uniform not-found. Object
        // existence must not leak through the response body either.
        expect(result.status).toBe(404);
        expect(result.bodyText).not.toContain("AUTHZ-PRIVATE-CANARY");
        expect(result.bodyText).not.toContain("AUTHZ-SHARED-SUP");
      });
    }
  }

  it("prior supervisor's fellows list contains no assigned fellows", async () => {
    const result = await call(
      SURFACES.find((s) => s.id === "page.supervisor.fellows")!,
      "priorSupervisor",
    );
    expect(result.status).toBe(200);
    expect(result.bodyText).toContain("no current supervision assignments");
  });

  it("supervisor list responses never include the private canary", async () => {
    const surface = SURFACES.find((s) => s.id === "evidence.list")!;
    for (const persona of ["assignedSupervisor", "facultyTenant"] as PersonaId[]) {
      const result = await call(surface, persona);
      expect(result.status).toBe(200);
      expect(result.bodyText).not.toContain("AUTHZ-PRIVATE-CANARY");
    }
  });
});

describe("registry completeness", () => {
  function walk(dir: string, matcher: (file: string) => boolean): string[] {
    const results: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...walk(full, matcher));
      } else if (matcher(entry.name)) {
        results.push(path.relative(process.cwd(), full));
      }
    }
    return results;
  }

  it("every API route and page is present in the authorization registry", () => {
    const routeFiles = [
      ...walk(path.join(process.cwd(), "src/app/api"), (f) => f === "route.ts"),
      ...walk(path.join(process.cwd(), "src/app"), (f) => f === "page.tsx"),
    ];
    const registered = new Set(SURFACES.map((s) => s.routeFile));
    const missing = routeFiles.filter((file) => !registered.has(file));
    expect(missing, `Add these surfaces to tests/authz/registry.ts: ${missing.join(", ")}`).toEqual(
      [],
    );
  });
});
