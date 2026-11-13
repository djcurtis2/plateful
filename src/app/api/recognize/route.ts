import { NextResponse, type NextRequest } from "next/server";
import { dietTagsFrom } from "@/lib/diet";
import { cookies } from "next/headers";
import { admin } from "@/lib/supabase/admin";
import { getMe } from "@/lib/data";
import { checkScanAllowance, guardedCall, hashIp } from "@/lib/limits";
import { recognizeDish, RecognitionError, type ImageMedia } from "@/lib/claude";
import { slugify } from "@/lib/recipe";
import { VISITOR_COOKIE } from "@/lib/cookies";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 5 * 1024 * 1024;
const UUID_RE = /^[0-9a-f-]{36}$/i;

/** Checks the file's real bytes, not just the browser-reported type. */
function sniff(buf: Uint8Array): ImageMedia | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  )
    return "image/webp";
  return null;
}

function fail(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(req: NextRequest) {
  try {
    return await handle(req);
  } catch (e) {
    // Anything unexpected (bad keys, database down) lands here instead of a bare 500.
    const detail = e instanceof Error ? e.message : JSON.stringify(e);
    console.error("[recognize] failed:", e);
    return fail(
      500,
      "server_error",
      process.env.NODE_ENV === "development" ? `Server error: ${detail}` : "Something went wrong on our side. Try again in a minute.",
    );
  }
}

async function handle(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, "bad_request", "Send the photo as a form upload.");
  }

  const file = form.get("image");
  if (!(file instanceof Blob) || file.size === 0) return fail(400, "no_image", "Choose a photo of a dish first.");
  if (file.size > MAX_BYTES) return fail(413, "too_large", "That photo is over 5 MB. Try a smaller one.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mediaType = sniff(bytes);
  if (!mediaType) return fail(415, "bad_type", "Use a JPEG, PNG or WebP photo.");

  const restaurantRaw = String(form.get("restaurant") ?? "").trim().slice(0, 80);
  const restaurant = restaurantRaw || null;

  const jar = await cookies();
  const visitorRaw = jar.get(VISITOR_COOKIE)?.value ?? null;
  const visitorId = visitorRaw && UUID_RE.test(visitorRaw) ? visitorRaw : null;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip");
  const ipHash = hashIp(ip ?? null);

  const me = await getMe();
  const userId = me?.user.id ?? null;

  const seen: { code: string; remaining: number | null } = { code: "", remaining: null };
  const scan = await guardedCall({
    row: { userId, visitorId, ipHash },
    check: async (before) => {
      const allowance = await checkScanAllowance({ userId, visitorId, ipHash, plus: !!me?.plus }, before);
      if (allowance.ok) {
        seen.remaining = allowance.remaining;
        return null;
      }
      seen.code = allowance.code;
      return allowance.message;
    },
    call: () => recognizeDish({ imageBase64: Buffer.from(bytes).toString("base64"), mediaType, restaurant }),
    ok: (made) => made.result.is_food,
    // Claude refused, ran out of room or sent bad JSON: it was still billed, so it counts.
    billedOnError: (e) => e instanceof RecognitionError,
  });
  if (!scan.ok && "limit" in scan) return fail(429, seen.code, scan.limit);
  if (!scan.ok) {
    if (scan.error instanceof RecognitionError) return fail(502, scan.error.code, "We couldn't read that photo. Try a clearer shot of the plate.");
    console.error("recognize failed", scan.error);
    return fail(502, "upstream", "Something went wrong reading your photo. Try again in a minute.");
  }

  const { result } = scan.made;

  if (!result.is_food) {
    return fail(422, "not_food", result.reason ? `That doesn't look like a dish: ${result.reason}` : "That doesn't look like a dish. Try a photo of the plate.");
  }
  if (!result.dish || !result.ingredients?.length || !result.steps?.length) {
    // The model saw food but returned an incomplete recipe. Log what came back so it can be diagnosed.
    console.error("[recognize] incomplete recipe", {
      dish: result.dish,
      ingredients: result.ingredients?.length ?? 0,
      steps: result.steps?.length ?? 0,
    });
    return fail(502, "incomplete", "We recognized the dish but the recipe came back incomplete. Try that photo again.");
  }

  const db = admin();
  const id = crypto.randomUUID();
  const ext = mediaType === "image/png" ? "png" : mediaType === "image/webp" ? "webp" : "jpg";
  const imagePath = `${new Date().toISOString().slice(0, 7)}/${id}.${ext}`;

  const upload = await db.storage.from("dishes").upload(imagePath, bytes, { contentType: mediaType, upsert: false });
  if (upload.error) console.error("dish upload failed", upload.error);

  const recipeRestaurant = result.restaurant || restaurant;
  const slug = `${slugify(result.dish, recipeRestaurant)}-${id.slice(0, 6)}`;

  const { error } = await db.from("recipes").insert({
    id,
    slug,
    user_id: userId,
    visitor_id: visitorId,
    dish: result.dish,
    restaurant: recipeRestaurant,
    cuisine: result.cuisine || null,
    meals: result.meals ?? [],
    servings: result.servings ?? 2,
    minutes: result.minutes ?? null,
    difficulty: result.difficulty ?? null,
    confidence: result.confidence ?? null,
    why: result.why ?? null,
    menu_price: recipeRestaurant ? (result.menu_price ?? null) : null,
    plate_cost: result.plate_cost ?? null,
    out_price: recipeRestaurant ? null : (result.out_price ?? null),
    menu_serves: recipeRestaurant ? (result.menu_serves ?? 1) : 1,
    contains: result.contains ?? [],
    diet_tags: dietTagsFrom(result.contains ?? [], !!result.low_carb),
    ingredients: result.ingredients,
    steps: result.steps,
    image_path: upload.error ? null : imagePath,
  });
  if (error) {
    console.error("recipe insert failed", error);
    return fail(500, "save_failed", "We made your recipe but couldn't save it. Try again.");
  }

  if (userId) await db.from("saved_recipes").upsert({ user_id: userId, recipe_id: id });

  return NextResponse.json({ slug, remaining: seen.remaining });
}
