import type { MetadataRoute } from "next";
import { clientEnv } from "@/config/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Static public pages plus one entry per listed charity. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = clientEnv.NEXT_PUBLIC_APP_URL;
  const supabase = await createSupabaseServerClient();
  const { data: charities } = await supabase
    .from("charities")
    .select("slug, updated_at")
    .eq("is_active", true);
  const staticPages = ["", "/how-it-works", "/pricing", "/charities", "/draws"].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.7,
  }));
  const charityPages = (charities ?? []).map((c) => ({
    url: `${base}/charities/${c.slug}`,
    lastModified: c.updated_at,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));
  return [...staticPages, ...charityPages];
}
