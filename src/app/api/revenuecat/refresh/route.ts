import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { refreshFromRevenueCat } from "@/lib/apple-billing-server";

/** The app calls this after an Apple purchase or restore, and when it opens, in case a webhook is late. Signed-in only. */
export async function POST() {
  const { data } = await (await createClient()).auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const changed = await refreshFromRevenueCat(data.user.id);
  return NextResponse.json({ ok: true, changed });
}
