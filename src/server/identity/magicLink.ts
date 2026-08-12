import { eq, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import type { Db } from "@/server/db/client";
import { appUser, magicLinkToken, membership } from "@/server/db/schema";
import { appendAudit } from "@/server/audit/audit";
import { enqueue } from "@/server/outbox/outbox";
import { checkRateLimit } from "./rateLimit";
import { createSession } from "./sessions";
import { generateToken, hashToken, normaliseEmail } from "./tokens";

export const MAGIC_LINK_EXPIRY_MINUTES = 15;

// Uniform behavior regardless of whether the address is registered — the
// caller always responds "if that address is registered…" (no enumeration).
export async function requestMagicLink(
  db: Db,
  rawEmail: string,
  requestIp: string | null,
): Promise<void> {
  const email = normaliseEmail(rawEmail);

  const emailAllowed = await checkRateLimit(db, `magic:email:${email}`, 5, 60);
  const ipAllowed = requestIp
    ? await checkRateLimit(db, `magic:ip:${requestIp}`, 20, 60)
    : true;
  if (!emailAllowed || !ipAllowed) return;

  const users = await db
    .select({ id: appUser.id, status: appUser.status })
    .from(appUser)
    .where(eq(appUser.emailNormalised, email))
    .limit(1);
  const user = users[0];
  if (!user || user.status !== "active") return;

  const { token, tokenHash } = generateToken();
  await db.transaction(async (tx) => {
    await tx.insert(magicLinkToken).values({
      id: uuidv7(),
      emailNormalised: email,
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + MAGIC_LINK_EXPIRY_MINUTES * 60 * 1000),
    });
    const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
    await enqueue(tx, "send_email", {
      to: email,
      template: "magic_link",
      variables: {
        // Neutral content only: a login link, no portfolio data (spec/07).
        verifyUrl: `${baseUrl}/auth/verify?token=${token}`,
        expiryMinutes: String(MAGIC_LINK_EXPIRY_MINUTES),
      },
    });
  });
}

export interface SignInResult {
  sessionToken: string;
  userId: string;
}

export async function consumeMagicLink(
  db: Db,
  token: string,
  requestId: string | null,
): Promise<SignInResult | null> {
  const tokenHash = hashToken(token);
  return db.transaction(async (tx) => {
    // Atomic single-use claim.
    const claimed = await tx.execute(sql`
      UPDATE magic_link_token SET used_at = now()
      WHERE token_hash = ${tokenHash} AND used_at IS NULL AND expires_at > now()
      RETURNING user_id
    `);
    const userId = claimed.rows[0]?.user_id as string | undefined;
    if (!userId) return null;

    const users = await tx
      .select({
        id: appUser.id,
        status: appUser.status,
        permissionsVersion: appUser.permissionsVersion,
      })
      .from(appUser)
      .where(eq(appUser.id, userId))
      .limit(1);
    const user = users[0];
    if (!user || user.status !== "active") return null;

    const { token: sessionToken } = await createSession(tx, user.id, user.permissionsVersion);
    await tx.update(appUser).set({ lastLoginAt: new Date() }).where(eq(appUser.id, user.id));

    // Sign-in is audited against every tenant the user actively belongs to.
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
      });
    }

    return { sessionToken, userId: user.id };
  });
}
