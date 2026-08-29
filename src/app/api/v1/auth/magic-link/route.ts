import { NextResponse } from "next/server";
import { magicLinkRequest } from "@/server/http/apiSchemas";
import { getDb } from "@/server/db/client";
import { requestMagicLink } from "@/server/identity/magicLink";
import { clientIpFrom, withApi } from "@/server/http/withApi";

// New and existing addresses get the same response. Account creation happens
// only after the address holder verifies the single-use link.
export const POST = withApi({ bodySchema: magicLinkRequest, public: true }, async ({ request, body }) => {
  await requestMagicLink(getDb(), body.email, clientIpFrom(request));
  return NextResponse.json({ ok: true });
});
