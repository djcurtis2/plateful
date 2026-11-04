// Little pictures of each daily game. Fixed ink and paper colors: they sit on the colored panel in light and dark.
// Hovering a card plays one move of its game (styles in globals.css). Decoration only.
const INK = "#1b2a22";
const PAPER = "#ffffff";
const GREY = "#dfe4da";

export type GameArtKind = "dish" | "higher-lower" | "trivia" | "bingo";

export function GameArt({ kind }: { kind: GameArtKind }) {
  return (
    <svg viewBox="0 0 320 128" className="relative h-full w-full" aria-hidden>
      {kind === "dish" && <Dish />}
      {kind === "higher-lower" && <HigherLower />}
      {kind === "trivia" && <Trivia />}
      {kind === "bingo" && <Bingo />}
    </svg>
  );
}

/** A blurry plate under a magnifying glass; it sharpens on hover, like a right guess. */
function Dish() {
  return (
    <>
      <circle cx="150" cy="64" r="54" fill={PAPER} />
      <circle cx="150" cy="64" r="41" fill={GREY} />
      <g className="scene-blur">
        <path d="M122 72c10-20 22 8 32-10s20 6 26-6" fill="none" stroke="#f2b630" strokeWidth="9" strokeLinecap="round" />
        <path d="M124 56c12-14 20 6 30-6s18 2 22-2" fill="none" stroke="#e39a1f" strokeWidth="7" strokeLinecap="round" />
        <circle cx="136" cy="82" r="8" fill="#c23b2a" />
        <circle cx="168" cy="80" r="6" fill="#c23b2a" />
        <ellipse cx="152" cy="42" rx="11" ry="5" fill="#2f6b46" transform="rotate(-24 152 42)" />
      </g>
      <circle cx="202" cy="84" r="23" fill="#ffffff" fillOpacity="0.2" stroke={INK} strokeWidth="6" />
      <path d="M219 101l18 18" stroke={INK} strokeWidth="9" strokeLinecap="round" />
    </>
  );
}

/** Two price tags, one hidden, with the arrows pulling apart on hover. */
function HigherLower() {
  return (
    <>
      <PriceTag x={62} tilt={-5} text="$14" />
      <g className="scene-up">
        <path d="M160 58V34m-11 11l11-11 11 11" fill="none" stroke={INK} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g className="scene-down">
        <path d="M160 70v24m-11-11l11 11 11-11" fill="none" stroke={INK} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <PriceTag x={182} tilt={5} text="?" />
    </>
  );
}

function PriceTag({ x, tilt, text }: { x: number; tilt: number; text: string }) {
  return (
    <g transform={`rotate(${tilt} ${x + 38} 64)`}>
      <path d={`M${x + 14} 30h48a8 8 0 0 1 8 8v52a8 8 0 0 1-8 8h-48a8 8 0 0 1-6-3l-8-10V43l8-10a8 8 0 0 1 6-3z`} fill={PAPER} />
      <circle cx={x + 14} cy="64" r="4" fill={GREY} />
      <text x={x + 41} y="74" textAnchor="middle" fontSize="28" fontWeight="800" fill={INK} className="font-display">
        {text}
      </text>
    </g>
  );
}

/** Three answers; the right one lights up on hover. */
function Trivia() {
  return (
    <>
      <text x="82" y="102" textAnchor="middle" fontSize="96" fontWeight="800" fill={INK} className="font-display">
        ?
      </text>
      {["A", "B", "C"].map((letter, i) => {
        const y = 20 + i * 32;
        const right = i === 1;
        return (
          <g key={letter}>
            <rect x="124" y={y} width="150" height="26" rx="13" fill={PAPER} />
            {right && <rect className="scene-show" x="124" y={y} width="150" height="26" rx="13" fill="#2f6b46" />}
            <circle cx="137" cy={y + 13} r="9" fill={GREY} />
            <text x="137" y={y + 17} textAnchor="middle" fontSize="11" fontWeight="800" fill={INK} className="font-display">
              {letter}
            </text>
            <rect x="154" y={y + 10} width={[92, 76, 100][i]} height="6" rx="3" fill={GREY} />
          </g>
        );
      })}
    </>
  );
}

/** A bingo card one square short of a line; the last square ticks on hover. */
function Bingo() {
  const ticked = new Set([0, 3, 5, 10, 13]);
  const size = 24;
  const gap = 3;
  const left = 160 - (size * 4 + gap * 3) / 2;
  const top = 64 - (size * 4 + gap * 3) / 2;
  return (
    <>
      <rect x={left - 7} y={top - 7} width={size * 4 + gap * 3 + 14} height={size * 4 + gap * 3 + 14} rx="12" fill={PAPER} />
      {Array.from({ length: 16 }, (_, i) => {
        const x = left + (i % 4) * (size + gap);
        const y = top + Math.floor(i / 4) * (size + gap);
        const tick = <path d={`M${x + 7} ${y + 12.5}l4 4 7-8`} fill="none" stroke={PAPER} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />;
        return (
          <g key={i}>
            <rect x={x} y={y} width={size} height={size} rx="5" fill={ticked.has(i) ? INK : GREY} />
            {ticked.has(i) && tick}
            {i === 15 && (
              <g className="scene-show">
                <rect x={x} y={y} width={size} height={size} rx="5" fill={INK} />
                {tick}
              </g>
            )}
          </g>
        );
      })}
    </>
  );
}
