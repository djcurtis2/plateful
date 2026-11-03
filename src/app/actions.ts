"use server";
import { DIET_IDS, VERSIONS, type VersionKind } from "@/lib/diet";
import { IMAGE_MAX, extFor, sniffImage } from "@/lib/images";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { siteUrl } from "@/lib/env";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { admin } from "@/lib/supabase/admin";
import { recordReferralCook } from "@/lib/referrals";
import { pantryKey } from "@/lib/format";
import { awardPoints, onEntryPosted, onVote } from "@/lib/game-server";
import { readReceipt } from "@/lib/claude";
import { createBuilt, createOriginal, createVersion } from "@/lib/originals";
import { cleanBuild } from "@/lib/builder";
import { createOwnRecipe } from "@/lib/own-recipes";
import { logCook } from "@/lib/savings-server";
import { RECEIPT_SCAN, siteCapReached } from "@/lib/limits";
import { getMe, getPantry, getSharedRecipe, toRecipe } from "@/lib/data";
import { leftoversFor, shareLabel } from "@/lib/leftovers";
import { LEFTOVER_STYLES, slugify, type Ingredient, type LeftoverStyle } from "@/lib/recipe";
import { POINTS, VOTE_ERRORS, receiptVerdict, validPublicName } from "@/lib/game";

type Result = { ok: true } | { ok: false; code: "login" | "invalid" | "failed"; message: string };

const LOGIN: Extract<Result, { ok: false }> = { ok: false, code: "login", message: "Sign in to do that." };
const Uuid = z.uuid();

async function currentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}

export async function toggleSave(recipeId: string, save: boolean): Promise<Result> {
  if (!Uuid.safeParse(recipeId).success) return { ok: false, code: "invalid", message: "Unknown recipe." };
  const { supabase, user } = await currentUser();
  if (!user) return LOGIN;
  const { error } = save
    ? await supabase.from("saved_recipes").upsert({ user_id: user.id, recipe_id: recipeId })
    : await supabase.from("saved_recipes").delete().eq("user_id", user.id).eq("recipe_id", recipeId);
  if (error) return { ok: false, code: "failed", message: "Couldn't update your library. Try again." };
  revalidatePath("/library");
  return { ok: true };
}

/** "I made it" or "Build my cart": the signal that a referral turned into real cooking. */
export async function markCooked(recipeId: string, servings?: number): Promise<Result & { saved?: number }> {
  if (!Uuid.safeParse(recipeId).success) return { ok: false, code: "invalid", message: "Unknown recipe." };
  const { supabase, user } = await currentUser();
  if (!user) return LOGIN;
  const { error } = await supabase
    .from("saved_recipes")
    .upsert({ user_id: user.id, recipe_id: recipeId, cooked_at: new Date().toISOString() });
  if (error) return { ok: false, code: "failed", message: "Couldn't save that. Try again." };
  try {
    await recordReferralCook(user.id, recipeId);
  } catch (e) {
    console.error("referral cook failed", e);
  }
  let saved: number | undefined;
  try {
    const { data: row } = await admin().from("recipes").select("*").eq("id", recipeId).maybeSingle();
    if (row) {
      const s = await logCook({ userId: user.id, recipe: toRecipe(row as unknown as Parameters<typeof toRecipe>[0]), servings, source: "made_it" });
      saved = s?.saved;
    }
  } catch (e) {
    console.error("savings log failed", e);
  }
  revalidatePath("/library");
  return { ok: true, saved };
}

const PantryNames = z.array(z.string().trim().min(1).max(80)).max(60);

export async function updatePantry(add: string[], remove: string[]): Promise<Result> {
  const a = PantryNames.safeParse(add);
  const r = PantryNames.safeParse(remove);
  if (!a.success || !r.success) return { ok: false, code: "invalid", message: "Check the item names." };
  const { supabase, user } = await currentUser();
  if (!user) return LOGIN;
  const toAdd = [...new Set(a.data.map(pantryKey).filter(Boolean))];
  const toRemove = [...new Set(r.data.map(pantryKey).filter(Boolean))];
  if (toAdd.length) {
    const { error } = await supabase
      .from("pantry_items")
      .upsert(toAdd.map((name) => ({ user_id: user.id, name })), { onConflict: "user_id,name", ignoreDuplicates: true });
    if (error) return { ok: false, code: "failed", message: "Couldn't update your pantry." };
  }
  if (toRemove.length) {
    const { error } = await supabase.from("pantry_items").delete().eq("user_id", user.id).in("name", toRemove);
    if (error) return { ok: false, code: "failed", message: "Couldn't update your pantry." };
  }
  revalidatePath("/pantry");
  return { ok: true };
}

const ATTEMPT_MAX = IMAGE_MAX;

const Details = z.object({
  caption: z.string().trim().max(200).optional(),
  cost: z.union([z.literal(""), z.coerce.number().min(0).max(200)]).optional(),
  minutes: z.union([z.literal(""), z.coerce.number().int().min(1).max(1440)]).optional(),
  swaps: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
});

type PostResult =
  | { ok: true; attemptId: string; challengeId: string | null; receipt: { verified: boolean; message: string } | null; points: number; saved?: number }
  | Extract<Result, { ok: false }>;

/**
 * Posts or updates your cook-off entry (one per person per dish).
 * - New photo: posts it, or replaces your old photo and resets its votes.
 * - No photo but you already have an entry: updates the details only, votes kept.
 * - Optional receipt: Dupe Kitchen reads it to verify your price per plate. The receipt is never stored.
 */
export async function postAttempt(formData: FormData): Promise<PostResult> {
  const { user } = await currentUser();
  if (!user) return LOGIN;
  const recipeId = String(formData.get("recipeId") ?? "");
  if (!Uuid.safeParse(recipeId).success) {
    return { ok: false, code: "invalid", message: "Unknown recipe." };
  }
  const d = Details.safeParse({
    caption: formData.get("caption") ?? undefined,
    cost: formData.get("cost") ?? undefined,
    minutes: formData.get("minutes") ?? undefined,
    swaps: formData.get("swaps") ?? undefined,
    notes: formData.get("notes") ?? undefined,
  });
  if (!d.success) return { ok: false, code: "invalid", message: "Check the cost (0–200) and time (in minutes)." };
  const details = {
    caption: d.data.caption || null,
    cost_per_plate: d.data.cost === "" || d.data.cost == null ? null : Math.round(Number(d.data.cost) * 100) / 100,
    minutes: d.data.minutes === "" || d.data.minutes == null ? null : Number(d.data.minutes),
    swaps: d.data.swaps || null,
    notes: d.data.notes || null,
  };

  const image = formData.get("image");
  const receipt = formData.get("receipt");
  const hasImage = image instanceof Blob && image.size > 0;
  const hasReceipt = receipt instanceof Blob && receipt.size > 0;

  const db = admin();
  const { data: existing } = await db
    .from("attempts")
    .select("id, image_path, challenge_id, cost_source, cost_per_plate")
    .eq("recipe_id", recipeId)
    .eq("user_id", user.id)
    .eq("hidden", false)
    .maybeSingle();

  if (!hasImage && !existing) return { ok: false, code: "invalid", message: "Add a photo of your version." };

  let imagePath: string | null = null;
  if (hasImage) {
    if (image.size > ATTEMPT_MAX) return { ok: false, code: "invalid", message: "That photo is over 5 MB." };
    const bytes = new Uint8Array(await image.arrayBuffer());
    const type = sniffImage(bytes);
    if (!type) return { ok: false, code: "invalid", message: "Use a JPEG, PNG or WebP photo." };
    // Light abuse guard: 10 new photos per user per day.
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { count } = await db.from("attempts").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since);
    if ((count ?? 0) >= 10) return { ok: false, code: "failed", message: "That's 10 posts today. Come back tomorrow." };
    const ext = extFor(type);
    imagePath = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const up = await db.storage.from("attempts").upload(imagePath, bytes, { contentType: type });
    if (up.error) return { ok: false, code: "failed", message: "Couldn't upload your photo. Try again." };
    // Recipes without a photo (Dupe Kitchen originals) take the first cook's photo as their picture.
    const { data: rec } = await db.from("recipes").select("image_path").eq("id", recipeId).maybeSingle();
    if (rec && !rec.image_path) {
      const coverPath = `cooks/${recipeId}.${ext}`;
      const cover = await db.storage.from("dishes").upload(coverPath, bytes, { contentType: type, upsert: true });
      if (!cover.error) {
        await db.from("recipes").update({ image_path: coverPath }).eq("id", recipeId).is("image_path", null);
        revalidatePath("/library");
      }
    }
  }

  // An entry for this week's cook-off dish counts toward the cook-off, whichever page it was posted from.
  // The server picks the cook-off (live, unfinalized, this dish); a client-sent id is never trusted.
  const now = new Date().toISOString();
  const { data: live } = await db
    .from("challenges")
    .select("id")
    .eq("recipe_id", recipeId)
    .lte("starts_at", now)
    .gte("ends_at", now)
    .is("finalized_at", null)
    .limit(1)
    .maybeSingle();
  const challengeId = live?.id ?? null;
  const finalChallenge = challengeId ?? existing?.challenge_id ?? null;

  // A typed-in price replaces a verified one only when the cook changes it (blank or unchanged keeps the verified price).
  const typedCost = details.cost_per_plate;
  const priceFields: { cost_per_plate?: number | null; cost_source?: "self" | "receipt" | null; receipt_store?: null; receipt_verified_at?: null } =
    existing?.cost_source === "receipt" && (typedCost == null || typedCost === Number(existing.cost_per_plate))
      ? {}
      : { cost_per_plate: typedCost, cost_source: typedCost == null ? null : "self", receipt_store: null, receipt_verified_at: null };

  let attemptId: string;
  if (existing) {
    attemptId = existing.id;
    const update = {
      caption: details.caption,
      minutes: details.minutes,
      swaps: details.swaps,
      notes: details.notes,
      ...priceFields,
      challenge_id: finalChallenge, // never unhook an entry from its cook-off
      ...(imagePath ? { image_path: imagePath, votes: 0, created_at: new Date().toISOString() } : {}),
    };
    const { error } = await db.from("attempts").update(update).eq("id", existing.id);
    if (error) return { ok: false, code: "failed", message: "Couldn't update your entry. Try again." };
    if (imagePath) {
      // New photo: votes reset. Give voters their votes back and take back the points those votes earned.
      const { data: oldVotes } = await db.from("attempt_votes").select("user_id").eq("attempt_id", existing.id);
      await db.from("attempt_votes").delete().eq("attempt_id", existing.id);
      for (const v of oldVotes ?? []) {
        await db.from("points_events").delete().eq("user_id", v.user_id).eq("kind", "vote_cast").eq("ref", existing.id);
      }
      await db.from("points_events").delete().eq("user_id", user.id).eq("kind", "vote_received").like("ref", `%:${existing.id}`);
      await db.storage.from("attempts").remove([existing.image_path]); // old photo is no longer shown anywhere
    }
  } else {
    const { data: row, error } = await db
      .from("attempts")
      .insert({
        recipe_id: recipeId,
        challenge_id: finalChallenge,
        user_id: user.id,
        image_path: imagePath!,
        caption: details.caption,
        minutes: details.minutes,
        swaps: details.swaps,
        notes: details.notes,
        cost_per_plate: details.cost_per_plate,
        cost_source: details.cost_per_plate == null ? null : "self",
      })
      .select("id")
      .single();
    if (error || !row) return { ok: false, code: "failed", message: "Couldn't post your entry. Try again." };
    attemptId = row.id;
  }

  // Receipt check (optional). The receipt image is read once and never stored.
  let receiptResult: { verified: boolean; message: string } | null = null;
  if (hasReceipt) receiptResult = await verifyReceipt(receipt, attemptId, recipeId, finalChallenge, user.id);

  await markCooked(recipeId);
  try {
    await onEntryPosted(user.id, attemptId, finalChallenge);
  } catch (e) {
    console.error("points for entry failed", e);
  }
  let saved: number | undefined;
  try {
    // A posted photo is proof of cooking: log the savings as verified.
    const { data: row } = await db.from("recipes").select("*").eq("id", recipeId).maybeSingle();
    if (row) saved = (await logCook({ userId: user.id, recipe: toRecipe(row as unknown as Parameters<typeof toRecipe>[0]), source: "cookoff", verified: true }))?.saved;
  } catch (e) {
    console.error("savings log failed", e);
  }
  // Points this post earned, for the confetti: a new cook-off entry, plus a verified receipt.
  const points = (!existing && finalChallenge ? POINTS.post : 0) + (receiptResult?.verified ? POINTS.receipt : 0);
  revalidatePath("/cookoff");
  revalidatePath("/r/[slug]", "page");
  revalidatePath(`/cookoff/e/${attemptId}`);
  return { ok: true, attemptId, challengeId: finalChallenge, receipt: receiptResult, points, saved };
}

async function verifyReceipt(receipt: Blob, attemptId: string, recipeId: string, challengeId: string | null, userId: string) {
  if (receipt.size > ATTEMPT_MAX) return { verified: false, message: "That receipt photo is over 5 MB." };
  const bytes = new Uint8Array(await receipt.arrayBuffer());
  const type = sniffImage(bytes);
  if (!type) return { verified: false, message: "Use a JPEG, PNG or WebP photo of the receipt." };

  if (await siteCapReached()) return { verified: false, message: "We've hit today's receipt-check limit. Try again tomorrow." };
  const db = admin();
  // Receipt checks are paid Claude calls: 5 per person per day.
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count: tries } = await db.from("scans").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("ip_hash", RECEIPT_SCAN).gte("created_at", since);
  if ((tries ?? 0) >= 5) return { verified: false, message: "That's 5 receipt checks today. Try again tomorrow." };

  const { data: recipe } = await db.from("recipes").select("servings, ingredients").eq("id", recipeId).maybeSingle();
  if (!recipe) return { verified: false, message: "Couldn't find the recipe for this entry." };
  const ingredients = (recipe.ingredients as { name: string; qty: number; unit: string; price: number }[]) ?? [];
  const paid = ingredients.filter((g) => g.price > 0).length;
  const { data: ch } = challengeId ? await db.from("challenges").select("starts_at").eq("id", challengeId).maybeSingle() : { data: null };

  let logged = false;
  try {
    const { result, inputTokens, outputTokens } = await readReceipt({
      imageBase64: Buffer.from(bytes).toString("base64"),
      mediaType: type,
      servings: recipe.servings,
      ingredients,
    });
    // Log the paid call for cost tracking ("receipt" marks it apart from dish scans).
    await db.from("scans").insert({ user_id: userId, ip_hash: RECEIPT_SCAN, ok: result.is_receipt, input_tokens: inputTokens, output_tokens: outputTokens });
    logged = true;
    const verdict = receiptVerdict(result, paid, ch ? new Date(ch.starts_at) : new Date(Date.now() - 7 * 86_400_000));
    if (!verdict.ok) return { verified: false, message: verdict.why };
    await db
      .from("attempts")
      .update({
        cost_per_plate: verdict.cost,
        cost_source: "receipt",
        receipt_store: result.store?.slice(0, 60) ?? null,
        receipt_verified_at: new Date().toISOString(),
      })
      .eq("id", attemptId);
    await awardPoints(userId, "receipt", POINTS.receipt, attemptId, challengeId);
    return { verified: true, message: `Receipt verified: $${verdict.cost.toFixed(2)} a plate${result.store ? ` at ${result.store}` : ""}.` };
  } catch (e) {
    console.error("receipt check failed", e);
    // A failed read may still have been billed: count it toward the person's 5 and the site cap (0 tokens still counts).
    if (!logged) await db.from("scans").insert({ user_id: userId, ip_hash: RECEIPT_SCAN, ok: false, input_tokens: 0, output_tokens: 0 }).then(
      () => undefined,
      () => undefined,
    );
    return { verified: false, message: "We couldn't read that receipt. Try a clearer, flat photo." };
  }
}

export async function voteAttempt(
  attemptId: string,
): Promise<{ ok: true; votes: number; voted: boolean; remaining: number } | Extract<Result, { ok: false }>> {
  if (!Uuid.safeParse(attemptId).success) return { ok: false, code: "invalid", message: "Unknown post." };
  const { user } = await currentUser();
  if (!user) return { ok: false, code: "login", message: "Sign in to vote." };
  const { data, error } = await admin().rpc("cast_vote", { p_attempt: attemptId, p_user: user.id });
  if (error || !data) return { ok: false, code: "failed", message: "Couldn't record your vote. Try again." };
  const r = data as { ok: boolean; code?: string; voted: boolean; votes: number; remaining: number; owner_id: string; challenge_id: string };
  if (!r.ok) return { ok: false, code: "invalid", message: VOTE_ERRORS[r.code ?? ""] ?? "Couldn't record your vote." };
  try {
    await onVote(r, user.id, attemptId);
  } catch (e) {
    console.error("points for vote failed", e);
  }
  revalidatePath("/cookoff");
  return { ok: true, votes: r.votes, voted: r.voted, remaining: r.remaining };
}

/** The name shown on your entries and on leaderboards. */
export async function setPublicName(name: string): Promise<Result> {
  const problem = validPublicName(name);
  if (problem) return { ok: false, code: "invalid", message: problem };
  const { user } = await currentUser();
  if (!user) return LOGIN;
  // Server-side write: browsers can no longer update profiles directly (0012), so every name passes validPublicName.
  const { error } = await admin().from("profiles").update({ public_name: name.trim().replace(/\s+/g, " ") }).eq("id", user.id);
  if (error) return { ok: false, code: "failed", message: "Couldn't save your name. Try again." };
  revalidatePath("/cookoff");
  revalidatePath("/account");
  return { ok: true };
}

/** Flags an entry for review. Entries with 3+ reports are hidden automatically until an admin checks them. */
export async function reportAttempt(attemptId: string, reason: string): Promise<Result> {
  if (!Uuid.safeParse(attemptId).success) return { ok: false, code: "invalid", message: "Unknown post." };
  const { user } = await currentUser();
  if (!user) return LOGIN;
  const db = admin();
  await db.from("attempt_reports").upsert({ attempt_id: attemptId, user_id: user.id, reason: reason.slice(0, 200) || null });
  const { count } = await db.from("attempt_reports").select("user_id", { count: "exact", head: true }).eq("attempt_id", attemptId);
  if ((count ?? 0) >= 3) await db.from("attempts").update({ hidden: true }).eq("id", attemptId);
  return { ok: true };
}

/**
 * "Make something new with my leftovers": Claude writes an original recipe (not a copycat)
 * around what's left from this one, saves it as a public recipe page and adds it to your library.
 */
export async function makeFromLeftovers(
  recipeId: string,
  style: LeftoverStyle,
): Promise<{ ok: true; slug: string } | Extract<Result, { ok: false }>> {
  if (!Uuid.safeParse(recipeId).success || !(style in LEFTOVER_STYLES)) return { ok: false, code: "invalid", message: "Unknown recipe." };
  const me = await getMe();
  if (!me) return LOGIN;
  const { data: row } = await admin().from("recipes").select("*").eq("id", recipeId).maybeSingle();
  if (!row) return { ok: false, code: "invalid", message: "Unknown recipe." };
  const source = toRecipe(row as unknown as Parameters<typeof toRecipe>[0]);
  const pantry = (await getPantry(me.user.id)).map(pantryKey);
  const left = leftoversFor(source.ingredients as Ingredient[], pantry);
  if (left.length < 1) return { ok: false, code: "invalid", message: "This recipe doesn't leave much over. Nothing to use up!" };
  const r = await createOriginal({
    userId: me.user.id,
    plus: me.plus,
    leftovers: left.map((l) => ({ name: l.name, share: shareLabel(l) })),
    style,
    avoidDish: source.dish,
    inspiredBy: source.id,
  });
  if (!r.ok) return { ok: false, code: "failed", message: r.message };
  revalidatePath("/library");
  revalidatePath(`/r/${source.slug}`);
  return { ok: true, slug: r.slug };
}

/** Opt in or out of being named in Dupe Kitchen stories and ads (e.g. "Dan has saved $1,240"). */
export async function setFeatureMe(on: boolean): Promise<Result> {
  const { user } = await currentUser();
  if (!user) return LOGIN;
  const { error } = await admin().from("profiles").update({ feature_me: on }).eq("id", user.id);
  if (error) return { ok: false, code: "failed", message: "Couldn't save that. Try again." };
  revalidatePath("/account");
  return { ok: true };
}

/** "Make it my way": open (or create) a version of this recipe. */
export async function makeVersion(recipeId: string, kind: VersionKind): Promise<{ ok: true; slug: string } | Extract<Result, { ok: false }>> {
  if (!Uuid.safeParse(recipeId).success || !(kind in VERSIONS)) return { ok: false, code: "invalid", message: "Unknown recipe." };
  const me = await getMe();
  if (!me) return LOGIN;
  const { data: row } = await admin().from("recipes").select("*").eq("id", recipeId).maybeSingle();
  if (!row) return { ok: false, code: "invalid", message: "Unknown recipe." };
  let root = toRecipe(row as unknown as Parameters<typeof toRecipe>[0]);
  if (root.variant_of) {
    const { data: orig } = await admin().from("recipes").select("*").eq("id", root.variant_of).maybeSingle();
    if (orig) root = toRecipe(orig as unknown as Parameters<typeof toRecipe>[0]);
  }
  if (root.variant_kind === null && VERSIONS[kind].diet && root.diet_tags.includes(VERSIONS[kind].diet!)) {
    return { ok: false, code: "invalid", message: `This recipe is already ${VERSIONS[kind].label.toLowerCase()}.` };
  }
  const r = await createVersion({ userId: me.user.id, plus: me.plus, root, kind });
  if (!r.ok) return { ok: false, code: "failed", message: r.message };
  revalidatePath(`/r/${root.slug}`);
  revalidatePath("/library");
  return { ok: true, slug: r.slug };
}

/** Save your diets (used to filter suggestions, plans and My recipes). */
export async function setDiets(diets: string[]): Promise<Result> {
  const { user } = await currentUser();
  if (!user) return LOGIN;
  const clean = [...new Set(diets.filter((d) => (DIET_IDS as string[]).includes(d)))];
  const { error } = await admin().from("profiles").update({ diets: clean }).eq("id", user.id);
  if (error) return { ok: false, code: "failed", message: "Couldn't save that. Try again." };
  revalidatePath("/account");
  revalidatePath("/library");
  revalidatePath("/plan");
  return { ok: true };
}

const OwnRecipeForm = z.object({
  dish: z.string().trim().min(2).max(90),
  meals: z.array(z.enum(["breakfast", "lunch", "dinner", "snack", "dessert"])).min(1).max(5),
  servings: z.coerce.number().int().min(1).max(12),
  minutes: z.union([z.literal(""), z.coerce.number().int().min(1).max(1440)]),
  ingredients: z.array(z.string().trim().min(1).max(120)).min(1).max(30),
  steps: z.array(z.string().trim().min(1).max(400)).max(14),
});
const lines = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);

/** "Add my own recipe": anyone signed in can save their own; Claude prices it for the shopping list. Private to them. */
export async function addOwnRecipe(formData: FormData): Promise<{ ok: true; slug: string } | { ok: false; message: string }> {
  const me = await getMe();
  if (!me) return { ok: false, message: "Sign in to save your own recipes." };
  const p = OwnRecipeForm.safeParse({
    dish: formData.get("dish"),
    meals: formData.getAll("meals").map(String),
    servings: formData.get("servings"),
    minutes: formData.get("minutes") ?? "",
    ingredients: lines(formData.get("ingredients")),
    steps: lines(formData.get("steps")),
  });
  if (!p.success) {
    const field = p.error.issues[0]?.path[0];
    const why: Record<string, string> = {
      dish: "Give your recipe a name.",
      meals: "Pick at least one meal it's for.",
      ingredients: "List your ingredients, one per line (up to 30, each under 120 characters).",
      steps: "Up to 14 steps, each under 400 characters.",
      minutes: "Time should be in minutes.",
    };
    return { ok: false, message: why[String(field)] ?? "Check the form and try again." };
  }
  const r = await createOwnRecipe({ userId: me.user.id, ...p.data, minutes: p.data.minutes === "" ? null : p.data.minutes });
  if (!r.ok) return r;
  revalidatePath("/library");
  return { ok: true, slug: r.slug };
}

/** Deletes one of your own recipes. Copycats and originals are shared, so only "own" recipes can be deleted. */
export async function deleteOwnRecipe(recipeId: string): Promise<{ ok: boolean; message?: string }> {
  const me = await getMe();
  if (!me || !Uuid.safeParse(recipeId).success) return { ok: false, message: "Sign in to do that." };
  const { data } = await admin().from("recipes").delete().eq("id", recipeId).eq("user_id", me.user.id).eq("source", "own").select("id");
  if (!data?.length) return { ok: false, message: "Couldn't delete that recipe." };
  revalidatePath("/library");
  redirect("/library");
}

/** Turns on a private share link for one of your own recipes (or returns the existing one). */
export async function shareOwnRecipe(recipeId: string): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const me = await getMe();
  if (!me || !Uuid.safeParse(recipeId).success) return { ok: false, message: "Sign in to do that." };
  const db = admin();
  const { data } = await db.from("recipes").select("slug, share_token").eq("id", recipeId).eq("user_id", me.user.id).eq("source", "own").maybeSingle();
  if (!data) return { ok: false, message: "Only your own recipes can be shared by link." };
  let token = data.share_token;
  if (!token) {
    token = crypto.randomUUID();
    const { error } = await db.from("recipes").update({ share_token: token }).eq("id", recipeId).eq("user_id", me.user.id);
    if (error) return { ok: false, message: "Couldn't make a link. Try again." };
  }
  return { ok: true, url: `${siteUrl}/r/${data.slug}?k=${token}` };
}

/** Turns the share link off: anyone who has it sees "not found" from now on. Copies people saved are theirs to keep. */
export async function stopSharingOwnRecipe(recipeId: string): Promise<{ ok: boolean; message?: string }> {
  const me = await getMe();
  if (!me || !Uuid.safeParse(recipeId).success) return { ok: false, message: "Sign in to do that." };
  await admin().from("recipes").update({ share_token: null }).eq("id", recipeId).eq("user_id", me.user.id).eq("source", "own");
  return { ok: true, message: "Link turned off" };
}

/** Most shared recipes one person can copy in a day; copies cost nothing, the cap just stops floods. */
const COPIES_PER_DAY = 30;

/**
 * Saves your own copy of a recipe someone shared with you: private to you, yours to plan with,
 * and unaffected if they change or delete theirs. Copying the same one twice opens your first copy.
 */
export async function copySharedRecipe(slug: string, token: string): Promise<{ ok: false; message: string }> {
  const me = await getMe();
  if (!me) return { ok: false, message: "Sign in to save a copy." };
  const original = await getSharedRecipe(slug, token);
  if (!original) return { ok: false, message: "That link has been turned off." };
  const db = admin();
  const { data: mine } = await db.from("recipes").select("slug").eq("user_id", me.user.id).eq("inspired_by", original.id).eq("source", "own").limit(1).maybeSingle();
  if (mine) redirect(`/r/${mine.slug}`);
  const { count } = await db
    .from("recipes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", me.user.id)
    .not("inspired_by", "is", null)
    .eq("source", "own")
    .gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
  if ((count ?? 0) >= COPIES_PER_DAY) return { ok: false, message: "That's a lot of copies today. Try again tomorrow." };
  const id = crypto.randomUUID();
  const copySlug = `${slugify(original.dish)}-${id.slice(0, 6)}`;
  const { error } = await db.from("recipes").insert({
    id,
    slug: copySlug,
    user_id: me.user.id,
    dish: original.dish,
    restaurant: null,
    cuisine: original.cuisine,
    meals: original.meals,
    servings: original.servings,
    minutes: original.minutes,
    difficulty: original.difficulty,
    confidence: null,
    why: original.why,
    menu_price: null,
    plate_cost: original.plate_cost,
    out_price: original.out_price,
    contains: original.contains,
    diet_tags: original.diet_tags,
    ingredients: original.ingredients,
    steps: original.steps,
    image_path: null,
    source: "own",
    style: null,
    is_public: false,
    inspired_by: original.id,
  });
  if (error) return { ok: false, message: "Couldn't save a copy. Try again." };
  await db.from("saved_recipes").upsert({ user_id: me.user.id, recipe_id: id });
  revalidatePath("/library");
  redirect(`/r/${copySlug}`);
}

/** "Build a plate": Claude writes a recipe from the cook's picks; it joins their library. Same limits as other new recipes. */
export async function buildPlate(raw: {
  protein: string;
  method: string;
  flavor: string;
  addIns: string[];
  sides: string[];
  servings: number;
  note: string;
}): Promise<{ ok: true; slug: string } | { ok: false; message: string }> {
  const me = await getMe();
  if (!me) return { ok: false, message: "Sign in to build a recipe." };
  const build = cleanBuild(raw);
  if (!build) return { ok: false, message: "Pick a protein, a way to cook it and a flavor." };
  const r = await createBuilt({ userId: me.user.id, plus: me.plus, build });
  if (!r.ok) return r;
  revalidatePath("/library");
  return { ok: true, slug: r.slug };
}
