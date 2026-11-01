import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";
import type { Database } from "@/lib/database.types";

let cached: SupabaseClient<Database> | null = null;

/** Service-role client. Bypasses RLS, so only call it from server code after your own checks. */
export function admin() {
  cached ??= createClient<Database>(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export function publicImageUrl(bucket: "dishes" | "attempts", path: string | null | undefined): string | null {
  if (!path) return null;
  return `${requireEnv("NEXT_PUBLIC_SUPABASE_URL")}/storage/v1/object/public/${bucket}/${path}`;
}
