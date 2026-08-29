import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Self-contained server bundle for the container image (Dockerfile).
  output: "standalone",
  // Native/asset-heavy server packages are loaded from node_modules at runtime
  // rather than bundled: pdfkit ships AFM font metrics it reads from disk.
  serverExternalPackages: ["pdfkit", "archiver", "pg"],
};

export default nextConfig;
