import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { admin } from "@/lib/supabase/admin";
import { REF_COOKIE } from "@/lib/cookies";
import { hashIp } from "@/lib/limits";

/** Sign-ups allowed from one network per day: plenty for a household, useless for a bot. */
const PER_IP_PER_DAY = 5;

const Body = z.object({ email: z.email().max(254), source: z.string().max(40).optional(), website: z.string().max(200).optional() });

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "bad_email", message: "Enter a valid email address." } }, { status: 400 });

  // Honeypot: the hidden "website" field is invisible to people, so only bots fill it. Pretend it worked.
  if (parsed.data.website) return NextResponse.json({ ok: true });

  const db = admin();
  const ipHash = hashIp(req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip"));
  if (ipHash) {
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { count } = await db.from("waitlist").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since);
    if ((count ?? 0) >= PER_IP_PER_DAY) {
      return NextResponse.json({ error: { code: "rate_limited", message: "That's a lot of sign-ups. Try again tomorrow." } }, { status: 429 });
    }
  }

  const ref = (await cookies()).get(REF_COOKIE)?.value ?? null;
  const { error } = await db
    .from("waitlist")
    .upsert(
      { email: parsed.data.email.toLowerCase(), source: parsed.data.source ?? null, referred_by_code: ref, ip_hash: ipHash },
      { onConflict: "email", ignoreDuplicates: true },
    );
  if (error) {
    console.error("waitlist insert failed", error);
    return NextResponse.json({ error: { code: "save_failed", message: "Try again." } }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
