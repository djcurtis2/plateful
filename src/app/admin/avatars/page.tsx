import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMe } from "@/lib/data";
import { GEAR, LOOK_OPTIONS, SLOTS, defaultAvatar, type Avatar, type LookPart, type Rarity } from "@/lib/avatar";
import { ChefAvatar } from "@/components/ChefAvatar";
import { LOOK_NAMES } from "@/components/chef/look";
import { hasGearArt } from "@/components/chef/gear";

export const metadata: Metadata = { title: "Avatar art sheet", robots: { index: false } };
export const dynamic = "force-dynamic";

// A fixed chef so look options are compared like for like.
const BASE: Avatar = {
  look: { skin: 2, eyes: 0, brows: 0, mouth: 0, hair: 1, hairColor: 1, facialHair: 0, glasses: 0 },
  equipped: {},
};
const DEFAULT_CHEF = defaultAvatar("art-sheet");
const SAMPLES = Array.from({ length: 12 }, (_, i) => defaultAvatar(`sample-chef-${i + 1}`));
const LEGENDARY: Avatar = {
  look: { ...BASE.look, eyes: 1, mouth: 1, hair: 4, hairColor: 3 },
  equipped: { hat: "golden-toque", outfit: "winners-jacket", tool: "copper-pan", background: "spotlight" },
};
const HAIR_TEST_HATS = GEAR.filter((g) => g.slot === "hat");

const PART_LABELS: Record<LookPart, string> = {
  skin: "Skin tone", eyes: "Eyes", brows: "Brows", mouth: "Mouth", hair: "Hair style", hairColor: "Hair color", facialHair: "Facial hair", glasses: "Glasses",
};
const RARITY_STYLES: Record<Rarity, string> = {
  common: "bg-sunk text-muted",
  rare: "bg-basil/15 text-basil",
  epic: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  legendary: "bg-saffron text-saffron-ink",
};

const tile = "flex flex-col items-center gap-1 rounded-2xl bg-sunk p-2 text-center";

export default async function AvatarArtPage() {
  const me = await getMe();
  if (!me?.profile?.is_admin) notFound(); // don't reveal the page exists

  return (
    <main className="flex flex-col gap-10 pt-8">
      <div>
        <span className="label">Admin</span>
        <h1 className="font-display text-4xl font-bold tracking-tight">Avatar art sheet</h1>
        <p className="text-muted">Every look option and gear item, for checking the art. Check it in light and dark mode.</p>
      </div>

      <section className="card flex flex-col gap-6 p-5">
        <h2 className="font-display text-2xl font-bold">Look options</h2>
        {(Object.keys(LOOK_OPTIONS) as LookPart[]).map((part) => (
          <div key={part} className="flex flex-col gap-2">
            <h3 className="font-semibold">
              {PART_LABELS[part]} <span className="text-sm text-muted">({LOOK_OPTIONS[part]})</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: LOOK_OPTIONS[part] }, (_, i) => (
                <div key={i} className={tile}>
                  <ChefAvatar avatar={{ ...BASE, look: { ...BASE.look, [part]: i } }} size={96} head uid={`look-${part}-${i}`} />
                  <span className="text-xs text-muted">
                    {i}. {LOOK_NAMES[part][i] ?? "(no art)"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="card flex flex-col gap-6 p-5">
        <h2 className="font-display text-2xl font-bold">Gear</h2>
        {SLOTS.map((slot) => (
          <div key={slot} className="flex flex-col gap-2">
            <h3 className="font-semibold capitalize">{slot}</h3>
            <div className="flex flex-wrap gap-2">
              {GEAR.filter((g) => g.slot === slot).map((g) => (
                <div key={g.id} className={tile}>
                  <ChefAvatar avatar={{ ...DEFAULT_CHEF, equipped: { ...DEFAULT_CHEF.equipped, [slot]: g.id } }} size={200} uid={`gear-${g.id}`} title={g.name} />
                  <span className="text-sm font-semibold">
                    {g.name}
                    {!hasGearArt(slot, g.id) && <span className="font-normal text-chili"> (no art)</span>}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${RARITY_STYLES[g.rarity]}`}>{g.rarity}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="card flex flex-col gap-4 p-5">
        <h2 className="font-display text-2xl font-bold">Hair under hats</h2>
        <p className="text-sm text-muted">Every hair style under every hat: hair should tuck under the brim, never poke through.</p>
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-1">
            <thead>
              <tr>
                <th />
                {LOOK_NAMES.hair.map((n) => (
                  <th key={n} className="text-xs font-normal text-muted">{n}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HAIR_TEST_HATS.map((h) => (
                <tr key={h.id}>
                  <th className="pr-2 text-left text-xs font-normal text-muted">{h.name}</th>
                  {LOOK_NAMES.hair.map((n, i) => (
                    <td key={n} className="rounded-xl bg-sunk">
                      <ChefAvatar avatar={{ look: { ...BASE.look, hair: i, hairColor: 4 }, equipped: { hat: h.id } }} size={56} head uid={`hh-${h.id}-${i}`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card flex flex-col gap-4 p-5">
        <h2 className="font-display text-2xl font-bold">Default chefs</h2>
        <p className="text-sm text-muted">What 12 new people get before they customize.</p>
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map((a, i) => (
            <ChefAvatar key={i} avatar={a} size={160} uid={`sample-${i}`} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {SAMPLES.map((a, i) => (
            <span key={i} className="overflow-hidden rounded-full bg-sunk">
              <ChefAvatar avatar={a} size={32} head uid={`sample-head-${i}`} />
            </span>
          ))}
        </div>
      </section>

      <section className="card flex flex-col gap-4 p-5">
        <h2 className="font-display text-2xl font-bold">Legendary side by side</h2>
        <p className="text-sm text-muted">Both should glow: their ids must not collide.</p>
        <div className="flex flex-wrap items-end gap-2">
          <ChefAvatar avatar={LEGENDARY} size={240} uid="legend-a" />
          <ChefAvatar avatar={LEGENDARY} size={240} uid="legend-b" />
          <span className="overflow-hidden rounded-full bg-sunk">
            <ChefAvatar avatar={LEGENDARY} size={32} head uid="legend-head-a" />
          </span>
          <span className="overflow-hidden rounded-full bg-sunk">
            <ChefAvatar avatar={LEGENDARY} size={32} head uid="legend-head-b" />
          </span>
        </div>
      </section>
    </main>
  );
}
