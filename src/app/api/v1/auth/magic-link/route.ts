import { NextResponse } from "next/server";
import { magicLinkRequest } from "@/server/http/apiSchemas";
import { getDb } from "@/server/db/client";
import { requestMagicLink } from "@/server/identity/magicLink";
import { withApi } from "@/server/http/withApi";

// Always the same response whether or not the address is registered —
// no account enumeration (spec/12).
export const POST = withApi({ bodySchema: magicLinkRequest, public: true }, async ({ request, body }) => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const requestIp = forwardedFor?.split(",")[0]?.trim() ?? null;
  await requestMagicLink(getDb(), body.email, requestIp);
  return NextResponse.json({ ok: true });
});
