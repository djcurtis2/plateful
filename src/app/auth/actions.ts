"use server";
import { getUser } from "@/lib/supabase/server";
import { afterSignIn } from "@/lib/auth-server";

/** Native Apple sign-in has no callback page: the app calls this right after, for the referral credit and welcome card. */
export async function finishSignIn(): Promise<void> {
  const user = await getUser();
  if (user) await afterSignIn(user.id);
}
