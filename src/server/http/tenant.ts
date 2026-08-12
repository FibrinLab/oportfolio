import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { tenant } from "@/server/db/schema";
import type { Actor } from "@/server/policy/actor";

// API requests carry the tenant slug in the x-tenant header (set by the app's
// fetch helper) or ?tenant= for direct calls. The tenant must intersect the
// actor's memberships; anything else resolves to null and the caller returns
// the uniform 404.

export async function resolveTenantForApi(
  actor: Actor,
  request: NextRequest,
): Promise<string | null> {
  const slug =
    request.headers.get("x-tenant") ?? request.nextUrl.searchParams.get("tenant");
  if (slug) {
    const rows = await getDb()
      .select({ id: tenant.id, status: tenant.status })
      .from(tenant)
      .where(eq(tenant.slug, slug))
      .limit(1);
    const row = rows[0];
    if (!row || row.status !== "active") return null;
    return actor.memberships.some((m) => m.tenantId === row.id) ? row.id : null;
  }
  // No slug: unambiguous only when the actor belongs to exactly one tenant.
  const tenantIds = [...new Set(actor.memberships.map((m) => m.tenantId))];
  return tenantIds.length === 1 ? tenantIds[0]! : null;
}
