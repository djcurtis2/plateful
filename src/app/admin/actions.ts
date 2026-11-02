"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getMe } from "@/lib/data";
import { admin } from "@/lib/supabase/admin";
import { finalizeChallenge } from "@/lib/game-server";
import { PRIZES } from "@/lib/game";
import { slugify } from "@/lib/recipe";
import { IMAGE_MAX, extFor, sniffImage } from "@/lib/images";
import { packSizes, tagDiet } from "@/lib/claude";
import type { Ingredient } from "@/lib/recipe";
import { recipesMissingDietTags, recipesMissingPackSizes } from "@/lib/data";
import { dietTagsFrom } from "@/lib/diet";
import { SAMPLES } from "@/lib/samples";
import { GEAR_BY_ID, starterFor } from "@/lib/avatar";
import type { Json } from "@/lib/database.types";

type R = { ok: true; message?: string } | { ok: false; message: string };

async function requireAdmin() {
  const me = await getMe();
  return me?.profile?.is_admin ? me : null;
}
const DENIED: R = { ok: false, message: "Admins only." };
const Uuid = z.uuid();

function done(message?: string): R {
  revalidatePath("/admin");
  revalidatePath("/cookoff");
  return { ok: true, message };
}

export async function setChefPick(challengeId: string, attemptId: string | null): Promise<R> {
  if (!(await requireAdmin())) return DENIED;
  if (!Uuid.safeParse(challengeId).success || (attemptId && !Uuid.safeParse(attemptId).success)) return { ok: false, message: "Bad id." };
  const { error } = await admin().from("challenges").update({ chef_pick_attempt_id: attemptId }).eq("id", challengeId).is("finalized_at", null);
  return error ? { ok: false, message: error.message } : done("Chef's pick saved.");
}

export async function finalize(challengeId: string): Promise<R> {
  if (!(await requireAdmin())) return DENIED;
  const r = await finalizeChallenge(challengeId);
  return r.ok
    ? done(`Finalized. Prizes awarded${r.thriftiest ? " (incl. Thriftiest copy)" : ""}; ${r.top10} top-10 badges.`)
    : { ok: false, message: r.message };
}

export async function setHidden(attemptId: string, hidden: boolean): Promise<R> {
  if (!(await requireAdmin())) return DENIED;
  if (!Uuid.safeParse(attemptId).success) return { ok: false, message: "Bad id." };
  const db = admin();
  const { error } = await db.from("attempts").update({ hidden }).eq("id", attemptId);
  if (!error && !hidden) await db.from("attempt_reports").delete().eq("attempt_id", attemptId); // reviewed and cleared
  return error ? { ok: false, message: error.message } : done(hidden ? "Entry hidden." : "Entry restored.");
}

const NewChallenge = z.object({
  title: z.string().trim().min(3).max(80),
  blurb: z.string().trim().max(200).optional(),
  recipeSlug: z.string().trim().min(1),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
});

/** Uploads the photo of the real restaurant dish voters compare entries against. Use a photo you own or have rights to. */
async function uploadReference(challengeId: string, file: File): Promise<string | null> {
  if (file.size > IMAGE_MAX) return "Reference photo is over 5 MB.";
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImage(bytes);
  if (!type) return "Use a JPEG, PNG or WebP photo.";
  const db = admin();
  const path = `references/${challengeId}/${crypto.randomUUID()}.${extFor(type)}`;
  const up = await db.storage.from("dishes").upload(path, bytes, { contentType: type });
  if (up.error) return "Couldn't upload the reference photo.";
  const { data: old } = await db.from("challenges").select("reference_image_path").eq("id", challengeId).maybeSingle();
  const { error } = await db.from("challenges").update({ reference_image_path: path }).eq("id", challengeId);
  if (error) return error.message;
  if (old?.reference_image_path?.startsWith("references/")) await db.storage.from("dishes").remove([old.reference_image_path]);
  return null;
}

export async function setReferencePhoto(challengeId: string, formData: FormData): Promise<R> {
  if (!(await requireAdmin())) return DENIED;
  if (!Uuid.safeParse(challengeId).success) return { ok: false, message: "Bad id." };
  const file = formData.get("reference");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose a photo first." };
  const err = await uploadReference(challengeId, file);
  return err ? { ok: false, message: err } : done("Reference photo saved.");
}

export async function createChallenge(formData: FormData): Promise<R> {
  if (!(await requireAdmin())) return DENIED;
  const p = NewChallenge.safeParse({
    title: formData.get("title"),
    blurb: formData.get("blurb") ?? undefined,
    recipeSlug: formData.get("recipeSlug"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
  });
  if (!p.success) return { ok: false, message: "Fill in a title, recipe and both dates." };
  const db = admin();
  const slugIn = p.data.recipeSlug.replace(/^.*\/r\//, "").replace(/[?#].*$/, "");
  const { data: recipe } = await db.from("recipes").select("id").eq("slug", slugIn).maybeSingle();
  if (!recipe) return { ok: false, message: "No recipe with that slug. Paste the recipe page URL or its slug." };
  const starts = new Date(p.data.startsAt);
  const ends = new Date(p.data.endsAt);
  if (!(ends > starts)) return { ok: false, message: "End must be after start." };
  const slug = `${slugify(p.data.title)}-${starts.toISOString().slice(0, 10)}`;
  const { data: created, error } = await db
    .from("challenges")
    .insert({
      slug,
      title: p.data.title,
      blurb: p.data.blurb || null,
      recipe_id: recipe.id,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };
  const ref = formData.get("reference");
  if (ref instanceof File && ref.size > 0) {
    const err = await uploadReference(created.id, ref);
    if (err) return { ok: false, message: `Cook-off scheduled, but the reference photo failed: ${err}` };
  }
  return done("Cook-off scheduled.");
}

export async function recordGiftCard(userId: string, period: string, reason: "monthly_top" | "top_saver" = "monthly_top"): Promise<R> {
  if (!(await requireAdmin())) return DENIED;
  if (!Uuid.safeParse(userId).success || !/^\d{4}-\d{2}$/.test(period)) return { ok: false, message: "Bad input." };
  const { error } = await admin()
    .from("prize_awards")
    .insert({ user_id: userId, kind: "gift_card", reason, period, detail: PRIZES.monthlyGiftCard });
  if (error?.code === "23505") return { ok: false, message: "Already recorded for that month." };
  return error ? { ok: false, message: error.message } : done("Gift card recorded. Mark it fulfilled once sent.");
}

export async function setPrizeStatus(id: number, status: "fulfilled" | "cancelled" | "pending"): Promise<R> {
  if (!(await requireAdmin())) return DENIED;
  const { error } = await admin()
    .from("prize_awards")
    .update({ status, fulfilled_at: status === "fulfilled" ? new Date().toISOString() : null })
    .eq("id", id);
  return error ? { ok: false, message: error.message } : done();
}


/** Asks Claude for package sizes on up to 10 older recipes per click (a fraction of a cent each). */
export async function fillPackSizes(): Promise<R> {
  if (!(await requireAdmin())) return DENIED;
  const todo = (await recipesMissingPackSizes()).slice(0, 10);
  if (!todo.length) return { ok: true, message: "Every recipe already has package sizes." };
  let done = 0;
  for (const r of todo) {
    const ingredients = r.ingredients as Ingredient[];
    try {
      const { sizes } = await packSizes(ingredients);
      const updated = ingredients.map((g, i) => ({ ...g, pack_qty: sizes[i] }));
      const { error } = await admin().from("recipes").update({ ingredients: updated }).eq("id", r.id);
      if (!error) done++;
    } catch (e) {
      console.error("pack sizes failed", r.id, e);
    }
  }
  revalidatePath("/admin");
  revalidatePath("/r/[slug]", "page");
  const left = (await recipesMissingPackSizes()).length;
  return { ok: true, message: `Updated ${done} of ${todo.length} recipes.${left ? ` ${left} still to do; click again.` : " All done."}` };
}

/**
 * Adds the sample recipes (with free Unsplash photos) that aren't already in the database.
 * Your server downloads each photo once and stores it in the "dishes" bucket under samples/.
 */
export async function importSamples(): Promise<R> {
  if (!(await requireAdmin())) return DENIED;
  const db = admin();
  const { data: have } = await db.from("recipes").select("slug").in("slug", SAMPLES.map((s) => s.slug));
  const existing = new Set((have ?? []).map((r) => r.slug));
  const todo = SAMPLES.filter((s) => !existing.has(s.slug));
  if (!todo.length) return { ok: true, message: "All sample recipes are already added." };

  let added = 0;
  let noPhoto = 0;
  const one = async (s: (typeof SAMPLES)[number]) => {
    let image_path: string | null = null;
    try {
      const res = await fetch(`https://images.unsplash.com/${s.photo}?w=1400&h=1050&fit=crop&q=80&fm=jpg`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      const type = res.ok && bytes.length <= IMAGE_MAX ? sniffImage(bytes) : null;
      if (type) {
        const path = `samples/${s.slug}.${extFor(type)}`;
        const up = await db.storage.from("dishes").upload(path, bytes, { contentType: type, upsert: true });
        if (!up.error) image_path = path;
      }
    } catch (e) {
      console.error("sample photo failed", s.slug, e);
    }
    if (!image_path) noPhoto++;
    const { error } = await db.from("recipes").insert({
      slug: s.slug,
      dish: s.dish,
      restaurant: s.restaurant,
      style: s.style,
      cuisine: s.cuisine,
      meals: s.meals,
      servings: s.servings,
      minutes: s.minutes,
      difficulty: s.difficulty,
      confidence: null,
      why: s.why,
      menu_price: s.menu_price,
      menu_serves: s.menu_serves ?? 1,
      out_price: s.out_price ?? null,
      plate_cost: s.plate_cost,
      ingredients: s.ingredients,
      steps: s.steps,
      image_path,
    });
    if (error) console.error("sample insert failed", s.slug, error.message);
    else added++;
  };
  for (let i = 0; i < todo.length; i += 5) await Promise.all(todo.slice(i, i + 5).map(one));

  revalidatePath("/");
  revalidatePath("/library");
  revalidatePath("/r/[slug]", "page");
  return { ok: true, message: `Added ${added} sample recipes${noPhoto ? ` (${noPhoto} without a photo)` : ""}.` };
}

/** Asks Claude what older recipes contain, then sets their diet tags. 10 per click, a fraction of a cent each. */
export async function fillDietTags(): Promise<R> {
  if (!(await requireAdmin())) return DENIED;
  const todo = (await recipesMissingDietTags()).slice(0, 10);
  if (!todo.length) return { ok: true, message: "Every recipe has diet tags." };
  let done = 0;
  await Promise.all(
    todo.map(async (r) => {
      try {
        const t = await tagDiet(r.dish, r.ingredients as Ingredient[], r.servings);
        const { error } = await admin()
          .from("recipes")
          .update({ contains: t.contains, diet_tags: dietTagsFrom(t.contains, t.lowCarb) })
          .eq("id", r.id);
        if (!error) done++;
      } catch (e) {
        console.error("diet tags failed", r.id, e);
      }
    }),
  );
  revalidatePath("/admin");
  revalidatePath("/r/[slug]", "page");
  const left = (await recipesMissingDietTags()).length;
  return { ok: true, message: `Tagged ${done} of ${todo.length} recipes.${left ? ` ${left} still to do; click again.` : " All done."}` };
}

function gearDone(message: string): R {
  for (const p of ["/admin", "/chef", "/account", "/leaderboard", "/cookoff"]) revalidatePath(p);
  return { ok: true, message };
}

/** Gives someone a shop item for free (e.g. a make-good). Only shop items: earned and Plus gear unlock on their own. */
export async function grantGear(userId: string, itemId: string): Promise<R> {
  if (!(await requireAdmin())) return DENIED;
  if (!Uuid.safeParse(userId).success) return { ok: false, message: "Bad user id." };
  const g = GEAR_BY_ID[itemId];
  if (g?.source.kind !== "shop") return { ok: false, message: "Pick a shop item." };
  const { data, error } = await admin()
    .from("user_gear")
    .upsert({ user_id: userId, item_id: g.id, source: "grant", stripe_session_id: null }, { onConflict: "user_id,item_id", ignoreDuplicates: true })
    .select("item_id");
  if (error?.code === "23503") return { ok: false, message: "No profile with that user id." };
  if (error) return { ok: false, message: error.message };
  return gearDone(data?.length ? `Granted ${g.name}.` : `They already own ${g.name}.`);
}

/** Takes an item back (e.g. after a refund in the Stripe dashboard) and unequips it so boards stop showing it. */
export async function removeGear(userId: string, itemId: string): Promise<R> {
  if (!(await requireAdmin())) return DENIED;
  if (!Uuid.safeParse(userId).success) return { ok: false, message: "Bad user id." };
  const g = GEAR_BY_ID[itemId];
  if (!g) return { ok: false, message: "Unknown item." };
  const db = admin();
  const { data, error } = await db.from("user_gear").delete().eq("user_id", userId).eq("item_id", g.id).select("item_id");
  if (error) return { ok: false, message: error.message };
  if (!data?.length) return { ok: false, message: `They don't own ${g.name}.` };

  // Swap it for the slot's starter in the saved avatar, keeping everything else as saved.
  const { data: profile } = await db.from("profiles").select("avatar").eq("id", userId).maybeSingle();
  const saved = profile?.avatar;
  if (saved && typeof saved === "object" && !Array.isArray(saved)) {
    const equipped = saved.equipped;
    if (equipped && typeof equipped === "object" && !Array.isArray(equipped) && equipped[g.slot] === g.id) {
      const avatar = { ...saved, equipped: { ...equipped, [g.slot]: starterFor(g.slot).id } } as Json;
      const { error: e2 } = await db.from("profiles").update({ avatar }).eq("id", userId);
      if (e2) return { ok: false, message: `Removed ${g.name}, but couldn't unequip it: ${e2.message}` };
      return gearDone(`Removed ${g.name} and put the starter back on.`);
    }
  }
  return gearDone(`Removed ${g.name}.`);
}
