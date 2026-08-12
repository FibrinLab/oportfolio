import { NextRequest, NextResponse } from "next/server";

// Security headers + CSP nonce. No database work at the edge — sessions and
// authorization are enforced server-side in getActor()/withApi (spec/12).

export function middleware(request: NextRequest) {
  const nonceBytes = new Uint8Array(16);
  crypto.getRandomValues(nonceBytes);
  const nonce = btoa(String.fromCharCode(...nonceBytes));

  const isDev = process.env.NODE_ENV !== "production";
  const s3PublicEndpoint = process.env.S3_PUBLIC_ENDPOINT ?? "http://localhost:9000";

  const csp = [
    `default-src 'self'`,
    // strict-dynamic + nonce lets Next's runtime load its chunks; dev needs eval.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // style-src unsafe-inline: styles only, scripts stay strict (ADR-006 risk note).
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data:`,
    `font-src 'self'`,
    // Browser uploads go directly to the quarantine bucket via presigned POST.
    `connect-src 'self' ${s3PublicEndpoint}`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  );
  if (!isDev) {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  }
  return response;
}

export const config = {
  matcher: [
    // Everything except static assets.
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
