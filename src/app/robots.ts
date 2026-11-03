import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

/** Search engines may read the public pages; personal and admin pages stay out. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/account", "/api/", "/auth/", "/chef", "/library", "/login", "/pantry", "/plan"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
