import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { admin } from "@/lib/supabase/admin";
import { REF_COOKIE } from "@/lib/cookies";

const Body = z.object({ email: z.email().max(254), source: z.string().max(40).optional() });

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "bad_email", message: "Enter a valid email address." } }, { status: 400 });

  const ref = (await cookies()).get(REF_COOKIE)?.value ?? null;
  const { error } = await admin()
    .from("waitlist")
    .upsert(
      { email: parsed.data.email.toLowerCase(), source: parsed.data.source ?? null, referred_by_code: ref },
      { onConflict: "email", ignoreDuplicates: true },
    );
  if (error) {
    console.error("waitlist insert failed", error);
    return NextResponse.json({ error: { code: "save_failed", message: "Try again." } }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
