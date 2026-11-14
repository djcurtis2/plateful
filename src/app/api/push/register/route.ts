import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { admin } from "@/lib/supabase/admin";
import { validTimeZone } from "@/lib/push";

const TOKEN_RE = /^[0-9a-fA-F]{1,200}$/;
const STOREFRONT_RE = /^[A-Za-z]{3}$/;

/** The app sends its APNs device token here after the cook turns notifications on. Signed-in only. */
export async function POST(req: NextRequest) {
  const { data } = await (await createClient()).auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { token?: unknown; timeZone?: unknown; storefront?: unknown } | null;
  const token = body?.token;
  if (typeof token !== "string" || !TOKEN_RE.test(token)) return NextResponse.json({ error: "Bad token." }, { status: 400 });

  const time_zone = validTimeZone(body?.timeZone) ? body!.timeZone : null;
  const storefront = typeof body?.storefront === "string" && STOREFRONT_RE.test(body.storefront) ? body.storefront.toUpperCase() : null;

  const { error } = await admin()
    .from("push_devices")
    .upsert(
      { user_id: data.user.id, token, platform: "ios", time_zone: time_zone as string | null, storefront, last_seen_at: new Date().toISOString() },
      { onConflict: "token" },
    );
  if (error) {
    console.error("push register failed", error);
    return NextResponse.json({ error: "Couldn't save." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
