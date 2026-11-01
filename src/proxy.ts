import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { REF_COOKIE, REF_MAX_AGE, REFERRAL_CODE_RE, VISITOR_COOKIE } from "@/lib/cookies";

/**
 * Runs before every page and API request:
 * 1. Refreshes the Supabase auth session cookie.
 * 2. Gives each browser an anonymous visitor id (rate limits, referral attribution).
 * 3. Remembers a ?ref= referral code for 30 days so sign-ups and cooks are credited.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    // Touching the user refreshes an expiring session. Do not remove.
    await supabase.auth.getUser();
  }

  const secure = request.nextUrl.protocol === "https:";

  if (!request.cookies.get(VISITOR_COOKIE)) {
    response.cookies.set(VISITOR_COOKIE, crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  const ref = request.nextUrl.searchParams.get("ref")?.toUpperCase();
  if (ref && REFERRAL_CODE_RE.test(ref)) {
    response.cookies.set(REF_COOKIE, ref, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: REF_MAX_AGE });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|api/stripe/webhook|.*\\.(?:png|jpg|jpeg|webp|svg|ico)$).*)"],
};
