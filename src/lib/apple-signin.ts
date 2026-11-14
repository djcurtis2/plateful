"use client";
// Sign in with Apple. In the iPhone app: Apple's own sheet (community plugin) gives an ID token for Supabase.
// On the website: Apple's sign-in page, back through /auth/callback.
import { createClient } from "@/lib/supabase/client";
import { isNativeApp, plugin } from "@/lib/native";
import { randomNonce, sha256Hex } from "@/lib/auth-links";
import { finishSignIn } from "@/app/auth/actions";

type SignInWithApplePlugin = {
  authorize(o: { clientId: string; redirectURI: string; scopes?: string; state?: string; nonce?: string }): Promise<{
    response: { identityToken: string; email: string | null };
  }>;
};

const CANCELLED = "cancelled";
const isCancel = (e: unknown) => /cancel|1001/i.test(`${(e as Error)?.name ?? ""} ${(e as Error)?.message ?? ""} ${(e as { code?: unknown })?.code ?? ""}`);

/** Apple's native sheet. Returns the ID token and the raw nonce Supabase needs, or "cancelled". */
async function nativeAppleToken(): Promise<{ token: string; nonce: string } | typeof CANCELLED> {
  const apple = plugin<SignInWithApplePlugin>("SignInWithApple");
  if (!apple) throw new Error("Sign in with Apple plugin missing");
  const nonce = randomNonce();
  try {
    const { response } = await apple.authorize({
      clientId: "app.yumjack.ios",
      redirectURI: "https://yumjack.app/auth/callback",
      scopes: "email name",
      nonce: await sha256Hex(nonce),
    });
    return { token: response.identityToken, nonce };
  } catch (e) {
    if (isCancel(e)) return CANCELLED;
    throw e;
  }
}

/** Signs in with Apple, then heads to `next`. `error` is plain English for the cook; null when it worked or they cancelled. */
export async function signInWithApple(next: string): Promise<{ error: string | null }> {
  const supabase = createClient();
  try {
    if (!isNativeApp()) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "apple",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      if (error) throw error;
      return { error: null }; // navigating to Apple
    }
    const apple = await nativeAppleToken();
    if (apple === CANCELLED) return { error: null };
    const { error } = await supabase.auth.signInWithIdToken({ provider: "apple", token: apple.token, nonce: apple.nonce });
    if (error) throw error;
    await finishSignIn().catch(() => {}); // referral credit + welcome card; never block signing in
    window.location.assign(next);
    return { error: null };
  } catch {
    return { error: "Apple sign-in isn't working right now. Use the email link instead." };
  }
}

/** Adds Apple to the signed-in account, so later Apple sign-ins open it. `done` means it's linked already (app). */
export async function connectApple(): Promise<{ error: string | null; done: boolean }> {
  const supabase = createClient();
  try {
    if (!isNativeApp()) {
      const { error } = await supabase.auth.linkIdentity({
        provider: "apple",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/account")}` },
      });
      if (error) throw error;
      return { error: null, done: false }; // navigating to Apple
    }
    const apple = await nativeAppleToken();
    if (apple === CANCELLED) return { error: null, done: false };
    const { error } = await supabase.auth.linkIdentity({ provider: "apple", token: apple.token, nonce: apple.nonce });
    if (error) throw error;
    return { error: null, done: true };
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === "identity_already_exists") return { error: "That Apple ID is already used by another Yumjack account.", done: false };
    return { error: "Connecting Apple isn't working right now. Try again later.", done: false };
  }
}
