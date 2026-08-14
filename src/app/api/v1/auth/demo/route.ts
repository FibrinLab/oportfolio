import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { appUser, membership } from "@/server/db/schema";
import { sql } from "drizzle-orm";
import { appendAudit } from "@/server/audit/audit";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/server/identity/sessions";
import { notFoundProblem, problem } from "@/server/http/problem";
import { withApi } from "@/server/http/withApi";

// Demo-mode quick sign-in: skips the magic-link round trip for the seeded
// synthetic accounts, using the REAL session machinery — authorization is
// untouched. Hard-gated: the route is a uniform 404 unless DEMO_LOGIN=true,
// and only fixture addresses (@example.org) are ever accepted. Never enable
// in any environment holding real accounts.

const bodySchema = z.object({ email: z.string().email().max(320) });

export const POST = withApi({ bodySchema, public: true }, async ({ body, requestId }) => {
  if (process.env.DEMO_LOGIN !== "true") {
    return notFoundProblem(requestId);
  }
  const email = body.email.trim().toLowerCase();
  if (!email.endsWith("@example.org")) {
    return notFoundProblem(requestId);
  }

  const db = getDb();
  const users = await db
    .select({
      id: appUser.id,
      status: appUser.status,
      permissionsVersion: appUser.permissionsVersion,
    })
    .from(appUser)
    .where(eq(appUser.emailNormalised, email))
    .limit(1);
  const user = users[0];
  if (!user || user.status !== "active") {
    return problem("validation-failed", requestId, {
      detail:
        "This demo account does not exist yet. Run `pnpm seed` (and accept the fellow invitation once) first.",
    });
  }

  const sessionToken = await db.transaction(async (tx) => {
    const { token } = await createSession(tx, user.id, user.permissionsVersion);
    await tx.update(appUser).set({ lastLoginAt: new Date() }).where(eq(appUser.id, user.id));
    const tenants = await tx
      .selectDistinct({ tenantId: membership.tenantId })
      .from(membership)
      .where(sql`${membership.userId} = ${user.id} AND ${membership.status} = 'active'`);
    for (const row of tenants) {
      await appendAudit(tx, {
        tenantId: row.tenantId,
        actorUserId: user.id,
        action: "auth.sign_in",
        targetType: "app_user",
        targetId: user.id,
        requestId,
        sourceContext: "demo_login",
      });
    }
    return token;
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOptions());
  return response;
});
