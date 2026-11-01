"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getMe } from "@/lib/data";
import { admin } from "@/lib/supabase/admin";
import { finalizeChallenge } from "@/lib/game-server";
import { PRIZES } from "@/lib/game";
import { slugify } from "@/lib/recipe";
import { IMAGE_MAX, extFor, sniffImage } from "@/lib/images";

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

export async function recordGiftCard(userId: string, period: string): Promise<R> {
  if (!(await requireAdmin())) return DENIED;
  if (!Uuid.safeParse(userId).success || !/^\d{4}-\d{2}$/.test(period)) return { ok: false, message: "Bad input." };
  const { error } = await admin()
    .from("prize_awards")
    .insert({ user_id: userId, kind: "gift_card", reason: "monthly_top", period, detail: PRIZES.monthlyGiftCard });
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
