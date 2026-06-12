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
            key: "Content-Security-Policy",
            // Development: Next.js React Refresh (HMR) нь 'unsafe-eval' шаарддаг.
            // Production: 'unsafe-eval' хэрэггүй — аюулгүй байдлын үүднээс хасна.
            value: [
              "default-src 'self'",
              process.env.NODE_ENV === "development"
                ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
                : "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' blob: data: http://localhost:3001 https://placehold.co https://images.unsplash.com https://picsum.photos https://i.pinimg.com https://api.dicebear.com https://cdn.simpleicons.org https://api.qrserver.com",
              "font-src 'self' data:",
              "connect-src 'self' " +
                (process.env.NEXT_PUBLIC_API_URL ?? "") +
                (process.env.NODE_ENV === "development"
                  ? " ws://localhost:* wss://localhost:*"
                  : "") +
                " https://cdn.simpleicons.org",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
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
  images: {
    formats: ["image/avif", "image/webp"],
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
