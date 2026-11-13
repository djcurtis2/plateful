import { dishArt } from "@/lib/dish-art";

// A drawn plate (or bowl) standing in for a recipe photo that doesn't exist yet. Its colors come from the
// dish name and ingredients, so salmon reads pink and chili reads brown. Fixed paper colors: it sits on bg-sunk
// in light and dark. Decoration only.
const PAPER = "#ffffff";
const RIM = "#dfe4da";

export function DishArt({ dish, ingredients = [], seed }: { dish: string; ingredients?: string[]; seed?: string }) {
  const a = dishArt(dish, ingredients, seed ?? dish);
  return (
    <svg viewBox="0 0 160 120" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <ellipse cx="84" cy="66" rx="58" ry="50" fill="#000000" fillOpacity="0.07" />
      {a.shape === "plate" ? (
        <g transform={`rotate(${a.turn} 80 60)`}>
          <circle cx="80" cy="60" r="50" fill={PAPER} />
          <circle cx="80" cy="60" r="39" fill="none" stroke={RIM} strokeWidth="2" />
          {/* side: a little heap of pieces */}
          <circle cx="62" cy="76" r="9" fill={a.side} />
          <circle cx="74" cy="82" r="8" fill={a.side} />
          <circle cx="56" cy="64" r="7" fill={a.side} />
          {/* main: two seared pieces */}
          <path d="M70 42c10-10 32-8 38 4s-4 22-18 22-26-14-20-26z" fill={a.main} />
          <path d="M86 70c8-4 20-2 22 6s-6 14-16 12-12-14-6-18z" fill={a.main} />
          <path d="M80 48c6-3 14-3 20 1M84 56c6-3 13-3 18 0" stroke="#000000" strokeOpacity="0.18" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <Leaves color={a.leaf} />
        </g>
      ) : (
        <g transform={`rotate(${a.turn / 3} 80 60)`}>
          <circle cx="80" cy="60" r="50" fill={PAPER} />
          <circle cx="80" cy="60" r="41" fill={a.main} />
          <circle cx="80" cy="60" r="41" fill="none" stroke="#000000" strokeOpacity="0.08" strokeWidth="6" />
          {/* a swirl of cream in the middle, toppings heaped to one side */}
          <path d="M80 60m-5 0a5 5 0 1 1 10 0a10 10 0 1 1-20 0a15 15 0 1 1 30 0" stroke={PAPER} strokeOpacity="0.5" strokeWidth="3" strokeLinecap="round" fill="none" />
          <circle cx="60" cy="74" r="6" fill={a.side} />
          <circle cx="69" cy="80" r="5" fill={a.side} />
          <circle cx="58" cy="84" r="4.5" fill={a.side} />
          <Leaves color={a.leaf} />
        </g>
      )}
    </svg>
  );
}

function Leaves({ color }: { color: string }) {
  return (
    <>
      <ellipse cx="96" cy="40" rx="7" ry="3.5" fill={color} transform="rotate(-30 96 40)" />
      <ellipse cx="104" cy="44" rx="6" ry="3" fill={color} transform="rotate(20 104 44)" />
      <ellipse cx="70" cy="60" rx="5" ry="2.5" fill={color} transform="rotate(50 70 60)" />
    </>
  );
}
