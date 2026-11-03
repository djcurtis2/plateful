import type { MetadataRoute } from "next";
import { admin } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/env";
import { CLUBS } from "@/lib/clubs";

// Rebuilt at most once an hour, so new recipes show up without a database hit per crawl.
export const revalidate = 3600;

/** Every public page and public recipe. Private ("own") recipes are never public, so they're never listed. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = ["", "/cookoff", "/games", "/games/dish", "/games/higher-lower", "/trivia", "/leaderboard", "/clubs", "/pricing", "/rules", "/privacy", "/terms"];
  const { data } = await admin().from("recipes").select("slug, created_at").eq("is_public", true).order("created_at", { ascending: false }).limit(5000);
  return [
    ...pages.map((p) => ({ url: `${siteUrl}${p}`, changeFrequency: p === "" ? ("daily" as const) : ("weekly" as const), priority: p === "" ? 1 : 0.6 })),
    ...CLUBS.map((c) => ({ url: `${siteUrl}/clubs/${c.id}`, changeFrequency: "weekly" as const, priority: 0.4 })),
    ...(data ?? []).map((r) => ({ url: `${siteUrl}/r/${r.slug}`, lastModified: new Date(r.created_at), changeFrequency: "monthly" as const, priority: 0.8 })),
  ];
}
