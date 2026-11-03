"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { admin } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";

type Result = { ok: true } | { ok: false; message: string };

const DELETE_WORD = "DELETE";

/**
 * Permanently deletes the signed-in account: cancels any Plus subscription, removes cook-off photos,
 * then deletes the login (every per-person table cascades from it). Recipes the person made stay up, unattributed.
 */
export async function deleteAccount(confirm: string): Promise<Result> {
  if (confirm.trim().toUpperCase() !== DELETE_WORD) return { ok: false, message: `Type ${DELETE_WORD} to confirm.` };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return { ok: false, message: "Sign in again, then try." };

  const db = admin();
  const { data: profile } = await db.from("profiles").select("stripe_customer_id").eq("id", user.id).maybeSingle();

  // Stop billing first: if this fails, nothing else has been touched and they can try again.
  if (profile?.stripe_customer_id) {
    try {
      const subs = await stripe().subscriptions.list({ customer: profile.stripe_customer_id, status: "all", limit: 20 });
      for (const s of subs.data) {
        if (!["canceled", "incomplete_expired"].includes(s.status)) await stripe().subscriptions.cancel(s.id);
      }
    } catch (e) {
      console.error("delete account: stripe cancel failed", e);
      return { ok: false, message: "We couldn't cancel your Plus subscription. Try again, or cancel it under Manage billing first." };
    }
  }

  const { data: attempts } = await db.from("attempts").select("image_path").eq("user_id", user.id);
  const paths = (attempts ?? []).map((a) => a.image_path).filter((p): p is string => !!p);
  if (paths.length) {
    const { error } = await db.storage.from("attempts").remove(paths);
    if (error) console.error("delete account: photo cleanup failed", error); // orphaned files only; carry on
  }

  const { error } = await db.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("delete account failed", error);
    return { ok: false, message: "Couldn't delete your account. Try again." };
  }
  await supabase.auth.signOut().catch(() => undefined);
  redirect("/?deleted=1");
}
