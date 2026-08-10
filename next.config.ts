import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // Firebase Storage public assets (creator avatars, generated pick cards)
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "storage.googleapis.com" },
    ],
  },
  async headers() {
    return [
      {
        // The widget is meant to be embedded on any creator site — allow framing.
        source: "/embed/:id*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
      {
        // iOS universal-links file must be served as JSON (no extension).
        source: "/.well-known/apple-app-site-association",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
    ];
  },
  async redirects() {
    // "Parlay" → "Chain" rename (compliance: "parlay" is sportsbook vocabulary). Old paths
    // 301 to the new routes so any bookmark / deep link / cached URL keeps working.
    return [
      { source: "/app/parlays", destination: "/app/chains", permanent: true },
      {
        source: "/app/practice/arena/parlay",
        destination: "/app/practice/arena/chain",
        permanent: true,
      },
      {
        source: "/api/admin/settle-parlays",
        destination: "/api/admin/settle-chains",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
