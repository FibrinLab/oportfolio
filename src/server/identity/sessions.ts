import { and, eq, isNull, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import type { Db } from "@/server/db/client";
import { appUser, authSession } from "@/server/db/schema";
import { generateToken, hashToken } from "./tokens";

// Secure sessions (spec/12): idle + absolute timeouts enforced server-side,
// session rotated after auth and after any role/permission change.

export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-session" : "session";
export const SESSION_IDLE_MINUTES = 60;
export const SESSION_ABSOLUTE_HOURS = 12;

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_ABSOLUTE_HOURS * 60 * 60,
  };
}

export async function createSession(
  tx: Db,
  userId: string,
  permissionsVersion: number,
): Promise<{ token: string; sessionId: string }> {
  const { token, tokenHash } = generateToken();
  const sessionId = uuidv7();
  const absoluteExpiresAt = new Date(Date.now() + SESSION_ABSOLUTE_HOURS * 60 * 60 * 1000);
  await tx.insert(authSession).values({
    id: sessionId,
    tokenHash,
    userId,
    permissionsVersion,
    absoluteExpiresAt,
  });
  return { token, sessionId };
}

export interface ValidSession {
  sessionId: string;
  userId: string;
  userStatus: "active" | "suspended";
  displayName: string;
  emailNormalised: string;
  // Set when the session was transparently rotated (permissions changed);
  // the caller must set the new cookie.
  rotatedToken?: string;
}

export async function validateSession(db: Db, token: string): Promise<ValidSession | null> {
  const tokenHash = hashToken(token);
  const rows = await db
    .select({
      sessionId: authSession.id,
      lastSeenAt: authSession.lastSeenAt,
      absoluteExpiresAt: authSession.absoluteExpiresAt,
      sessionPermissionsVersion: authSession.permissionsVersion,
      userId: appUser.id,
      userStatus: appUser.status,
      displayName: appUser.displayName,
      emailNormalised: appUser.emailNormalised,
      userPermissionsVersion: appUser.permissionsVersion,
    })
    .from(authSession)
    .innerJoin(appUser, eq(authSession.userId, appUser.id))
    .where(and(eq(authSession.tokenHash, tokenHash), isNull(authSession.revokedAt)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const now = Date.now();
  const idleDeadline = row.lastSeenAt.getTime() + SESSION_IDLE_MINUTES * 60 * 1000;
  if (now > idleDeadline || now > row.absoluteExpiresAt.getTime()) {
    await db
      .update(authSession)
      .set({ revokedAt: new Date() })
      .where(eq(authSession.id, row.sessionId));
    return null;
  }

  // Suspension blocks access without deleting authorship (FR-ID-005).
  if (row.userStatus === "suspended") return null;

  const base: ValidSession = {
    sessionId: row.sessionId,
    userId: row.userId,
    userStatus: row.userStatus,
    displayName: row.displayName,
    emailNormalised: row.emailNormalised,
  };

  // Permissions changed since this session was issued: rotate the session so
  // stale grants cannot outlive a role change (NFR-S-005, spec/12).
  if (row.sessionPermissionsVersion !== row.userPermissionsVersion) {
    const rotated = await db.transaction(async (tx) => {
      await tx
        .update(authSession)
        .set({ revokedAt: new Date() })
        .where(eq(authSession.id, row.sessionId));
      return createSession(tx, row.userId, row.userPermissionsVersion);
    });
    return { ...base, sessionId: rotated.sessionId, rotatedToken: rotated.token };
  }

  // Sliding idle window; throttle writes to once a minute.
  if (now - row.lastSeenAt.getTime() > 60 * 1000) {
    await db
      .update(authSession)
      .set({ lastSeenAt: new Date() })
      .where(eq(authSession.id, row.sessionId));
  }

  return base;
}

export async function revokeSession(db: Db, token: string): Promise<void> {
  await db
    .update(authSession)
    .set({ revokedAt: new Date() })
    .where(eq(authSession.tokenHash, hashToken(token)));
}

export async function revokeAllSessionsForUser(tx: Db, userId: string): Promise<void> {
  await tx
    .update(authSession)
    .set({ revokedAt: new Date() })
    .where(and(eq(authSession.userId, userId), isNull(authSession.revokedAt)));
}

// Bump on any membership/role change so existing sessions rotate and reload
// permissions on their next request.
export async function bumpPermissionsVersion(tx: Db, userId: string): Promise<void> {
  await tx
    .update(appUser)
    .set({ permissionsVersion: sql`${appUser.permissionsVersion} + 1` })
    .where(eq(appUser.id, userId));
}
