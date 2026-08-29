import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";

// Liveness/readiness probe for the orchestrator and load balancer
// (spec/13: health checks). Unauthenticated by design; reveals nothing
// beyond "the app can reach its database". Never cached.

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return NextResponse.json(
      { status: "ok" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "degraded" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
