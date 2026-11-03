// Chef clubs: who people cook as or for. Run by Dupe Kitchen, not created by users, so there are no
// names to moderate. Pure functions, shared by server and client; covered by clubs.test.ts.
// No clubs aimed at children (COPPA); family clubs are framed for parents.

export type Club = { id: string; name: string; blurb: string };

export const CLUBS: Club[] = [
  { id: "picky-eater-parents", name: "Picky Eater Parents", blurb: "Dinners that win over the pickiest eaters at home." },
  { id: "dad-chef", name: "Dad Chef", blurb: "Dinner duty, handled with a little extra flair." },
  { id: "cooking-with-my-kids", name: "Cooking with My Kids", blurb: "Easy recipes parents and little helpers can make together." },
  { id: "budget-cook", name: "Budget Cook", blurb: "Good food that's kind to the wallet." },
  { id: "meal-prepper", name: "Meal Prepper", blurb: "Batch-cook once and eat well all week." },
  { id: "cooking-for-one", name: "Cooking for One", blurb: "Small batches made for a table of one." },
  { id: "date-night", name: "Date Night", blurb: "Impressive dishes for cooking with someone special." },
  { id: "plant-forward", name: "Plant-Forward", blurb: "Vegetables take center stage, with meat optional." },
];

export const MAX_CLUBS = 2;
/** A club page lists a recipe only once this many different members made or saved it (matches 0011_club_popular.sql). */
export const CLUB_MIN_MEMBERS = 3;

// Null prototype so untrusted ids like "constructor" or "__proto__" never resolve to inherited members.
export const CLUB_BY_ID: Record<string, Club> = Object.assign(Object.create(null), Object.fromEntries(CLUBS.map((c) => [c.id, c])));

/** Keeps known club ids from untrusted input: deduped, order kept, at most MAX_CLUBS. */
export function cleanClubs(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const id of input) {
    if (typeof id !== "string" || !CLUB_BY_ID[id] || out.includes(id)) continue;
    out.push(id);
    if (out.length === MAX_CLUBS) break;
  }
  return out;
}
