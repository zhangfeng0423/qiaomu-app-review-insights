import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel's Next adapter owns packaging; standalone is for Docker/self-hosting.
  output: process.env.VERCEL ? undefined : 'standalone',
  allowedDevOrigins: ['127.0.0.1'],
  agentRules: false,
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
