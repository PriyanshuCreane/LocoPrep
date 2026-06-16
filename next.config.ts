import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Include the drizzle/ migration SQL files in Vercel's serverless output.
  // Without this, the drizzle/ folder is not bundled and migrations fail at runtime.
  outputFileTracingIncludes: {
    "/**": ["./drizzle/**"],
  },
};

export default nextConfig;
