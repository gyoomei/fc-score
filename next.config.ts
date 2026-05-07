import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    turbopackFileSystemCacheForDev: false,
  },
  turbopack: {
    root: import.meta.dirname,
  },
  env: {
    NEXT_PUBLIC_CLOUDFLARE_WORKERS_URL:
      process.env.NEXT_PUBLIC_CLOUDFLARE_WORKERS_URL,
  },
  allowedDevOrigins: [
    "*.ngrok.app",
    "*.neynar.com",
    "*.neynar.app",
    "*.studio.neynar.com",
    "*.dev-studio.neynar.com",
    "*.nip.io",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.imgur.com",
      },
      {
        protocol: "https",
        hostname: "neynar-public.s3.us-east-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "cdn.neynar.com",
      },
    ],
  },
  devIndicators: false,
  reactCompiler: true,
};

export default nextConfig;
