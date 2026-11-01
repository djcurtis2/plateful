// Cookie names shared by the proxy, route handlers and server actions.
export const VISITOR_COOKIE = "pf_vid"; // anonymous visitor id (uuid), for rate limits and referral attribution
export const REF_COOKIE = "pf_ref"; // referral code from ?ref=, kept 30 days
export const REF_MAX_AGE = 60 * 60 * 24 * 30;
export const REFERRAL_CODE_RE = /^PLATE-[A-Z0-9]{4,8}$/;
export const SEEN_COOKIE = "pf_seen"; // "points|badges|level" last shown to this browser, to spot new badges and level-ups
export const WELCOME_COOKIE = "pf_welcome"; // set for a few minutes after sign-in to show the welcome card once
