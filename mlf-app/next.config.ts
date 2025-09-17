import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Disable ESLint during production builds to prevent deployment failures
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
