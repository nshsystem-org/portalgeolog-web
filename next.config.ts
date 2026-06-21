import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Pages with next-on-pages supports full Next.js features
  // No need for static export - uses Edge Runtime

  // Image optimization config for Cloudflare
  images: {
    unoptimized: true,
  },

  // Otimizações para desenvolvimento
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },

  // Otimizar recompilação
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },

  // Desabilitar ESLint durante o build para Cloudflare
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Desabilitar TypeScript errors durante o build
  typescript: {
    ignoreBuildErrors: true,
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
