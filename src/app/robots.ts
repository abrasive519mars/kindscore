import type { MetadataRoute } from "next";
import { clientEnv } from "@/config/env";

/** Public pages are crawlable; member, admin, auth and API routes are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app", "/admin", "/api", "/login", "/signup", "/auth"],
    },
    sitemap: `${clientEnv.NEXT_PUBLIC_APP_URL}/sitemap.xml`,
  };
}
