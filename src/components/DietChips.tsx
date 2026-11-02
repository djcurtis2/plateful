import { DIETS, isTagged, dietMisses, type Diet } from "@/lib/diet";

// Shown on recipes: what it is (Vegetarian, Gluten-free, ...) and, for signed-in cooks, which of their diets it misses.
const SHOW: Diet[] = ["vegan", "vegetarian", "pescatarian", "gluten_free", "dairy_free", "nut_free", "low_carb"];

export function DietChips({ recipe, myDiets = [] }: { recipe: { diet_tags: readonly string[]; contains: readonly string[] }; myDiets?: readonly string[] }) {
  if (!isTagged(recipe)) return null;
  // Vegan implies vegetarian implies pescatarian: show only the strongest.
  const tags = SHOW.filter((d) => recipe.diet_tags.includes(d)).filter(
    (d) => !(d === "vegetarian" && recipe.diet_tags.includes("vegan")) && !(d === "pescatarian" && recipe.diet_tags.includes("vegetarian")),
  );
  const misses = dietMisses(recipe, myDiets);
  return (
    <span className="flex flex-wrap gap-1.5 text-xs">
      {tags.map((d) => (
        <span key={d} className="rounded-lg bg-basil/15 px-2 py-1 font-semibold text-basil">
          ✓ {DIETS[d]}
        </span>
      ))}
      {misses.map((d) => (
        <span key={d} className="rounded-lg bg-chili/15 px-2 py-1 font-semibold text-chili" title="Doesn't fit a diet in your profile">
          Not {DIETS[d].toLowerCase()}
        </span>
      ))}
    </span>
  );
}
