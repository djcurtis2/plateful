import type { MetadataRoute } from "next";

/** Lets phones "Add to Home Screen": the site opens full screen with its own icon, like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Yumjack",
    short_name: "Yumjack",
    description: "Snap a restaurant dish. Get the copycat recipe, see what you save per plate, and shop the ingredients.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f3f5f0",
    theme_color: "#2F6B46",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
