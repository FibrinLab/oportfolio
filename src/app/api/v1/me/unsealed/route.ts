import { NextResponse } from "next/server";
import { listUnsealedForActor } from "@/server/diary/sealing";
import { withApi } from "@/server/http/withApi";

// Inventory of the caller's own plaintext items so the browser can seal them
// after the first unlock (ADR-007 migration). Owner-only by construction.
export const GET = withApi({}, async ({ actor }) => {
  const inventory = await listUnsealedForActor(actor);
  return NextResponse.json(inventory, { headers: { "Cache-Control": "no-store" } });
});
