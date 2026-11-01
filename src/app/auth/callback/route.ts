import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { attributeSignup } from "@/lib/referrals";
import { REF_COOKIE, WELCOME_COOKIE } from "@/lib/cookies";

/** Magic-link and OAuth sign-ins land here. Exchanges the code, credits any referral, then redirects. */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const code = searchParams.get("code");
  const nextRaw = searchParams.get("next") ?? "/library";
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/library";

  if (!code) return NextResponse.redirect(`${origin}/login?error=missing_code`);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(`${origin}/login?error=link_expired`);

  const ref = (await cookies()).get(REF_COOKIE)?.value;
  if (ref) {
    try {
      await attributeSignup(data.user.id, ref);
    } catch (e) {
      console.error("referral attribution failed", e);
    }
  }

  const res = NextResponse.redirect(`${origin}${next}`);
  // Show the welcome card (level, points, badges) once after signing in.
  res.cookies.set(WELCOME_COOKIE, "1", { path: "/", maxAge: 600, sameSite: "lax" });
  return res;
}
