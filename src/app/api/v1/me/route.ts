import { NextResponse } from "next/server";
import { getDb } from "@/server/db/client";
import { tenant } from "@/server/db/schema";
import { inArray } from "drizzle-orm";
import { withApi } from "@/server/http/withApi";

export const GET = withApi({}, async ({ actor }) => {
  const tenantIds = [...new Set(actor.memberships.map((m) => m.tenantId))];
  const tenants = tenantIds.length
    ? await getDb()
        .select({ id: tenant.id, slug: tenant.slug, name: tenant.name })
        .from(tenant)
        .where(inArray(tenant.id, tenantIds))
    : [];
  return NextResponse.json({
    userId: actor.userId,
    displayName: actor.displayName,
    memberships: actor.memberships.map((m) => ({
      tenantId: m.tenantId,
      role: m.role,
      tenantSlug: tenants.find((t) => t.id === m.tenantId)?.slug ?? null,
      tenantName: tenants.find((t) => t.id === m.tenantId)?.name ?? null,
    })),
  });
});
