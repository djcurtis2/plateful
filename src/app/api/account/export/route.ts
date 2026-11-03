import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { admin } from "@/lib/supabase/admin";

// Everything stored about one person, keyed by table. Only this person's rows, read server-side.
const BY_USER = [
  "saved_recipes",
  "pantry_items",
  "attempts",
  "attempt_votes",
  "attempt_reports",
  "points_events",
  "user_badges",
  "prize_awards",
  "meal_plans",
  "cook_log",
  "user_gear",
] as const;

/** "Download my data": a JSON file of the signed-in person's account and activity. */
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return NextResponse.json({ error: { code: "login", message: "Sign in first." } }, { status: 401 });

  const db = admin();
  const { data: profile } = await db.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const tables = await Promise.all(
    BY_USER.map(async (t) => {
      const { data: rows } = await db.from(t).select("*").eq("user_id", user.id);
      return [t, rows ?? []] as const;
    }),
  );
  const { data: recipes } = await db.from("recipes").select("id, slug, dish_name, created_at").eq("user_id", user.id);
  const { data: referrals } = await db.from("referral_events").select("kind, created_at").eq("referrer_id", user.id);

  const body = {
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email, created_at: user.created_at },
    profile,
    recipes_you_made: recipes ?? [],
    referrals: referrals ?? [],
    ...Object.fromEntries(tables),
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="plateful-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
