import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { problem } from "./problem";

// Idempotency-Key on create/transition mutations (spec/07): the first request
// stores its response; retries with the same key replay it. A reused key with
// a different body is a conflict.

export async function withIdempotency(
  request: NextRequest,
  tenantId: string,
  requestId: string,
  execute: () => Promise<NextResponse>,
): Promise<NextResponse> {
  const key = request.headers.get("idempotency-key");
  if (!key) {
    // Optional for browser form flows; required by API convention for
    // integrations. Execute directly.
    return execute();
  }

  const db = getDb();
  const bodyText = await request
    .clone()
    .text()
    .catch(() => "");
  const requestHash = createHash("sha256").update(request.method).update(bodyText).digest("hex");

  const existing = await db.execute(sql`
    SELECT request_hash, response_status, response_body
    FROM idempotency_key WHERE tenant_id = ${tenantId} AND key = ${key}
  `);
  const row = existing.rows[0];
  if (row) {
    if (row.request_hash !== requestHash) {
      return problem("invalid-state", requestId, {
        detail: "Idempotency key was already used with a different request.",
      });
    }
    return NextResponse.json(row.response_body ?? {}, {
      status: (row.response_status as number | null) ?? 200,
      headers: { "Idempotency-Replayed": "true" },
    });
  }

  const response = await execute();

  // Only successful terminal responses are recorded for replay.
  if (response.status < 500) {
    const responseBody = await response
      .clone()
      .json()
      .catch(() => null);
    await db
      .execute(
        sql`
        INSERT INTO idempotency_key (tenant_id, key, request_hash, response_status, response_body)
        VALUES (${tenantId}, ${key}, ${requestHash}, ${response.status}, ${responseBody})
        ON CONFLICT (tenant_id, key) DO NOTHING
      `,
      )
      .catch(() => undefined);
  }
  return response;
}
