// Picks colors and a shape for the drawn plate shown when a recipe has no photo yet. Pure, so it's testable.

export type DishArtSpec = {
  shape: "plate" | "bowl";
  main: string; // the star of the dish
  side: string; // what's next to it
  leaf: string; // garnish
  turn: number; // degrees, so tiles don't all look identical
};

type Food = { words: RegExp; color: string };

// First match wins, so the more specific foods come first.
const MAINS: Food[] = [
  { words: /salmon|shrimp|prawn|lox/, color: "#f08a5d" },
  { words: /tuna|poke|sushi/, color: "#e0566b" },
  { words: /choco|brownie|mocha|cocoa/, color: "#5b3524" },
  { words: /blueberr/, color: "#4f5fa8" },
  { words: /strawberr|raspberr|cherr/, color: "#d2394b" },
  { words: /steak|beef|burger|brisket|meatball|chili|short rib/, color: "#7a3e22" },
  { words: /pork|bacon|sausage|ham|chorizo/, color: "#c0573c" },
  { words: /tomato|marinara|vodka|enchilada|tikka|red curry|salsa|pizza|flatbread/, color: "#d9452f" },
  { words: /chicken|turkey|wing|tender|nugget/, color: "#d99a3d" },
  { words: /pancake|waffle|french toast|biscuit|bread|toast|cheese|mac|alfredo|carbonara|egg/, color: "#efc65a" },
  { words: /pasta|noodle|spaghetti|fettuccine|rigatoni|penne|ramen|lo mein|pad thai|udon/, color: "#e8c27a" },
  { words: /tofu|paneer/, color: "#efe2bf" },
  { words: /pesto|spinach|kale|broccoli|green|salad|zucchini|avocado|guac/, color: "#5f9e4a" },
  { words: /curry|dal|lentil|pumpkin|squash|sweet potato|carrot/, color: "#e5952e" },
  { words: /bean|mushroom|lentil/, color: "#6b4a34" },
  { words: /rice|grain|quinoa|oat|risotto/, color: "#eee3c4" },
];

const SIDES: Food[] = [
  { words: /potato|fries|hash brown/, color: "#e9c46a" },
  { words: /rice|quinoa|couscous|grain/, color: "#f1ead6" },
  { words: /carrot|squash|sweet potato/, color: "#ea8a2f" },
  { words: /broccoli|zucchini|green bean|asparagus|spinach|kale|salad|lettuce|pea/, color: "#6aa84f" },
  { words: /corn/, color: "#f2cf3a" },
  { words: /bean/, color: "#4a3428" },
  { words: /tomato|pepper/, color: "#d9452f" },
];

const SOUPY = /soup|stew|chili|curry|ramen|pho|chowder|bisque|bowl|oatmeal|porridge|dal/;
const LEAVES = ["#2f6b46", "#4b8b3b", "#6fbf8a"];

/** Colors and shape for a recipe's drawn plate, from its name first and then its ingredient names. */
export function dishArt(dish: string, ingredients: string[] = [], seed = dish): DishArtSpec {
  const title = dish.toLowerCase();
  const all = [title, ...ingredients.map((i) => i.toLowerCase())].join(" | ");
  const main = (MAINS.find((f) => f.words.test(title)) ?? MAINS.find((f) => f.words.test(all)))?.color ?? "#f2b630";
  const side = SIDES.map((f) => (f.words.test(all) ? f.color : null)).find((c) => c && c !== main) ?? "#f4e3b5";
  const h = hash(seed);
  return {
    shape: SOUPY.test(title) ? "bowl" : "plate",
    main,
    side,
    leaf: LEAVES[h % LEAVES.length],
    turn: (h % 7) * 15 - 45,
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
