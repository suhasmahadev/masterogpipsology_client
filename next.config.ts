import type { NextConfig } from "next";

const IMMUTABLE = [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }];
const SECURITY = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    qualities: [75, 85, 90],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    formats: ["image/webp"], // no AVIF first-request encode latency on the LCP hero
    minimumCacheTTL: 604800,
    localPatterns: [
      { pathname: "/_next/static/media/**", search: "" },
      { pathname: "/main_logo.png", search: "" },
      { pathname: "/team/**", search: "" },
    ],
  },
  // Files under /assets, /frames, /textures and /hero are immutable for one year. Never replace a
  // file in place: write a new folder (e.g. /frames/v2) and bump FRAME_SET_VERSION.
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY },
      { source: "/assets/:path*", headers: IMMUTABLE },
      { source: "/frames/:path*", headers: IMMUTABLE },
      { source: "/textures/:path*", headers: IMMUTABLE },
      { source: "/hero/:path*", headers: IMMUTABLE },
      { source: "/intelligence-layer.mp4", headers: IMMUTABLE },
      { source: "/brand/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=86400" }] },
      {
        source: "/team/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
    ];
  },
};

export default nextConfig;
