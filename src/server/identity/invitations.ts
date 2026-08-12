import { eq, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import type { Db } from "@/server/db/client";
import {
  appUser,
  enrolment,
  invitation,
  membership,
  noticeAcknowledgement,
  profile,
} from "@/server/db/schema";
import { appendAudit } from "@/server/audit/audit";
import { enqueue } from "@/server/outbox/outbox";
import { createSession } from "./sessions";
import { generateToken, hashToken, normaliseEmail } from "./tokens";

export const INVITATION_EXPIRY_DAYS = 7;

export interface CreateInvitationInput {
  tenantId: string;
  email: string;
  displayName: string;
  role: "fellow" | "supervisor" | "faculty" | "tenant_admin";
  enrolmentId?: string | null;
  createdBy: string | null;
  requestId?: string | null;
}

export async function createInvitation(
  tx: Db,
  input: CreateInvitationInput,
): Promise<{ invitationId: string; token: string }> {
  const { token, tokenHash } = generateToken();
  const invitationId = uuidv7();
  const email = normaliseEmail(input.email);
  await tx.insert(invitation).values({
    id: invitationId,
    tenantId: input.tenantId,
    emailNormalised: email,
    invitedDisplayName: input.displayName,
    role: input.role,
    enrolmentId: input.enrolmentId ?? null,
    tokenHash,
    expiresAt: new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    createdBy: input.createdBy,
  });
  const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
  await enqueue(tx, "send_email", {
    to: email,
    template: "invitation",
    variables: {
      inviteUrl: `${baseUrl}/invite/${token}`,
      expiryDays: String(INVITATION_EXPIRY_DAYS),
    },
  });
  await appendAudit(tx, {
    tenantId: input.tenantId,
    actorUserId: input.createdBy,
    action: "invitation.created",
    targetType: "invitation",
    targetId: invitationId,
    enrolmentId: input.enrolmentId ?? null,
    requestId: input.requestId ?? null,
    metadata: { role: input.role },
  });
  return { invitationId, token };
}

export interface PendingInvitation {
  id: string;
  tenantId: string;
  emailNormalised: string;
  invitedDisplayName: string;
  role: "fellow" | "supervisor" | "faculty" | "tenant_admin";
  enrolmentId: string | null;
}

// Look up without consuming — the onboarding page shows programme context
// before the user accepts.
export async function findPendingInvitation(
  db: Db,
  token: string,
): Promise<PendingInvitation | null> {
  const rows = await db
    .select({
      id: invitation.id,
      tenantId: invitation.tenantId,
      emailNormalised: invitation.emailNormalised,
      invitedDisplayName: invitation.invitedDisplayName,
      role: invitation.role,
      enrolmentId: invitation.enrolmentId,
      expiresAt: invitation.expiresAt,
      acceptedAt: invitation.acceptedAt,
      revokedAt: invitation.revokedAt,
    })
    .from(invitation)
    .where(eq(invitation.tokenHash, hashToken(token)))
    .limit(1);
  const row = rows[0];
  if (!row || row.acceptedAt || row.revokedAt || row.expiresAt.getTime() < Date.now()) {
    return null;
  }
  return row;
}

export interface AcceptInvitationInput {
  token: string;
  preferredName: string;
  professionalGroup?: string;
  homeSpecialtyOrRole?: string;
  organisation?: string;
  acknowledgedNotices: Array<{ noticeType: string; noticeVersion: string }>;
  requestId?: string | null;
}

export interface AcceptResult {
  sessionToken: string;
  userId: string;
  tenantId: string;
}

export async function acceptInvitation(
  db: Db,
  input: AcceptInvitationInput,
): Promise<AcceptResult | null> {
  const tokenHash = hashToken(input.token);
  return db.transaction(async (tx) => {
    // Atomic single-use claim.
    const claimed = await tx.execute(sql`
      UPDATE invitation SET accepted_at = now()
      WHERE token_hash = ${tokenHash}
        AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()
      RETURNING id, tenant_id, email_normalised, invited_display_name, role, enrolment_id
    `);
    const inv = claimed.rows[0];
    if (!inv) return null;
    const tenantId = inv.tenant_id as string;
    const role = inv.role as "fellow" | "supervisor" | "faculty" | "tenant_admin";
    const email = inv.email_normalised as string;
    const enrolmentId = inv.enrolment_id as string | null;

    // The account binds to the invited identity (spec/04 §1). Duplicate
    // invitations for an existing user attach a new membership instead of
    // creating another account.
    const existing = await tx
      .select({ id: appUser.id, permissionsVersion: appUser.permissionsVersion })
      .from(appUser)
      .where(eq(appUser.emailNormalised, email))
      .limit(1);
    let userId: string;
    let permissionsVersion: number;
    if (existing[0]) {
      userId = existing[0].id;
      permissionsVersion = existing[0].permissionsVersion;
    } else {
      userId = uuidv7();
      permissionsVersion = 1;
      await tx.insert(appUser).values({
        id: userId,
        identitySubject: `invited:${email}`,
        emailNormalised: email,
        displayName: input.preferredName || (inv.invited_display_name as string),
        lastLoginAt: new Date(),
      });
    }

    await tx.update(invitation).set({ acceptedUserId: userId }).where(eq(invitation.id, inv.id as string));

    await tx
      .insert(membership)
      .values({
        id: uuidv7(),
        tenantId,
        userId,
        role,
        grantedBy: null,
        grantReason: "invitation",
      })
      .onConflictDoNothing();

    // Existing sessions elsewhere must reload the new grant (NFR-S-005).
    if (existing[0]) {
      await tx
        .update(appUser)
        .set({ permissionsVersion: permissionsVersion + 1 })
        .where(eq(appUser.id, userId));
      permissionsVersion = permissionsVersion + 1;
    }

    await tx
      .insert(profile)
      .values({
        id: uuidv7(),
        tenantId,
        userId,
        preferredName: input.preferredName,
        professionalGroup: input.professionalGroup,
        homeSpecialtyOrRole: input.homeSpecialtyOrRole,
        organisation: input.organisation,
      })
      .onConflictDoNothing();

    for (const notice of input.acknowledgedNotices) {
      await tx.insert(noticeAcknowledgement).values({
        id: uuidv7(),
        tenantId,
        userId,
        noticeType: notice.noticeType,
        noticeVersion: notice.noticeVersion,
        context: "onboarding",
      });
    }

    // Activation makes the pinned curriculum available (spec/04 §1).
    if (role === "fellow" && enrolmentId) {
      await tx
        .update(enrolment)
        .set({ status: "active", fellowUserId: userId, updatedBy: userId })
        .where(eq(enrolment.id, enrolmentId));
    }

    const { token: sessionToken } = await createSession(tx, userId, permissionsVersion);

    await appendAudit(tx, {
      tenantId,
      actorUserId: userId,
      action: "invitation.accepted",
      targetType: "invitation",
      targetId: inv.id as string,
      enrolmentId,
      requestId: input.requestId ?? null,
      metadata: { role },
    });
    await appendAudit(tx, {
      tenantId,
      actorUserId: userId,
      action: "membership.granted",
      targetType: "membership",
      targetId: userId,
      requestId: input.requestId ?? null,
      metadata: { role, reason: "invitation" },
    });
    if (role === "fellow" && enrolmentId) {
      await appendAudit(tx, {
        tenantId,
        actorUserId: userId,
        action: "enrolment.activated",
        targetType: "enrolment",
        targetId: enrolmentId,
        enrolmentId,
        requestId: input.requestId ?? null,
      });
    }

    return { sessionToken, userId, tenantId };
  });
}
