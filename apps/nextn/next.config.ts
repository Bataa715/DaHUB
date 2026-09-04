import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["192.168.10.50", "192.168.10.*", "192.168.*.*"],
  output: "standalone",
  // Trace files from monorepo root so standalone includes node_modules
  outputFileTracingRoot: path.join(__dirname, "../../"),
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
        ],
      },
    ];
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Skip trailing slash redirect for cleaner URLs
  skipTrailingSlashRedirect: true,
  async redirects() {
    return [
      {
        source: "/ajiltnuud",
        destination: "/employee",
        permanent: true,
      },
      {
        source: "/medleg",
        destination: "/knowledge",
        permanent: true,
      },
      {
        source: "/tools/monitoring-box/related-party-transactions",
        destination: "/tools/monitoring-box?tool=related-party",
        permanent: false,
      },
      {
        source: "/tools/monitoring-box/related-party-transactions/",
        destination: "/tools/monitoring-box?tool=related-party",
        permanent: false,
      },
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    // [AUDIT] Next 15 default qualities=[75] — quality={95} ийм жагсаалтад
    // байхгүй бол 75 руу шахагдаж hero/login зураг бүдгэрдэг байсан.
    qualities: [75, 90, 95],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "3001",
        pathname: "/**",
      },
      // [AUDIT] placehold.co / unsplash / picsum / pinimg хасагдсан —
      // demo контентын үлдэгдэл байсан ба image proxy-г гадны host руу нээдэг.
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
