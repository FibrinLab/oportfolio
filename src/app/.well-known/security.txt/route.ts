import { NextResponse } from "next/server";
import { getEnv } from "@/server/config/env";

// RFC 9116 vulnerability-disclosure contact, published only when the
// deploying organisation has configured one (SECURITY_CONTACT). A
// placeholder contact would be worse than none, so unset → 404.

export const dynamic = "force-dynamic";

export function GET() {
  const env = getEnv();
  if (!env.SECURITY_CONTACT) {
    return new NextResponse("Not found", { status: 404 });
  }
  const contact = env.SECURITY_CONTACT.includes(":")
    ? env.SECURITY_CONTACT
    : `mailto:${env.SECURITY_CONTACT}`;
  // Expires is required by the RFC; regenerate on every request so it never
  // goes stale (one year from now, per the RFC's recommendation).
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const lines = [
    `Contact: ${contact}`,
    `Expires: ${expires}`,
    `Canonical: ${env.APP_BASE_URL}/.well-known/security.txt`,
    `Preferred-Languages: en`,
    ...(env.SECURITY_POLICY_URL ? [`Policy: ${env.SECURITY_POLICY_URL}`] : []),
  ];
  return new NextResponse(lines.join("\n") + "\n", {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
