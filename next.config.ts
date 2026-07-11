import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for `node .next/standalone/server.js` to work at runtime.
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  experimental: {
    // Required so Prisma's generated client (ESM) resolves correctly
    // when bundled into the standalone server output.
    esmExternals: true,
  },
  allowedDevOrigins: [
    "preview-chat-c7dbc73a-aebc-4bb8-8242-925e881ddff1.space-z.ai",
    "*.space-z.ai",
  ],
};

export default nextConfig;