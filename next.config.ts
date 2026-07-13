import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mammoth"],
  // Silence the "webpack config with no turbopack config" warning
  turbopack: {},
};

export default nextConfig;
