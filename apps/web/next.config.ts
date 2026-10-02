import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  devIndicators: false,
  reactStrictMode: true,
  transpilePackages: ["@wifi-control/ui"]
};

export default nextConfig;
