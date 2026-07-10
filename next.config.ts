import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    "preview-chat-c7dbc73a-aebc-4bb8-8242-925e881ddff1.space-z.ai",
    "*.space-z.ai",
  ],
};

export default nextConfig;
