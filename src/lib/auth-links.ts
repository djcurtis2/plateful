// Pure helpers for sign-in links (website and iPhone app). No imports, so node:test can run them.

/** The app's own link scheme. Google sends the cook back here from the in-app browser sheet. */
export const APP_SCHEME = "app.yumjack.ios";
export const APP_CALLBACK = `${APP_SCHEME}://auth/callback`;

/** Where to go after signing in: a path on this site only, never another site. */
export function safeNext(raw: string | null | undefined, fallback = "/library"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  return raw;
}

/** The redirect address for Google sign-in inside the app. */
export function appOAuthRedirect(next: string): string {
  return `${APP_CALLBACK}?next=${encodeURIComponent(next)}`;
}

/** `app.yumjack.ios://auth/callback?…` → `<site>/auth/callback?…` (same query). Null for any other link. */
export function appCallbackToWeb(url: string, site = "https://yumjack.app"): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== `${APP_SCHEME}:` || u.hostname !== "auth" || u.pathname !== "/callback") return null;
  return `${site}/auth/callback${u.search}`;
}

const OTP_TYPES = ["email", "magiclink", "signup", "invite", "recovery", "email_change"] as const;
export type EmailLinkType = (typeof OTP_TYPES)[number];

/** True for the email link types Supabase's verifyOtp accepts with a token_hash. */
export function isOtpType(t: string | null | undefined): t is EmailLinkType {
  return (OTP_TYPES as readonly string[]).includes(t ?? "");
}

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

/** A random one-time value for Sign in with Apple (64 hex characters). */
export function randomNonce(): string {
  return hex(crypto.getRandomValues(new Uint8Array(32)));
}

/** SHA-256 of a string as lowercase hex (Apple gets the hash; Supabase gets the raw nonce). */
export async function sha256Hex(text: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))));
}
