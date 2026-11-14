import "server-only";
import { cookies } from "next/headers";
import { attributeSignup } from "@/lib/referrals";
import { REF_COOKIE, WELCOME_COOKIE } from "@/lib/cookies";

/** After any sign-in: credit the referral link they came from, and show the welcome card once. Route handlers and server actions only. */
export async function afterSignIn(userId: string) {
  const jar = await cookies();
  const ref = jar.get(REF_COOKIE)?.value;
  if (ref) {
    try {
      await attributeSignup(userId, ref);
    } catch (e) {
      console.error("referral attribution failed", e);
    }
  }
  // Show the welcome card (level, points, badges) once after signing in.
  jar.set(WELCOME_COOKIE, "1", { path: "/", maxAge: 600, sameSite: "lax" });
}
