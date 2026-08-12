import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/server/db/client";
import { revokeSession, SESSION_COOKIE } from "@/server/identity/sessions";
import { withApi } from "@/server/http/withApi";

export const POST = withApi({ public: true }, async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await revokeSession(getDb(), token);
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { ...{ path: "/" }, maxAge: 0 });
  return response;
});
