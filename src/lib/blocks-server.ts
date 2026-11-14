import { admin } from "@/lib/supabase/admin";

/** Cooks this person has blocked. Signed-out viewers have none (no query). */
export async function blockedIds(userId: string | null): Promise<Set<string>> {
  if (!userId) return new Set();
  const { data } = await admin().from("blocks").select("blocked_id").eq("blocker_id", userId).limit(1000);
  return new Set((data ?? []).map((b) => b.blocked_id));
}
