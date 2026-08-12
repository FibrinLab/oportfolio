import { and, eq, isNull, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/server/db/client";
import { membership, supervisorAssignment, tenant } from "@/server/db/schema";
import { SESSION_COOKIE, sessionCookieOptions, validateSession } from "@/server/identity/sessions";

// The Actor is everything authorization needs, loaded once per request:
// session identity + active dated memberships + active supervisor
// assignments. Policy functions are pure over this data (spec/12).

export interface ActorMembership {
  tenantId: string;
  role: "fellow" | "supervisor" | "faculty" | "tenant_admin";
  scopeType: "tenant" | "programme" | "cohort" | "enrolment";
  scopeId: string | null;
}

export interface ActorAssignment {
  tenantId: string;
  enrolmentId: string;
  assignmentType: "primary" | "co_supervisor";
  canSign: boolean;
}

export interface Actor {
  userId: string;
  displayName: string;
  emailNormalised: string;
  memberships: ActorMembership[];
  assignments: ActorAssignment[];
}

export async function getActor(): Promise<Actor | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = getDb();
  const session = await validateSession(db, token);
  if (!session) return null;

  // Transparent rotation after a permissions change: set the fresh cookie.
  // (In Server Components, cookie writes are unavailable — the rotated token
  // still replaces the old one on the next mutation/route-handler request.)
  if (session.rotatedToken) {
    try {
      cookieStore.set(SESSION_COOKIE, session.rotatedToken, sessionCookieOptions());
    } catch {
      // Read-only context (RSC render); rotation already revoked the old
      // session server-side, so the next request re-authenticates.
    }
  }

  const now = new Date();
  const memberships = await db
    .select({
      tenantId: membership.tenantId,
      role: membership.role,
      scopeType: membership.scopeType,
      scopeId: membership.scopeId,
    })
    .from(membership)
    .where(
      and(
        eq(membership.userId, session.userId),
        eq(membership.status, "active"),
        sql`${membership.startsAt} <= ${now}`,
        sql`(${membership.endsAt} IS NULL OR ${membership.endsAt} > ${now})`,
      ),
    );

  if (memberships.length === 0) {
    return {
      userId: session.userId,
      displayName: session.displayName,
      emailNormalised: session.emailNormalised,
      memberships: [],
      assignments: [],
    };
  }

  const assignments = await db
    .select({
      tenantId: supervisorAssignment.tenantId,
      enrolmentId: supervisorAssignment.enrolmentId,
      assignmentType: supervisorAssignment.assignmentType,
      canSign: supervisorAssignment.canSign,
    })
    .from(supervisorAssignment)
    .where(
      and(
        eq(supervisorAssignment.supervisorUserId, session.userId),
        sql`${supervisorAssignment.startsAt} <= ${now}`,
        isNull(supervisorAssignment.endsAt),
      ),
    );

  return {
    userId: session.userId,
    displayName: session.displayName,
    emailNormalised: session.emailNormalised,
    memberships,
    assignments,
  };
}

// Resolve the active tenant from the route slug — it must intersect the
// actor's memberships, else the caller renders the uniform 404 (no
// existence oracle).
export async function resolveTenant(
  actor: Actor,
  tenantSlug: string,
): Promise<{ tenantId: string; tenantName: string } | null> {
  const db = getDb();
  const rows = await db
    .select({ id: tenant.id, name: tenant.name, status: tenant.status })
    .from(tenant)
    .where(eq(tenant.slug, tenantSlug))
    .limit(1);
  const row = rows[0];
  if (!row || row.status !== "active") return null;
  const isMember = actor.memberships.some((m) => m.tenantId === row.id);
  if (!isMember) return null;
  return { tenantId: row.id, tenantName: row.name };
}
