export type ProfilePlanFields = {
  plan: "free" | "plus";
  subscription_status: string | null;
  bonus_until: string | null;
};

/** Plus is active with a live Stripe subscription, or while referral bonus time remains. */
export function hasPlus(p: ProfilePlanFields | null | undefined, now = new Date()): boolean {
  if (!p) return false;
  const paid = p.plan === "plus" && ["active", "trialing", "past_due"].includes(p.subscription_status ?? "");
  const bonus = !!p.bonus_until && new Date(p.bonus_until) > now;
  return paid || bonus;
}

/** Plus prices as shown on the site. The amounts charged come from the Stripe prices in STRIPE_PRICE_PLUS_MONTHLY / _YEARLY. */
export const PLUS_MONTHLY = "$9.99";
export const PLUS_YEARLY = "$59.99";
export const PLUS_YEARLY_SAVES = "50%"; // vs. 12 × $9.99 = $119.88
/** Stripe promotion code (test and live): $5 off a first Plus payment, Plus only. Checkout has a code field. */
export const LAUNCH_CODE = "DUPELAUNCH";

export const REFERRAL_GOAL = 3; // friends who cook from your link
export const REFERRAL_BONUS_DAYS = 30;
/** Most free months one person can earn from referrals, so throwaway-email farming has a ceiling. */
export const REFERRAL_MAX_REWARDS = 6;
