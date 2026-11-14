export type ProfilePlanFields = {
  plan: "free" | "plus";
  subscription_status: string | null;
  bonus_until: string | null;
  apple_until: string | null;
};

/** True while the Stripe subscription is live. */
export function stripeLive(p: ProfilePlanFields): boolean {
  return p.plan === "plus" && ["active", "trialing", "past_due"].includes(p.subscription_status ?? "");
}

/** Plus is active with a live Stripe subscription, an Apple subscription still running, or while referral bonus time remains. Stripe and Apple are tracked separately. */
export function hasPlus(p: ProfilePlanFields | null | undefined, now = new Date()): boolean {
  if (!p) return false;
  const paid = stripeLive(p);
  const bonus = !!p.bonus_until && new Date(p.bonus_until) > now;
  const apple = !!p.apple_until && new Date(p.apple_until) > now;
  return paid || bonus || apple;
}

const APPLE_COLUMNS = ", apple_until, apple_status";

/**
 * Runs a profiles select with the Apple columns added (`run` gets ", apple_until, apple_status" to append).
 * If that errors (say migration 0018 isn't on the database yet), runs it once more without them and fills them
 * with null, so the site keeps working instead of treating everyone as signed out.
 */
export async function selectWithApple<T extends object>(
  run: (appleColumns: string) => PromiseLike<{ data: T | T[] | null; error: unknown }>,
): Promise<T | T[] | null> {
  const first = await run(APPLE_COLUMNS);
  if (!first.error) return first.data;
  const { data, error } = await run("");
  if (error || !data) return null;
  const fill = (row: T) => ({ ...row, apple_until: null, apple_status: null });
  return Array.isArray(data) ? data.map(fill) : fill(data);
}

/** Plus prices as shown on the site. The amounts charged come from the Stripe prices in STRIPE_PRICE_PLUS_MONTHLY / _YEARLY. */
export const PLUS_MONTHLY = "$9.99";
export const PLUS_YEARLY = "$59.99";
export const PLUS_YEARLY_SAVES = "50%"; // vs. 12 × $9.99 = $119.88
/** Stripe promotion code (test and live): $5 off a first Plus payment, Plus only. Checkout has a code field. */
export const LAUNCH_CODE = "YUMLAUNCH";

export const REFERRAL_GOAL = 3; // friends who cook from your link
export const REFERRAL_BONUS_DAYS = 30;
/** Most free months one person can earn from referrals, so throwaway-email farming has a ceiling. */
export const REFERRAL_MAX_REWARDS = 6;
