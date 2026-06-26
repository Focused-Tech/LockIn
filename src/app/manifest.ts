import type { MetadataRoute } from "next";

/** PWA web app manifest (served at /manifest.webmanifest, auto-linked by Next). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LockIn",
    short_name: "LockIn",
    description: "Skill-based prediction contests. Your call. Your cash.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0A0D12",
    theme_color: "#0A0D12",
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-512-maskable",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
