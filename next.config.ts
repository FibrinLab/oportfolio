import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Self-contained server bundle for the container image (Dockerfile).
  output: "standalone",
  // node-postgres selects pg-cloudflare through its `workerd` conditional
  // export. Next's file tracer otherwise copies only the package manifest,
  // leaving OpenNext unable to resolve the Worker implementation.
  // https://github.com/opennextjs/opennextjs-cloudflare/issues/1214
  outputFileTracingIncludes: {
    "**/*": [
      "./node_modules/pg-cloudflare/dist/**",
      "./node_modules/pg-cloudflare/esm/**",
    ],
  },
  // Native/asset-heavy server packages are loaded from node_modules at runtime
  // rather than bundled: pdfkit ships AFM font metrics it reads from disk.
  serverExternalPackages: ["pdfkit", "archiver", "pg"],
};

export default nextConfig;
