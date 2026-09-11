import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: import.meta.dirname,
  experimental: { authInterrupts: true },
};

export default nextConfig;
