// Pure helpers shared by server and client. Covered by format.test.ts.

const FRACTIONS: [number, string][] = [
  [0.125, "⅛"],
  [0.25, "¼"],
  [0.333, "⅓"],
  [0.5, "½"],
  [0.667, "⅔"],
  [0.75, "¾"],
];

/** 1.5 → "1½", 0.333 → "⅓", 2.4 → "2.4". */
export function formatQty(qty: number, unit = ""): string {
  if (!qty || qty <= 0) return unit ? unit : "to taste";
  const whole = Math.floor(qty);
  const frac = qty - whole;
  let s: string;
  if (frac < 0.06) s = String(whole);
  else if (frac > 0.94) s = String(whole + 1);
  else {
    const match = FRACTIONS.find(([v]) => Math.abs(v - frac) < 0.05);
    s = match ? (whole ? `${whole}${match[1]}` : match[1]) : String(Math.round(qty * 10) / 10);
  }
  return unit ? `${s} ${unit}` : s;
}

export function money(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${n.toFixed(2)}`;
}

/**
 * How many packages to buy when scaling a recipe. A package covers the base recipe;
 * scaling up past ~1.33× needs a second one. Never fewer than one.
 */
export function packagesNeeded(scale: number): number {
  return Math.max(1, Math.ceil(scale * 0.75));
}

/** Normalizes an ingredient name for pantry matching: "Garlic cloves" and "garlic" both → "garlic". */
export function pantryKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/,.*$/, "")
    .replace(/\b(fresh|large|small|medium|boneless|skinless|shredded|grated|chopped|minced|cloves?|leaves|hearts?)\b/g, "")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(?<=[a-z]{2})oes$/, "o")
    .replace(/(?<=[a-z]{2})ies$/, "y")
    .replace(/(?<=[a-z]{3}[^su])s$/, "");
}
