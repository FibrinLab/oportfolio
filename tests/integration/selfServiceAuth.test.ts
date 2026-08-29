import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { uuidv7 } from "uuidv7";
import { getDb } from "@/server/db/client";
import { appUser, magicLinkToken } from "@/server/db/schema";
import { consumeMagicLink } from "@/server/identity/magicLink";
import { hashToken } from "@/server/identity/tokens";

const db = getDb();

describe("self-service passwordless authentication", () => {
  it("creates one isolated personal diary only after the email link is consumed", async () => {
    const suffix = uuidv7();
    const email = `self-service-${suffix}@test.example.org`;
    const token = `test-token-${suffix}`;

    await db.insert(magicLinkToken).values({
      id: uuidv7(),
      emailNormalised: email,
      userId: null,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 60_000),
    });

    expect(
      await db.select({ id: appUser.id }).from(appUser).where(eq(appUser.emailNormalised, email)),
    ).toHaveLength(0);

    const signedIn = await consumeMagicLink(db, token, "self-service-integration-test");
    expect(signedIn?.sessionToken).toBeTruthy();

    const result = await db.execute(sql`
      SELECT
        u.display_name,
        t.name AS tenant_name,
        t.slug AS tenant_slug,
        m.role,
        m.grant_reason,
        p.name AS programme_name,
        c.name AS cohort_name,
        e.status AS enrolment_status,
        e.framework_release_id,
        e.diary_state,
        pr.preferred_name,
        (SELECT count(*)::int FROM membership mx WHERE mx.user_id = u.id AND mx.status = 'active') AS membership_count,
        (SELECT count(*)::int FROM audit_event ax WHERE ax.tenant_id = t.id AND ax.action = 'auth.sign_up') AS signup_audits
      FROM app_user u
      JOIN membership m ON m.user_id = u.id AND m.status = 'active'
      JOIN tenant t ON t.id = m.tenant_id
      JOIN profile pr ON pr.user_id = u.id AND pr.tenant_id = t.id
      JOIN enrolment e ON e.fellow_user_id = u.id AND e.tenant_id = t.id
      JOIN cohort c ON c.id = e.cohort_id
      JOIN programme p ON p.id = c.programme_id
      WHERE u.email_normalised = ${email}
    `);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      tenant_name: "My diary",
      role: "fellow",
      grant_reason: "self_signup",
      programme_name: "Personal diary",
      cohort_name: "Personal log",
      enrolment_status: "active",
      framework_release_id: null,
      diary_state: "open",
      membership_count: 1,
      signup_audits: 1,
    });
    expect(result.rows[0]?.tenant_slug).toBe(`diary-${signedIn?.userId}`);

    // The link is single-use and cannot create another workspace.
    expect(await consumeMagicLink(db, token, "self-service-integration-test-replay")).toBeNull();
  });
});
