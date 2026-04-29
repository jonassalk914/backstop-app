import type { MetadataRoute } from "next";

/**
 * PWA manifest. Next.js serves this at /manifest.webmanifest and auto-injects
 * <link rel="manifest"> from the root layout's metadata.manifest entry.
 *
 * Coaches install the app from /dashboard/install. start_url and id point at
 * /dashboard so launching from the home screen drops them straight into work
 * (auth middleware bounces them to /login if signed out). Scope is "/" so the
 * standalone window can also navigate to public booking pages without
 * popping out to the browser.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Backstop",
    short_name: "Backstop",
    description: "Operations platform for independent baseball coaches.",
    id: "/dashboard",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    categories: ["business", "productivity", "sports"],
    icons: [
      { src: "/icon", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon1", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
