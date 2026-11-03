import "server-only";
import { admin } from "@/lib/supabase/admin";
import { REFERRAL_BONUS_DAYS, REFERRAL_GOAL, REFERRAL_MAX_REWARDS } from "@/lib/plan";
import { REFERRAL_CODE_RE } from "@/lib/cookies";
import { onReferralCook, onReferralSignup } from "@/lib/game-server";

const FRIEND_TRIAL_DAYS = 7;

type ProfileRow = {
  id: string;
  referred_by: string | null;
  bonus_until: string | null;
  referral_rewards_granted: number;
};

function extend(from: string | null, days: number) {
  const base = from && new Date(from) > new Date() ? new Date(from) : new Date();
  return new Date(base.getTime() + days * 86_400_000).toISOString();
}

export async function referrerIdForCode(code: string | null | undefined): Promise<string | null> {
  if (!code || !REFERRAL_CODE_RE.test(code)) return null;
  const { data } = await admin().from("profiles").select("id").eq("referral_code", code).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/** A link with ?ref= was opened. Counted for the referrer's stats only; never rewarded. */
export async function recordReferralVisit(code: string, visitorId: string | null, recipeId: string | null) {
  // Counted once per browser per referrer per day, so replaying the request can't pump the numbers.
  if (!visitorId) return;
  const referrer = await referrerIdForCode(code);
  if (!referrer) return;
  const db = admin();
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await db
    .from("referral_events")
    .select("id", { count: "exact", head: true })
    .eq("referrer_id", referrer)
    .eq("visitor_id", visitorId)
    .eq("kind", "visit")
    .gte("created_at", since);
  if ((count ?? 0) > 0) return;
  await db.from("referral_events").insert({ referrer_id: referrer, visitor_id: visitorId, recipe_id: recipeId, kind: "visit" });
}

/**
 * First sign-in of a new account that arrived through a referral link.
 * Links the two accounts and gives the friend a short Plus trial.
 */
export async function attributeSignup(userId: string, code: string | null | undefined) {
  const referrer = await referrerIdForCode(code);
  if (!referrer || referrer === userId) return;

  const db = admin();
  const { data: me } = await db
    .from("profiles")
    .select("id, referred_by, bonus_until, created_at")
    .eq("id", userId)
    .maybeSingle();
  const profile = me as (ProfileRow & { created_at: string }) | null;
  if (!profile || profile.referred_by) return;
  // Only brand-new accounts can be attributed, so existing users can't farm each other's codes.
  if (Date.now() - new Date(profile.created_at).getTime() > 15 * 60_000) return;

  await db
    .from("profiles")
    .update({ referred_by: referrer, bonus_until: extend(profile.bonus_until, FRIEND_TRIAL_DAYS) })
    .eq("id", userId);
  await db.from("referral_events").insert({ referrer_id: referrer, referred_user_id: userId, kind: "signup" });
  await onReferralSignup(referrer, userId);
}

/**
 * A signed-in, referred user cooked or carted a recipe. Counts once per friend.
 * Every REFERRAL_GOAL friends who cook earns the referrer a free month of Plus, up to REFERRAL_MAX_REWARDS months.
 */
export async function recordReferralCook(userId: string, recipeId: string) {
  const db = admin();
  const { data } = await db.from("profiles").select("referred_by").eq("id", userId).maybeSingle();
  const referrer = (data as { referred_by: string | null } | null)?.referred_by;
  if (!referrer) return;

  const { error } = await db
    .from("referral_events")
    .insert({ referrer_id: referrer, referred_user_id: userId, recipe_id: recipeId, kind: "cook" });
  if (error) return; // unique index: this friend already counted

  const { count } = await db
    .from("referral_events")
    .select("id", { count: "exact", head: true })
    .eq("referrer_id", referrer)
    .eq("kind", "cook");

  await onReferralCook(referrer, userId, count ?? 0);

  const { data: refRow } = await db
    .from("profiles")
    .select("id, bonus_until, referral_rewards_granted")
    .eq("id", referrer)
    .maybeSingle();
  const ref = refRow as ProfileRow | null;
  if (!ref) return;

  const earned = Math.min(Math.floor((count ?? 0) / REFERRAL_GOAL), REFERRAL_MAX_REWARDS);
  const owed = earned - ref.referral_rewards_granted;
  if (owed > 0) {
    await db
      .from("profiles")
      .update({
        bonus_until: extend(ref.bonus_until, owed * REFERRAL_BONUS_DAYS),
        referral_rewards_granted: earned,
      })
      .eq("id", referrer)
      .eq("referral_rewards_granted", ref.referral_rewards_granted); // optimistic lock against double grants
  }
}

export async function referralStats(userId: string) {
  const db = admin();
  const counts = await Promise.all(
    (["visit", "signup", "cook"] as const).map(async (kind) => {
      const { count } = await db
        .from("referral_events")
        .select("id", { count: "exact", head: true })
        .eq("referrer_id", userId)
        .eq("kind", kind);
      return count ?? 0;
    }),
  );
  const [visits, signups, cooks] = counts;
  return { visits, signups, cooks, towardNext: cooks % REFERRAL_GOAL, goal: REFERRAL_GOAL };
}
