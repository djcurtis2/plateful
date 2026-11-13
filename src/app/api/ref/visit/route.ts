import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { recordReferralVisit } from "@/lib/referrals";
import { VISITOR_COOKIE } from "@/lib/cookies";
import { getMe } from "@/lib/data";

const Body = z.object({ code: z.string().max(20), recipeId: z.uuid().nullable().optional() });

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const visitor = (await cookies()).get(VISITOR_COOKIE)?.value ?? null;
  try {
    const me = await getMe().catch(() => null);
    await recordReferralVisit(
      parsed.data.code.toUpperCase(),
      visitor && /^[0-9a-f-]{36}$/i.test(visitor) ? visitor : null,
      parsed.data.recipeId ?? null,
      me?.user.id ?? null,
    );
  } catch (e) {
    console.error("referral visit failed", e);
  }
  return NextResponse.json({ ok: true });
}
