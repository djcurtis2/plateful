import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { afterSignIn } from "@/lib/auth-server";
import { isOtpType, safeNext } from "@/lib/auth-links";

/**
 * Magic-link and OAuth sign-ins land here, then redirect to `next`.
 * OAuth (Google, Apple on the web) brings a `code`; email links bring `token_hash` + `type`,
 * which work wherever the link is opened (another browser, or the iPhone app).
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = safeNext(searchParams.get("next"));

  const supabase = await createClient();
  let result;
  if (code) result = await supabase.auth.exchangeCodeForSession(code);
  else if (tokenHash && isOtpType(type)) result = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  else return NextResponse.redirect(`${origin}/login?error=missing_code`);

  const user = result.data.user;
  if (result.error || !user) return NextResponse.redirect(`${origin}/login?error=link_expired`);

  await afterSignIn(user.id);
  return NextResponse.redirect(`${origin}${next}`);
}
