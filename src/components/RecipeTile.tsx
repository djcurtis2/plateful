import Link from "next/link";
import Image from "next/image";
import type { Recipe } from "@/lib/recipe";
import { savings } from "@/lib/recipe";
import { money } from "@/lib/format";

export function RecipeTile({ recipe, note }: { recipe: Recipe; note?: string }) {
  const s = savings(recipe);
  return (
    <Link href={`/r/${recipe.slug}`} className="card group flex min-w-0 flex-col overflow-hidden hover:border-basil">
      <div className="relative aspect-[4/3] bg-sunk">
        {recipe.image_url ? (
          <Image src={recipe.image_url} alt="" fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" />
        ) : (
          <div className="grid h-full place-items-center font-display text-4xl text-muted" aria-hidden>
            {recipe.dish.slice(0, 1)}
          </div>
        )}
        {s && (
          <span className="absolute left-3 top-3 rounded-lg bg-saffron px-2 py-1 font-mono text-xs font-semibold text-saffron-ink">
            {s.pct}% less
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1 p-4">
        {recipe.restaurant && <span className="label">{recipe.restaurant} copycat</span>}
        <span className="font-display text-lg font-bold leading-tight group-hover:text-basil">{recipe.dish}</span>
        <span className="tabular font-mono text-xs text-muted">
          {recipe.menu_price ? `${money(recipe.menu_price)} out · ` : ""}
          {recipe.plate_cost ? `${money(recipe.plate_cost)} a plate` : `${recipe.minutes ?? "—"} min`}
          {note ? ` · ${note}` : ""}
        </span>
      </div>
    </Link>
  );
}
