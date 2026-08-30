import { after, NextResponse } from "next/server";
import { magicLinkRequest } from "@/server/http/apiSchemas";
import { getDb } from "@/server/db/client";
import { requestMagicLink } from "@/server/identity/magicLink";
import { clientIpFrom, withApi } from "@/server/http/withApi";
import { processEmailOutboxBatch } from "@/worker/emailProcessor";

// New and existing addresses get the same response. Account creation happens
// only after the address holder verifies the single-use link.
export const POST = withApi({ bodySchema: magicLinkRequest, public: true }, async ({ request, body }) => {
  await requestMagicLink(getDb(), body.email, clientIpFrom(request));
  after(async () => {
    try {
      await processEmailOutboxBatch(10);
    } catch (error) {
      console.error("[outbox] post-response processing failed", error);
    }
  });
  return NextResponse.json({ ok: true });
});
