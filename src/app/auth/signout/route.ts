import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { admin } from "@/lib/supabase/admin";
import { PUSH_TOKEN_RE } from "@/lib/push";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  // In the iPhone app the form carries this phone's push token: stop sending this account's
  // notifications to it, so the next person on a shared phone doesn't get them. Only the caller's own row.
  const form = await req.formData().catch(() => null);
  const token = form?.get("push_token");
  if (typeof token === "string" && PUSH_TOKEN_RE.test(token)) {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const { error } = await admin().from("push_devices").delete().eq("token", token).eq("user_id", data.user.id);
      if (error) console.error("push device removal on sign-out failed", error);
    }
  }
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
