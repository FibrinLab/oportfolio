import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { requestMagicLink } from "@/server/identity/magicLink";
import { withApi } from "@/server/http/withApi";

const bodySchema = z.object({ email: z.string().email().max(320) });

// Always the same response whether or not the address is registered —
// no account enumeration (spec/12).
export const POST = withApi({ bodySchema, public: true }, async ({ request, body }) => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const requestIp = forwardedFor?.split(",")[0]?.trim() ?? null;
  await requestMagicLink(getDb(), body.email, requestIp);
  return NextResponse.json({ ok: true });
});
