import type { MetadataRoute } from "next";

// PWA manifest: lets customers add KD Pops to their home screen (spec 3,
// "PWA only"). Colours from the design system.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KD Pops",
    short_name: "KD Pops",
    description: "Order handmade cake pops for collection at school.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5ede0",
    theme_color: "#3b2a20",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
