"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { admin } from "@/lib/supabase/admin";
import { canSave, cleanAvatar, GEAR_BY_ID, type Avatar } from "@/lib/avatar";
import { cleanClubs } from "@/lib/clubs";
import { myChef } from "@/lib/avatar-server";

type Result = { ok: true } | { ok: false; code: "login" | "invalid" | "failed"; message: string };

const LOGIN: Extract<Result, { ok: false }> = { ok: false, code: "login", message: "Sign in to do that." };
const FAILED: Extract<Result, { ok: false }> = { ok: false, code: "failed", message: "Couldn't save. Try again." };

async function signedIn() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

function refresh() {
  for (const p of ["/chef", "/account", "/leaderboard", "/cookoff"]) revalidatePath(p);
}

export async function saveChef(avatar: Avatar): Promise<Result> {
  const user = await signedIn();
  if (!user) return LOGIN;
  const chef = await myChef(user.id);
  const check = canSave(avatar, chef.unlocked, chef.avatar);
  if (!check.ok) return { ok: false, code: "invalid", message: check.message };
  // Store only the known shape, never extra fields from the client.
  const clean = cleanAvatar(avatar);
  const { error } = await admin().from("profiles").update({ avatar: clean }).eq("id", user.id);
  if (error) return FAILED;
  refresh();
  return { ok: true };
}

export async function setClubs(clubs: string[]): Promise<Result> {
  const user = await signedIn();
  if (!user) return LOGIN;
  const { error } = await admin().from("profiles").update({ clubs: cleanClubs(clubs) }).eq("id", user.id);
  if (error) return FAILED;
  refresh();
  return { ok: true };
}

export async function markGearSeen(ids: string[]): Promise<Result> {
  const user = await signedIn();
  if (!user) return LOGIN;
  if (!Array.isArray(ids)) return { ok: false, code: "invalid", message: "Nothing to mark." };
  // Read the list directly: if the read fails, writing would wipe what was already seen.
  const { data, error: readError } = await admin().from("profiles").select("gear_seen").eq("id", user.id).maybeSingle();
  if (readError || !data) return FAILED;
  const seen = Array.isArray(data.gear_seen) ? data.gear_seen.filter((id): id is string => typeof id === "string") : [];
  const have = new Set(seen);
  const add = [...new Set(ids.filter((id): id is string => typeof id === "string" && !!GEAR_BY_ID[id] && !have.has(id)))];
  if (!add.length) return { ok: true };
  const { error } = await admin().from("profiles").update({ gear_seen: [...seen, ...add] }).eq("id", user.id);
  if (error) return FAILED;
  refresh();
  return { ok: true };
}
