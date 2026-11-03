import type { Metadata } from "next";
import { getMe, getPantry } from "@/lib/data";
import { originalsLeft, ORIGINALS_LIMIT } from "@/lib/originals";
import { PlateBuilder } from "@/components/PlateBuilder";

export const metadata: Metadata = {
  title: "Build a plate",
  description: "Pick a protein, how to cook it and a flavor. We suggest what goes with it and write the recipe, with cost per plate.",
};

export default async function BuildPage() {
  const me = await getMe();
  const [pantry, left] = me ? await Promise.all([getPantry(me.user.id), originalsLeft(me.user.id, me.plus)]) : [[], 0];
  return (
    <main className="flex flex-col gap-6 pt-8">
      <div>
        <span className="label">Build a plate</span>
        <h1 className="font-display text-4xl font-bold tracking-tight">Start with a protein. We&apos;ll help with the rest.</h1>
        <p className="max-w-[60ch] text-muted">
          Pick what you have, how you want to cook it and a flavor. We&apos;ll suggest what goes with it, then write the full recipe with steps, a
          shopping list and the cost per plate.
        </p>
      </div>
      <PlateBuilder
        signedIn={!!me}
        plus={!!me?.plus}
        left={left}
        plusPerDay={ORIGINALS_LIMIT.plusPerDay}
        pantry={pantry}
      />
    </main>
  );
}
