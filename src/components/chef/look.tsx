// Chef look parts: the free choices (skin, face, hair, facial hair, glasses) and the bare body.
// Index i in each list is look option i in src/lib/avatar.ts (LOOK_OPTIONS counts must match).
// Canvas is 120×170: head circle at (60, 58) r 31, torso 35..85 × 86..138, right hand at (92, 127).
import type { LookPart } from "@/lib/avatar";

export const OUTLINE = "#2b2b2b";
export const STROKE = 3;

export type Skin = { name: string; fill: string; shade: string };
export type HairColor = { name: string; fill: string; brow: string };
type Named = { name: string };
type Part<A> = Named & { draw: (a: A) => React.ReactNode };

/** What every look part draws from. */
export type LookCtx = { skin: Skin; hair: HairColor };

// Inclusive range, lightest to deepest. `shade` is for the nose and inner ears.
export const SKINS: Skin[] = [
  { name: "Porcelain", fill: "#FCE3D3", shade: "#E5B9A0" },
  { name: "Peach", fill: "#F4CBA6", shade: "#D9A47C" },
  { name: "Sand", fill: "#E6B387", shade: "#C88F62" },
  { name: "Honey", fill: "#D19A69", shade: "#B07A4C" },
  { name: "Caramel", fill: "#B67B4C", shade: "#935D34" },
  { name: "Chestnut", fill: "#965F38", shade: "#784727" },
  { name: "Cocoa", fill: "#774A2C", shade: "#5C351D" },
  { name: "Espresso", fill: "#57341F", shade: "#3E2414" },
];

export const HAIR_COLORS: HairColor[] = [
  { name: "Black", fill: "#26211F", brow: "#1C1817" },
  { name: "Dark brown", fill: "#4B2F20", brow: "#3A2418" },
  { name: "Brown", fill: "#7C4B2A", brow: "#5C361D" },
  { name: "Auburn", fill: "#9E3F25", brow: "#77301C" },
  { name: "Ginger", fill: "#D9782F", brow: "#A9561D" },
  { name: "Blonde", fill: "#EAC46B", brow: "#B8913F" },
  { name: "Silver", fill: "#B9BCC2", brow: "#8A8E96" },
  { name: "Berry", fill: "#B63F78", brow: "#86295A" },
];

const o = { stroke: OUTLINE, strokeWidth: STROKE, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

// ---------------------------------------------------------------------------
// Body (layer 2) and head (layer 4).

export const TEE = "#F1ECE4";
export const TROUSERS = "#3B4A5A";

/** Left and right sleeves, at the shoulders. Outfits reuse these so jackets line up. */
export const ARM_L = { cx: 31, cy: 110, rx: 9, ry: 15, transform: "rotate(10 31 110)" };
export const ARM_R = { cx: 89, cy: 110, rx: 9, ry: 15, transform: "rotate(-10 89 110)" };
export const TORSO = { x: 35, y: 86, width: 50, height: 52, rx: 18 };
export const HAND_R = { cx: 92, cy: 127, r: 7 };
const HAND_L = { cx: 28, cy: 127, r: 7 };

export function Legs({ fill = TROUSERS }: { fill?: string }) {
  return (
    <g {...o}>
      <rect x={43} y={132} width={14} height={24} rx={6} fill={fill} />
      <rect x={63} y={132} width={14} height={24} rx={6} fill={fill} />
    </g>
  );
}

export function Body({ skin }: { skin: Skin }) {
  return (
    <g {...o}>
      <Legs />
      <path d="M40 162c0-6 4-8 9-8s9 2 9 8z M62 162c0-6 4-8 9-8s9 2 9 8z" fill="#3A3A3A" />
      <ellipse {...ARM_L} fill={TEE} />
      <ellipse {...ARM_R} fill={TEE} />
      <rect {...TORSO} fill={TEE} />
      <path d="M50 88q10 6 20 0" fill="none" strokeWidth={2} />
      <circle {...HAND_L} fill={skin.fill} />
      <circle {...HAND_R} fill={skin.fill} />
    </g>
  );
}

export function Head({ skin }: { skin: Skin }) {
  return (
    <g {...o}>
      <circle cx={29} cy={62} r={6} fill={skin.fill} />
      <circle cx={91} cy={62} r={6} fill={skin.fill} />
      <path d="M28 59.5q-2 2.5 0 5 M92 59.5q2 2.5 0 5" fill="none" stroke={skin.shade} strokeWidth={2} />
      <circle cx={60} cy={58} r={31} fill={skin.fill} />
    </g>
  );
}

/** Nose and cheeks: same on every face, drawn before eyes/brows/mouth. */
export function FaceBase({ skin }: { skin: Skin }) {
  return (
    <g>
      <circle cx={40} cy={71} r={5} fill="#F07F7F" opacity={0.35} />
      <circle cx={80} cy={71} r={5} fill="#F07F7F" opacity={0.35} />
      <path d="M57.5 66.5q2.5 2.5 5 0" fill="none" stroke={skin.shade} strokeWidth={2.5} strokeLinecap="round" />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Eyes (centers at x 48 and 72, y 61).

const EYE_X = [48, 72];
const EYE_Y = 61;
const dot = (x: number, r = 5.4) => (
  <>
    <circle cx={x} cy={EYE_Y} r={r} fill={OUTLINE} />
    <circle cx={x + r * 0.35} cy={EYE_Y - r * 0.35} r={r * 0.33} fill="#fff" />
  </>
);
const happy = (x: number) => <path d={`M${x - 5} ${EYE_Y + 1.5}q5-7 10 0`} fill="none" {...o} />;

export const EYES: Part<LookCtx>[] = [
  { name: "Round", draw: () => <>{EYE_X.map((x) => <g key={x}>{dot(x)}</g>)}</> },
  {
    name: "Sparkly",
    draw: () => (
      <>
        {EYE_X.map((x) => (
          <g key={x}>
            <circle cx={x} cy={EYE_Y} r={6.6} fill={OUTLINE} />
            <circle cx={x + 2.2} cy={EYE_Y - 2.2} r={2.3} fill="#fff" />
            <circle cx={x - 2.2} cy={EYE_Y + 2.4} r={1.1} fill="#fff" />
          </g>
        ))}
      </>
    ),
  },
  { name: "Happy", draw: () => <>{EYE_X.map((x) => <g key={x}>{happy(x)}</g>)}</> },
  {
    name: "Sleepy",
    draw: () => (
      <>
        {EYE_X.map((x) => (
          <g key={x}>
            <path d={`M${x - 5.5} ${EYE_Y - 0.5}a5.5 5.5 0 0 0 11 0z`} fill={OUTLINE} />
            <path d={`M${x - 6.5} ${EYE_Y - 0.5}h13`} {...o} strokeWidth={2.6} />
          </g>
        ))}
      </>
    ),
  },
  {
    name: "Wink",
    draw: () => (
      <>
        {dot(48)}
        <path d={`M67 ${EYE_Y}q5 4 10 0`} fill="none" {...o} />
      </>
    ),
  },
  {
    name: "Lashes",
    draw: () => (
      <>
        {dot(48, 5)}
        {dot(72, 5)}
        <path d="M44 57.5l-3.5-3 M45.8 55.8l-2-3.6 M76 57.5l3.5-3 M74.2 55.8l2-3.6" {...o} strokeWidth={2} />
      </>
    ),
  },
];

// ---------------------------------------------------------------------------
// Brows (in the hair color's darker brow tone).

const brow = (d: string, w = 3.2) => (h: LookCtx) => <path d={d} fill="none" stroke={h.hair.brow} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />;

export const BROWS: Part<LookCtx>[] = [
  { name: "Soft", draw: brow("M42 50q6-4 12-1.5 M66 48.5q6-2.5 12 1.5") },
  { name: "Bold", draw: brow("M42 49l12-1.5 M66 47.5l12 1.5", 4.6) },
  { name: "Arched", draw: brow("M42 49q5-7 12-3 M66 46q7-4 12 3") },
  { name: "Determined", draw: brow("M42 45.5l12 3.5 M66 49l12-3.5", 3.8) },
];

// ---------------------------------------------------------------------------
// Mouths (around x 60, y 75).

const TONGUE = "#E8707A";
const INSIDE = "#5A1F22";

export const MOUTHS: Part<LookCtx>[] = [
  { name: "Smile", draw: () => <path d="M51 73q9 8 18 0" fill="none" {...o} /> },
  {
    name: "Grin",
    draw: () => (
      <g {...o} strokeWidth={2.6}>
        <path d="M49 71h22q0 14-11 14t-11-14z" fill={INSIDE} />
        <path d="M51 72.5h18q-.5 3.5-2 4h-14q-1.5-.5-2-4z" fill="#fff" stroke="none" />
        <ellipse cx={60} cy={81.5} rx={5} ry={2.5} fill={TONGUE} stroke="none" />
      </g>
    ),
  },
  { name: "Oh", draw: () => <ellipse cx={60} cy={76} rx={4} ry={5} fill={INSIDE} {...o} strokeWidth={2.6} /> },
  { name: "Smirk", draw: () => <path d="M52 76q9 3 17-4 M68.5 70.5l1.5 3" fill="none" {...o} /> },
  {
    name: "Cheeky",
    draw: () => (
      <g {...o}>
        <path d="M56 76.5q0 6.5 4 6.5t4-6.5z" fill={TONGUE} strokeWidth={2.4} />
        <path d="M60 77v3" strokeWidth={1.5} stroke="#B84A55" />
        <path d="M51 73q9 7 18 0" fill="none" />
      </g>
    ),
  },
  {
    name: "Toothy",
    draw: () => (
      <g {...o} strokeWidth={2.6}>
        <rect x={50} y={71} width={20} height={9} rx={4.5} fill="#fff" />
        <path d="M51 75.5h18 M56.5 71.5v8 M63.5 71.5v8" strokeWidth={1.4} />
      </g>
    ),
  },
];

// ---------------------------------------------------------------------------
// Hair. Drawn after the face; the hat layer clips it above the hat's brim, so every style
// tucks under every hat. "Crop" and "Buzz"-like shapes are built to show sideburns below a band.

const hairPath = (d: string, extra?: (c: LookCtx) => React.ReactNode) => (c: LookCtx) => (
  <g {...o}>
    <path d={d} fill={c.hair.fill} />
    {extra?.(c)}
  </g>
);

const texture = { fill: "none", stroke: OUTLINE, strokeWidth: 1.6, strokeLinecap: "round" as const, opacity: 0.45 };

// Curls: overlapping circles around the crown; their outlines read as curls.
const CURLS = Array.from({ length: 9 }, (_, i) => {
  const a = ((196 + i * 18.5) * Math.PI) / 180;
  return { cx: +(60 + 29 * Math.cos(a)).toFixed(1), cy: +(55 + 29 * Math.sin(a)).toFixed(1) };
});

export const HAIRS: Part<LookCtx>[] = [
  {
    name: "Bald",
    draw: () => <path d="M43 36q6-5 13-5.5" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" opacity={0.5} />,
  },
  {
    name: "Crop",
    draw: hairPath("M27 57C25 34 40 22 60 23s35 11 33 34h-6q-1-11-11-15q-9 3-18-1q-9 4-18 1q-6 4-7 15z"),
  },
  {
    name: "Side swoop",
    draw: hairPath("M27 58C25 32 42 21 62 22s34 14 31 36h-6q-2-12-9-14q-18 2-32-8q-6 8-14 22z", () => (
      <path d="M50 30q14 9 30 8" {...texture} />
    )),
  },
  {
    name: "Curls",
    draw: (c) => (
      <g {...o} strokeWidth={2.6}>
        <path d="M29 56C27 34 42 25 60 25s33 9 31 31z" fill={c.hair.fill} stroke="none" />
        {CURLS.map((p) => (
          <circle key={`${p.cx},${p.cy}`} cx={p.cx} cy={p.cy} r={8.5} fill={c.hair.fill} />
        ))}
      </g>
    ),
  },
  {
    name: "Long",
    draw: hairPath("M22 99C17 70 20 30 60 23s43 47 38 76H86c2-18 2-36 0-46q-8-12-26-12t-26 12c-2 10-2 28 0 46z", () => (
      <path d="M60 25q-6 6-8 15" {...texture} />
    )),
  },
  {
    name: "Bob",
    draw: hairPath("M24 82C18 52 30 22 60 23s42 29 36 59q-5 4-10 0c2-12 2-22 0-32v-7q-26 3-52 0v7c-2 10-2 20 0 32q-5 4-10 0z"),
  },
  {
    name: "Top bun",
    draw: (c) => (
      <g {...o}>
        <circle cx={60} cy={19} r={10.5} fill={c.hair.fill} />
        <path d="M54 27.5q6 3 12 0" stroke="#F2B630" strokeWidth={3.5} />
        <path d="M28 56C26 35 40 25 60 25s34 10 32 31h-5q-4-14-27-16q-23 2-27 16z" fill={c.hair.fill} />
        <path d="M44 34q8-5 16-5 M76 34q-8-5-16-5" {...texture} />
      </g>
    ),
  },
  {
    name: "Afro",
    draw: hairPath("M25 68C14 40 30 7 60 7s46 33 35 61q-3-2-6-1c1-16-6-26-16-27q-13 3-26 0c-10 1-17 11-16 27q-3-1-6 1z", () => (
      <path d="M38 20q3 3 0 6 M60 13q3 3 0 6 M82 20q3 3 0 6 M30 36q3 3 0 6 M90 36q3 3 0 6 M49 29q3 3 0 6 M71 29q3 3 0 6" {...texture} />
    )),
  },
  {
    name: "Braids",
    draw: (c) => (
      <g {...o} strokeWidth={2.6}>
        {[28, 92].map((x) => (
          <g key={x}>
            {[62, 72, 82, 92].map((y) => (
              <ellipse key={y} cx={x} cy={y} rx={6} ry={6.2} fill={c.hair.fill} />
            ))}
            <rect x={x - 4} y={97} width={8} height={4} rx={2} fill="#F2B630" />
            <path d={`M${x - 3} 101q3 6 6 0z`} fill={c.hair.fill} />
          </g>
        ))}
        <path d="M27 58C25 32 42 22 60 23s35 9 33 35l-6-2q-3-14-25-18l-2 3-2-3q-22 4-25 18z" fill={c.hair.fill} strokeWidth={STROKE} />
      </g>
    ),
  },
  {
    name: "Spiky",
    draw: hairPath("M28 56l-3-15 9-3-1-12 11 4 4-15 9 10 7-13 6 12 10-8 2 12 10-2-3 12 6 4-3 14h-5q-2-12-13-14l-6 4-6-5-8 4-6-4q-11 2-13 14z"),
  },
];

// ---------------------------------------------------------------------------
// Facial hair (in the hair color). Option 0 is none.

const mustache = "M60 70.5q-7-3.5-13-.5q-3 4 2 4.5q6-.5 11-2.5q5 2 11 2.5q5-.5 2-4.5q-6-3-13 .5z";

export const FACIAL_HAIRS: Part<LookCtx>[] = [
  { name: "None", draw: () => null },
  { name: "Mustache", draw: hairPath(mustache) },
  {
    name: "Full beard",
    draw: (c) => (
      <g {...o}>
        <path d="M29.5 55c-1 25 12 42 30.5 42s31.5-17 30.5-42h-5c-1 14-7 25-15.5 25q-10 4-20 0c-8.5 0-14.5-11-15.5-25z" fill={c.hair.fill} />
        <path d={mustache} fill={c.hair.fill} />
      </g>
    ),
  },
  {
    name: "Goatee",
    draw: (c) => (
      <g {...o}>
        <path d="M53 85q7-2 14 0q-1 8-7 9t-7-9z" fill={c.hair.fill} />
        <path d={mustache} fill={c.hair.fill} />
      </g>
    ),
  },
];

// ---------------------------------------------------------------------------
// Glasses. Option 0 is none.

const LENS = { fill: "#fff", fillOpacity: 0.22 };

export const GLASSES: Part<LookCtx>[] = [
  { name: "None", draw: () => null },
  {
    name: "Round",
    draw: () => (
      <g {...o} strokeWidth={2.6} fill="none">
        <circle cx={48} cy={61} r={8.5} {...LENS} />
        <circle cx={72} cy={61} r={8.5} {...LENS} />
        <path d="M56.5 60q3.5-3 7 0 M39.5 59.5l-9-2.5 M80.5 59.5l9-2.5" />
      </g>
    ),
  },
  {
    name: "Bold frames",
    draw: () => (
      <g {...o} stroke="#8B2E2E" strokeWidth={3.4} fill="none">
        <rect x={38} y={54} width={20} height={14} rx={4} {...LENS} />
        <rect x={62} y={54} width={20} height={14} rx={4} {...LENS} />
        <path d="M58 59h4 M38 58l-8-2 M82 58l8-2" />
      </g>
    ),
  },
  {
    name: "Shades",
    draw: () => (
      <g {...o} strokeWidth={2.6}>
        <path d="M37 55h22q0 13-11 13t-11-13z M61 55h22q0 13-11 13t-11-13z" fill="#1D2430" />
        <path d="M59 57.5q1-1.5 2 0 M37 56l-7-1.5 M83 56l7-1.5" fill="none" />
        <path d="M41 58.5l4-1.5 M65 58.5l4-1.5" stroke="#fff" strokeWidth={2} opacity={0.6} />
      </g>
    ),
  },
];

/** Names per look option, in index order, for pickers and the admin art sheet. */
export const LOOK_NAMES: Record<LookPart, string[]> = {
  skin: SKINS.map((s) => s.name),
  eyes: EYES.map((p) => p.name),
  brows: BROWS.map((p) => p.name),
  mouth: MOUTHS.map((p) => p.name),
  hair: HAIRS.map((p) => p.name),
  hairColor: HAIR_COLORS.map((h) => h.name),
  facialHair: FACIAL_HAIRS.map((p) => p.name),
  glasses: GLASSES.map((p) => p.name),
};
