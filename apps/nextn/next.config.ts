import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  // Trace files from monorepo root so standalone includes node_modules
  outputFileTracingRoot: path.join(__dirname, "../../"),
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Skip trailing slash redirect for cleaner URLs
  skipTrailingSlashRedirect: true,
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "i.pinimg.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "api.dicebear.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cdn.simpleicons.org",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "api.qrserver.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
