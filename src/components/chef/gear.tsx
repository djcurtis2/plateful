// Chef gear art, keyed by the item ids in GEAR (src/lib/avatar.ts). One entry per catalog item;
// an id with no entry simply draws nothing. Same 120×170 canvas and outline style as look.tsx.
import type { Slot } from "@/lib/avatar";
import { ARM_L, ARM_R, HAND_R, Legs, OUTLINE, STROKE, TORSO, type Skin } from "./look";

/** `id` prefixes gradient/clip ids with the chef's uid so many chefs can share a page. */
export type GearCtx = { id: (name: string) => string; skin: Skin };
type Draw = (c: GearCtx) => React.ReactNode;

/** Hats also say where they sit: hair above `hairClip` (y) is hidden under the hat. Omit for headbands. */
export type HatArt = { draw: Draw; hairClip?: number };

const o = { stroke: OUTLINE, strokeWidth: STROKE, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
const thin = { stroke: OUTLINE, strokeWidth: 1.6, strokeLinecap: "round" as const, fill: "none" };

const GOLD = "#F2B630";
const GOLD_LIGHT = "#FFE08A";
const GOLD_DARK = "#C98A12";
const GREEN = "#2F6B46";
const WHITE = "#FFFFFF";

const goldGradient = (id: string) => (
  <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stopColor={GOLD_LIGHT} />
    <stop offset="0.55" stopColor={GOLD} />
    <stop offset="1" stopColor={GOLD_DARK} />
  </linearGradient>
);

// ---------------------------------------------------------------------------
// Hats. The head's top is y 27; bands sit around y 26..38.

const toqueTall = "M40 28 39 15C28 15 28 3 38 3c4-4 12-3 14 0 4-3 12-3 16 0 2-3 10-4 14 0 10 0 10 12-1 12l-1 13z";
const toqueShort = "M37 29C27 27 28 12 40 14c4-8 36-8 40 0 12-2 13 13 3 15z";
const band = (fill: string) => <rect x={34} y={26} width={52} height={12} rx={4} fill={fill} />;

export const HATS: Record<string, HatArt> = {
  "paper-hat": {
    hairClip: 36,
    draw: () => (
      <g {...o}>
        <path d="M30 42 33 29Q60 13 87 29l3 13q-30-6-60 0z" fill={WHITE} />
        <path d="M32.5 36q27.5-6 55 0" stroke={GREEN} strokeWidth={2.6} />
        <path d="M60 18v18" {...thin} opacity={0.35} />
      </g>
    ),
  },
  bandana: {
    hairClip: 38,
    draw: () => (
      <g {...o}>
        <path d="M88 41l13-7-2 12z M89 44l11 8-7 3z" fill="#D64545" />
        <path d="M28 46q-2-22 32-24t32 24q-32-8-64 0z" fill="#D64545" />
        <circle cx={90} cy={43} r={4} fill="#D64545" />
        <g fill={WHITE} stroke="none">
          {[[42, 34], [54, 29], [66, 29], [78, 34], [48, 40], [60, 36], [72, 40], [36, 41], [84, 41]].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={1.8} />
          ))}
        </g>
      </g>
    ),
  },
  "prep-cap": {
    hairClip: 37,
    draw: () => (
      <g {...o}>
        <path d="M31 41Q28 19 60 19t29 22z" fill={GREEN} />
        <path d="M60 20v19 M45 23q-4 8-3 17 M75 23q4 8 3 17" {...thin} opacity={0.5} />
        <circle cx={60} cy={19} r={2.8} fill={GREEN} />
        <path d="M27 40q33-9 66 0q2 5-3 5.5q-30-6-60 0q-5-.5-3-5.5z" fill="#24543A" />
        <circle cx={60} cy={31} r={4.2} fill={GOLD} strokeWidth={2} />
      </g>
    ),
  },
  "sous-toque": {
    hairClip: 34,
    draw: () => (
      <g {...o}>
        <path d={toqueShort} fill={WHITE} />
        <path d="M50 15q-1 6 0 12 M70 15q1 6 0 12" {...thin} opacity={0.35} />
        {band(WHITE)}
      </g>
    ),
  },
  "tall-toque": {
    hairClip: 34,
    draw: () => (
      <g {...o}>
        <path d={toqueTall} fill={WHITE} />
        <path d="M49 15v12 M60 15v12 M71 15v12" {...thin} opacity={0.35} />
        {band(WHITE)}
      </g>
    ),
  },
  "golden-toque": {
    hairClip: 34,
    draw: (c) => (
      <g {...o}>
        <defs>{goldGradient(c.id("toque-gold"))}</defs>
        <path d={toqueTall} fill={`url(#${c.id("toque-gold")})`} />
        <path d="M49 15v12 M71 15v12" {...thin} opacity={0.35} />
        <path d="M44 6q4-2 7 0" stroke={WHITE} strokeWidth={2.4} opacity={0.7} />
        {band(GREEN)}
        <path d="m60 27.2 1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" fill={GOLD} strokeWidth={1.4} />
      </g>
    ),
  },
  "velvet-toque": {
    hairClip: 34,
    draw: (c) => (
      <g {...o}>
        <defs>
          <radialGradient id={c.id("velvet")} cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#A2508F" />
            <stop offset="1" stopColor="#5A2352" />
          </radialGradient>
        </defs>
        <path d={toqueShort} fill={`url(#${c.id("velvet")})`} />
        <path d="M50 15q-1 6 0 12 M70 15q1 6 0 12" {...thin} opacity={0.4} />
        {band(GOLD)}
        <path d="M38 32h44" stroke={GOLD_DARK} strokeWidth={1.6} />
      </g>
    ),
  },
  "silk-beret": {
    hairClip: 35,
    draw: () => (
      <g {...o}>
        <path d="M63 17q1-5 5-6" strokeWidth={3.4} />
        <path d="M30 38c-8-8 4-23 31-22 30 0 41 13 33 22-11 6-50 6-64 0z" fill="#C8324A" />
        <path d="M33 37.5q29 7 59 0" stroke="#8E1F33" strokeWidth={2.4} fill="none" />
        <path d="M44 22q12-4 26-1" stroke={WHITE} strokeWidth={2.6} opacity={0.45} fill="none" />
      </g>
    ),
  },
  "pizza-slice": {
    hairClip: 33,
    draw: () => (
      <g {...o}>
        <path d="M33 34 60 3l27 31z" fill="#F6C445" />
        <path d="M48 34q0 5 2.5 5t2.5-5 M67 34q0 4 2 4t2-4" fill="#F6C445" strokeWidth={2} />
        <g fill="#C0392B" strokeWidth={2}>
          <circle cx={60} cy={17} r={3.8} />
          <circle cx={51} cy={27} r={3.4} />
          <circle cx={69} cy={27.5} r={3.4} />
        </g>
        <path d="M30 32q30 8 60 0v5q-30 8-60 0z" fill="#D9973F" />
        <path d="M58 25h.1 M45 30h.1 M75 31h.1" stroke="#2F8F4A" strokeWidth={2.4} />
      </g>
    ),
  },
  "cat-ears": {
    draw: () => (
      <g {...o}>
        <path d="M46.7 29.5 30 12l4.2 27.9z M73.3 29.5 90 12l-4.2 27.9z" fill="#3A3A3A" />
        <path d="M43 31.5 34 21l2.4 15z M77 31.5 86 21l-2.4 15z" fill="#F29BB8" stroke="none" />
        <path d="M29.1 52A31.5 31.5 0 0 1 90.9 52" fill="none" strokeWidth={7} />
        <path d="M29.1 52A31.5 31.5 0 0 1 90.9 52" fill="none" stroke="#E05A8B" strokeWidth={3.4} />
      </g>
    ),
  },
};

// ---------------------------------------------------------------------------
// Outfits. Aprons sit on the base tee; jackets redraw sleeves and torso.

const apronPath = "M44 92h32v12q4 4 6 12l2 30q-24 6-48 0l2-30q2-8 6-12z";
const apron = (fill: string, extra?: Draw): Draw => (c) => (
  <g {...o}>
    <path d="M45 93q0-8 6-11 M75 93q0-8-6-11" fill="none" strokeWidth={6} />
    <path d="M45 93q0-8 6-11 M75 93q0-8-6-11" fill="none" stroke={fill} strokeWidth={2.4} />
    <path d={apronPath} fill={fill} />
    <path d="M38 112q22 3 44 0" fill="none" strokeWidth={2.4} opacity={0.5} />
    {extra?.(c)}
  </g>
);

const jacket = (fill: string, extra?: Draw): Draw => (c) => (
  <g {...o}>
    <ellipse {...ARM_L} ry={14} cy={109} fill={fill} />
    <ellipse {...ARM_R} ry={14} cy={109} fill={fill} />
    <rect {...TORSO} fill={fill} />
    {extra?.(c)}
  </g>
);

const chefJacket = (fill: string, button: string, trim: string): Draw =>
  jacket(fill, () => (
    <>
      <path d="M48 87q12 6 24 0l1 4q-13 7-26 0z" fill={fill} />
      <path d="M48 87q12 6 24 0" fill="none" stroke={trim} strokeWidth={1.6} />
      <path d="M50 92q14 3 22 7v38" fill="none" strokeWidth={2} />
      <g fill={button} strokeWidth={1.4}>
        {[100, 110, 120, 130].flatMap((y) => [<circle key={`l${y}`} cx={54} cy={y} r={2.2} />, <circle key={`r${y}`} cx={67} cy={y + 1} r={2.2} />])}
      </g>
      <path d="M24 119q7 3 14 0 M82 119q7 3 14 0" fill="none" stroke={trim} strokeWidth={2} />
    </>
  ));

const torsoClip = (c: GearCtx, name: string) => (
  <clipPath id={c.id(name)}>
    <rect {...TORSO} />
  </clipPath>
);

const hibiscus = (x: number, y: number) => (
  <g key={`${x}-${y}`}>
    {[0, 72, 144, 216, 288].map((a) => (
      <ellipse key={a} cx={x} cy={y - 3.2} rx={2.6} ry={3.4} fill="#F25F7A" transform={`rotate(${a} ${x} ${y})`} />
    ))}
    <circle cx={x} cy={y} r={1.4} fill="#FFE066" />
  </g>
);

export const OUTFITS: Record<string, Draw> = {
  "plain-apron": apron(GREEN, () => (
    <>
      <rect x={52} y={118} width={16} height={12} rx={3} fill="#285C3C" strokeWidth={2.4} />
      <path d="M48 97h24" stroke={GOLD} strokeWidth={2.6} />
    </>
  )),

  "hot-streak-apron": apron("#E4572E", () => (
    <>
      <path d="M37.5 146q0-11 4.5-8q0-11 7-6q2-10 7-2q4-12 8 0q5-8 7 2q7-5 7 6q5-3 4.5 8q-24 6-48 0z" fill="#F9C74F" stroke="none" />
      <path d="M45 146q1-6 4-4q1-6 5-1q3-7 6 0q3-5 5 1q4-2 4 4q-12 2-24 0z" fill="#FF9F1C" stroke="none" />
      <path d="M60 94q6 5 3 11q-1 3-3 3q-5 0-5-5q0-3 2-4q0 3 2 3q2-4 1-8z" fill="#F9C74F" strokeWidth={2} />
      <path d={apronPath} fill="none" />
    </>
  )),

  "money-apron": apron("#1F5E3A", () => (
    <>
      <path d="M47 95h26v9q4 4 6 12l2 27q-21 5-42 0l2-27q2-8 6-12z" fill="none" stroke={GOLD} strokeWidth={1.6} strokeDasharray="3 2.5" />
      <circle cx={60} cy={102} r={7.5} fill={GOLD} strokeWidth={2.4} />
      <path d="M63 98.5q-3-2-5.5-.5q-2 2 .5 3.5l4 1.3q2.5 1.2.5 3.2q-2.5 1.5-5.5-.5 M60 95.5v13" fill="none" stroke={GOLD_DARK} strokeWidth={1.8} />
      <g fill={GOLD} strokeWidth={1.8}>
        <ellipse cx={55} cy={128} rx={5} ry={2.4} />
        <ellipse cx={55} cy={125} rx={5} ry={2.4} />
        <ellipse cx={66} cy={128} rx={5} ry={2.4} />
      </g>
    </>
  )),

  "chef-whites": chefJacket(WHITE, OUTLINE, "#C9CED3"),

  "midnight-whites": chefJacket("#1E2A47", "#E8D9A8", "#C9B67A"),

  "winners-jacket": (c) =>
    jacket(`url(#${c.id("jacket-gold")})`, () => (
      <>
        <defs>{goldGradient(c.id("jacket-gold"))}</defs>
        <path d="M47 87 60 112 73 87h-6l-7 15-7-15z" fill={GREEN} />
        <path d="M53 87l7 15 7-15q-7 4-14 0z" fill={WHITE} strokeWidth={2} />
        <g fill={OUTLINE} stroke="none">
          <circle cx={60} cy={119} r={1.8} />
          <circle cx={60} cy={128} r={1.8} />
        </g>
        <path d="M70 108l-3 12 4-2 2 4 1-12 M76 108l1 12 2-4 4 2-3-12" fill={GREEN} strokeWidth={2} />
        <circle cx={73} cy={105} r={6} fill={GREEN} strokeWidth={2.4} />
        <circle cx={73} cy={105} r={3} fill={GOLD} strokeWidth={1.6} />
      </>
    ))(c),

  "hawaiian-shirt": (c) =>
    jacket("#2AA7A0", () => (
      <>
        {torsoClip(c, "hawaii")}
        <g clipPath={`url(#${c.id("hawaii")})`} stroke="none">
          {[[44, 98], [72, 104], [50, 122], [78, 128], [62, 112]].map(([x, y]) => (
            <ellipse key={`leaf${x}`} cx={x + 4} cy={y + 4} rx={2.4} ry={5} fill="#1B7A55" transform={`rotate(40 ${x + 4} ${y + 4})`} />
          ))}
          {[[44, 98], [72, 104], [50, 122], [78, 128], [62, 112]].map(([x, y]) => hibiscus(x, y))}
        </g>
        <path d="M24 108q7-3 14 0 M82 108q7-3 14 0" fill="none" stroke="#F25F7A" strokeWidth={2} />
        <path d="M48 87l12 12 12-12-4 9-8 4-8-4z" fill="#1E8A84" strokeWidth={2.4} />
        <path d="M60 100v37" fill="none" strokeWidth={2} />
        <rect {...TORSO} fill="none" />
      </>
    ))(c),

  tuxedo: (c) => (
    <g {...o}>
      <Legs fill="#23252B" />
      <path d="M50 134v20 M70 134v20" stroke="#4A4E58" strokeWidth={1.6} />
      {jacket("#23252B", () => (
        <>
          <path d="M48 86 60 122 72 86z" fill={WHITE} strokeWidth={2.4} />
          <path d="M47 87 58 117l-5 2-11-24z M73 87 62 117l5 2 11-24z" fill="#3A3E48" strokeWidth={2.4} />
          <path d="M53 88l7 4-7 4z M67 88l-7 4 7 4z" fill="#B3243A" strokeWidth={2} />
          <circle cx={60} cy={92} r={1.8} fill="#B3243A" strokeWidth={1.6} />
          <g fill={OUTLINE} stroke="none">
            <circle cx={60} cy={102} r={1.2} />
            <circle cx={60} cy={109} r={1.2} />
          </g>
          <path d="M70 101h6" stroke={WHITE} strokeWidth={2.4} />
        </>
      ))(c)}
    </g>
  ),

  "pj-set": (c) => (
    <g {...o}>
      {/* PJ trousers and fuzzy slippers replace the base legs and shoes. */}
      <rect x={43} y={132} width={14} height={24} rx={6} fill="#9CC7EA" />
      <rect x={63} y={132} width={14} height={24} rx={6} fill="#9CC7EA" />
      <path d="M39 163c0-7 4-9 10-9s10 2 10 9z M61 163c0-7 4-9 10-9s10 2 10 9z" fill="#F29BB8" />
      <path d="M44 156q5-3 10 0 M66 156q5-3 10 0" fill="none" stroke={WHITE} strokeWidth={2.4} />
      {jacket("#9CC7EA", () => (
        <>
          {torsoClip(c, "pj")}
          <g clipPath={`url(#${c.id("pj")})`}>
            <path d="M42 86v52 M50 86v52 M70 86v52 M78 86v52" stroke={WHITE} strokeWidth={2.4} opacity={0.8} />
          </g>
          <rect {...TORSO} fill="none" />
          <path d="M47 87l13 9 13-9 2 4-15 8-15-8z" fill="#3E6FA8" strokeWidth={2.2} />
          <path d="M60 99v38" fill="none" stroke="#3E6FA8" strokeWidth={2.4} />
          <g fill={WHITE} strokeWidth={1.4}>
            <circle cx={60} cy={108} r={1.8} />
            <circle cx={60} cy={119} r={1.8} />
            <circle cx={60} cy={130} r={1.8} />
          </g>
          <path d="m70 111 1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z" fill="#FFE066" strokeWidth={1.2} />
        </>
      ))(c)}
    </g>
  ),
};

// ---------------------------------------------------------------------------
// Tools, held in the right hand at (92, 127). Each ends with the fist on top of the handle.

const fist = (c: GearCtx) => (
  <g {...o}>
    <circle {...HAND_R} fill={c.skin.fill} />
    <path d="M87 125.5q5 1.5 10 0" fill="none" stroke={c.skin.shade} strokeWidth={2} />
  </g>
);
/** A handle as an outlined stick: dark outline under a colored core. */
const stick = (d: string, fill: string, w = 4.5) => (
  <>
    <path d={d} fill="none" stroke={OUTLINE} strokeWidth={w + 2 * STROKE} strokeLinecap="round" />
    <path d={d} fill="none" stroke={fill} strokeWidth={w} strokeLinecap="round" />
  </>
);
const tool = (draw: Draw): Draw => (c) => (
  <g>
    {draw(c)}
    {fist(c)}
  </g>
);

const WOOD = "#C68A4E";
const STEEL = "#D3D9DF";

export const TOOLS: Record<string, Draw> = {
  "wooden-spoon": tool(() => (
    <>
      {stick("M91 142 98 84", WOOD)}
      <ellipse cx={99.5} cy={72} rx={8} ry={11.5} fill={WOOD} {...o} transform="rotate(7 99.5 72)" />
      <ellipse cx={99} cy={70.5} rx={4} ry={6.5} fill="#A86F38" transform="rotate(7 99 70.5)" />
    </>
  )),

  "balloon-whisk": tool(() => (
    <>
      <g fill="none" strokeLinecap="round">
        <path d="M96 100C80 84 86 60 98 60s18 24-2 40 M96 100c-8-14-6-36 2-40s10 26-2 40" stroke={OUTLINE} strokeWidth={4.6} />
        <path d="M96 100C80 84 86 60 98 60s18 24-2 40 M96 100c-8-14-6-36 2-40s10 26-2 40" stroke="#E6EAEE" strokeWidth={1.8} />
      </g>
      {stick("M92 142 96 100", "#9AA4AE", 5.5)}
    </>
  )),

  "copper-pan": tool(() => (
    <>
      {stick("M92 136 99 98", "#7A4A2B", 5)}
      <circle cx={104} cy={82} r={15} fill="#C8743C" {...o} />
      <circle cx={104} cy={82} r={10.5} fill="#A35A2A" stroke="none" />
      <path d="M96 76q3-5 9-6" fill="none" stroke="#F3B58A" strokeWidth={2.4} strokeLinecap="round" />
      <circle cx={100.5} cy={95.5} r={1.4} fill={OUTLINE} />
    </>
  )),

  "piggy-bank": tool(() => (
    <g {...o}>
      <path d="M89 120l-1 5 M107 120l1 5" strokeWidth={5} />
      <path d="M84 105l-4-6 7 2z" fill="#F4A6B8" />
      <ellipse cx={98} cy={111} rx={14} ry={11} fill="#F4A6B8" />
      <path d="M90 101l-2-7 7 3z" fill="#F4A6B8" />
      <ellipse cx={111} cy={112} rx={3.6} ry={4.4} fill="#EE8AA2" strokeWidth={2.4} />
      <path d="M110 110.5v3 M112.4 110.5v3" stroke={OUTLINE} strokeWidth={1.4} />
      <circle cx={104} cy={106} r={1.6} fill={OUTLINE} stroke="none" />
      <path d="M93 101.5h8" strokeWidth={2.4} />
      <circle cx={97} cy={96} r={3.4} fill={GOLD} strokeWidth={2} />
    </g>
  )),

  "coin-jar": tool(() => (
    <g {...o}>
      <rect x={89} y={95} width={22} height={28} rx={6} fill="#DDEFF5" fillOpacity={0.9} />
      <g fill={GOLD} strokeWidth={1.6}>
        <ellipse cx={95} cy={118} rx={4.5} ry={2} />
        <ellipse cx={104} cy={118} rx={4.5} ry={2} />
        <ellipse cx={99.5} cy={114.5} rx={4.5} ry={2} />
        <ellipse cx={95} cy={111} rx={4.5} ry={2} />
        <ellipse cx={104.5} cy={110.5} rx={4.5} ry={2} />
      </g>
      <path d="M106 99v12" stroke={WHITE} strokeWidth={2.4} opacity={0.8} />
      <rect x={87} y={89} width={26} height={7} rx={2.5} fill="#B5643A" />
    </g>
  )),

  "silver-ladle": tool((c) => (
    <>
      <defs>
        <linearGradient id={c.id("silver")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F4F6F8" />
          <stop offset="1" stopColor="#99A3AD" />
        </linearGradient>
      </defs>
      {stick("M91 143 99 78", `url(#${c.id("silver")})`, 4)}
      <path d="M90 68q1 11 11 11t12-11z" fill={`url(#${c.id("silver")})`} {...o} />
      <path d="M95 71q1 4 5 5" fill="none" stroke={WHITE} strokeWidth={2} strokeLinecap="round" />
    </>
  )),

  "carbon-knife": tool(() => (
    <g {...o}>
      <path d="M88 121V93q2-14 10-21l-1 49z" fill="#3D4450" />
      <path d="M96.5 78 96 120" stroke="#C9D1DB" strokeWidth={2} />
      <rect x={87} y={119} width={11} height={4} rx={1.5} fill="#9AA4AE" strokeWidth={2} />
      <rect x={88.5} y={123} width={8} height={18} rx={3} fill="#1E1E22" />
      <circle cx={92.5} cy={137} r={1} fill={STEEL} stroke="none" />
    </g>
  )),

  "rubber-chicken": tool(() => (
    <g {...o}>
      <path d="M88 132l-3 9m3-9 1 10 M96 132l1 10m-1-10 4 8" stroke="#F28C28" strokeWidth={2.6} />
      <path d="M93 72c-6 0-8 6-6 11 3 7-5 18-2 30 2 9 13 9 15-1 2-11-4-23 0-31 3-6 0-9-7-9z" fill="#F7D23E" />
      <path d="M90 67q0-4 3-3 0-4 3-2 2-3 4 1 2 3-3 4z" fill="#E0413A" strokeWidth={2} />
      <path d="M99 74l7 2-6 3z" fill="#F28C28" strokeWidth={2} />
      <path d="M91.5 73.5l3 3m0-3-3 3" strokeWidth={1.6} />
      <path d="M90 100q4 4 9 1" fill="none" strokeWidth={2} />
    </g>
  )),

  "giant-fork": tool(() => (
    <>
      {stick("M91 143 96 98", STEEL, 5.5)}
      <path d="M85 92q0 10 11 10t11-10V64h-4v26h-3.5V60h-4v30H92V64h-4v26h-3z" fill={STEEL} {...o} />
    </>
  )),

  "flame-torch": tool(() => (
    <g {...o}>
      <path d="M96 104V94q0-4 4-4h4" fill="none" strokeWidth={7} />
      <path d="M96 104V94q0-4 4-4h4" fill="none" stroke="#9AA4AE" strokeWidth={3} />
      <path d="M106 90c4-1 8-6 7-12 3 3 4 6 3 9 2-1 3-3 3-5 2 5-1 11-7 11h-6z" fill="#F89A1C" strokeWidth={2.2} />
      <path d="M107 90c3-1 5-4 5-7 2 2 3 5 1 7z" fill="#5AB0F5" stroke="none" />
      <rect x={86} y={103} width={14} height={30} rx={5} fill="#D9483B" />
      <path d="M86 112h14" strokeWidth={2} />
      <path d="M90 108v20" stroke={WHITE} strokeWidth={2} opacity={0.5} />
    </g>
  )),
};

// ---------------------------------------------------------------------------
// Backgrounds: full 120×170 scenes. Keep something interesting in the top half for head crops.

const W = 120;
const H = 170;

export const BACKGROUNDS: Record<string, Draw> = {
  "kitchen-tile": (c) => (
    <g>
      <defs>
        <pattern id={c.id("tile")} width={20} height={20} patternUnits="userSpaceOnUse">
          <path d="M0 .75h20 M0 10.75h20 M.75 0v10 M10.75 10v10" stroke={WHITE} strokeWidth={1.5} />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="#DCEBE0" />
      <rect width={W} height={150} fill={`url(#${c.id("tile")})`} />
      <rect y={148} width={W} height={22} fill="#B9D3C1" />
      <path d="M0 148h120" stroke="#8FB49C" strokeWidth={2} />
    </g>
  ),

  "busy-line": (c) => (
    <g>
      <defs>
        <radialGradient id={c.id("lamp")}>
          <stop offset="0" stopColor="#FFB347" stopOpacity={0.75} />
          <stop offset="1" stopColor="#FFB347" stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill="#2F343B" />
      <path d="M20 0v120 M60 0v120 M100 0v120" stroke="#3A4048" strokeWidth={2} />
      <ellipse cx={18} cy={56} rx={26} ry={34} fill={`url(#${c.id("lamp")})`} />
      <ellipse cx={102} cy={56} rx={26} ry={34} fill={`url(#${c.id("lamp")})`} />
      <rect y={8} width={W} height={3} fill="#9AA4AE" />
      {[[4, -3], [22, 4], [92, -4], [106, 3]].map(([x, r]) => (
        <g key={x} transform={`rotate(${r} ${x + 6} 10)`}>
          <rect x={x} y={9} width={12} height={17} rx={1} fill="#F7F3E8" stroke={OUTLINE} strokeWidth={1.4} />
          <path d={`M${x + 2.5} 14h7 M${x + 2.5} 17.5h5 M${x + 2.5} 21h6`} stroke="#B3243A" strokeWidth={1.2} />
        </g>
      ))}
      <rect y={118} width={W} height={8} fill="#7D8792" />
      <rect y={126} width={W} height={44} fill="#454C55" />
      <path d="M8 118q2-8 6-4 1-6 4 0 3-4 4 4z M100 118q2-7 5-3 2-6 5 0 3-3 4 3z" fill="#F89A1C" />
    </g>
  ),

  spotlight: (c) => (
    <g>
      <defs>
        <linearGradient id={c.id("beam")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={GOLD_LIGHT} stopOpacity={0.85} />
          <stop offset="1" stopColor={GOLD_LIGHT} stopOpacity={0.25} />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="#1B1630" />
      <path d="M46 0h28l38 160H8z" fill={`url(#${c.id("beam")})`} />
      <ellipse cx={60} cy={161} rx={50} ry={9} fill={GOLD} opacity={0.55} />
      <g fill={GOLD_LIGHT}>
        {[[10, 20], [108, 14], [16, 96], [104, 110], [6, 140], [114, 70]].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={1.3} />
        ))}
      </g>
    </g>
  ),

  "dinner-party": () => (
    <g>
      <rect width={W} height={H} fill="#7A3B4B" />
      <path d="M0 0v170 M24 0v170 M48 0v170 M72 0v170 M96 0v170" stroke="#84455A" strokeWidth={10} />
      <path d="M-2 10q31 22 62 4t62 4" fill="none" stroke={OUTLINE} strokeWidth={1.4} />
      {[[8, 15, "#FFE066"], [22, 22, "#F25F7A"], [38, 22, "#7FD1AE"], [84, 19, "#7FD1AE"], [98, 17, "#F25F7A"], [112, 16, "#FFE066"]].map(([x, y, f]) => (
        <circle key={x} cx={x} cy={(y as number) + 3} r={3.2} fill={f as string} stroke={OUTLINE} strokeWidth={1.2} />
      ))}
      <rect y={140} width={W} height={30} fill="#F7F3E8" />
      <path d="M0 140h120" stroke={OUTLINE} strokeWidth={2} />
      <path d="M0 150q15 4 30 0t30 0 30 0 30 0" fill="none" stroke="#E2D8C4" strokeWidth={2} />
      {[12, 108].map((x) => (
        <g key={x} stroke={OUTLINE} strokeWidth={1.6}>
          <rect x={x - 2.5} y={124} width={5} height={16} fill="#F7F3E8" />
          <path d={`M${x} 115q4 4 0 8q-4-4 0-8z`} fill={GOLD} />
        </g>
      ))}
    </g>
  ),

  "marble-counter": () => (
    <g>
      <rect width={W} height={H} fill="#F3F1EC" />
      <path d="M-5 30q30 10 45-6t50 8 40-10 M-5 90q20-14 40-2t35 0 55 10 M10 0q8 20 2 40t10 50 M100 0q-6 30 6 60" fill="none" stroke="#C9C4BA" strokeWidth={1.4} />
      <path d="M30 60q14 4 22-4 M76 120q10-8 26-2" fill="none" stroke="#DAD5CC" strokeWidth={1} />
      <rect y={146} width={W} height={24} fill="#E3DFD7" />
      <path d="M0 146h120" stroke="#B8B2A6" strokeWidth={2} />
      <path d="M8 156q20 6 40-2t40 4 30-2" fill="none" stroke="#CFC9BF" strokeWidth={1.2} />
    </g>
  ),

  "beach-day": () => (
    <g>
      <rect width={W} height={H} fill="#8FD3F4" />
      <circle cx={100} cy={22} r={12} fill="#FFD166" stroke={OUTLINE} strokeWidth={2} />
      <path d="M12 30q4-6 10-2 4-5 10 0 5 0 4 4H12z" fill={WHITE} stroke={OUTLINE} strokeWidth={1.4} />
      <rect y={108} width={W} height={24} fill="#3BA6D9" />
      <path d="M4 116q4-3 8 0t8 0 M44 122q4-3 8 0t8 0 M88 114q4-3 8 0t8 0" fill="none" stroke={WHITE} strokeWidth={1.6} strokeLinecap="round" />
      <path d="M0 128q30-6 60 0t60 0v42H0z" fill="#F3D9A4" />
      <path d="M8 150h.1 M30 160h.1 M98 154h.1 M112 164h.1" stroke="#D9B878" strokeWidth={2.6} strokeLinecap="round" />
    </g>
  ),

  "disco-floor": (c) => (
    <g>
      <defs>
        <pattern id={c.id("floor")} width={24} height={16} patternUnits="userSpaceOnUse">
          <rect width={12} height={8} fill="#F25F9A" />
          <rect x={12} width={12} height={8} fill="#5AD1E8" />
          <rect y={8} width={12} height={8} fill="#FFE066" />
          <rect x={12} y={8} width={12} height={8} fill="#8E5BD8" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="#2E1747" />
      <path d="M20 22 0 100V60z M20 22l40 90h-24z M20 22l100 40v30z" fill="#FFFFFF" opacity={0.12} />
      <path d="M20 22 120 120V96z" fill="#F25F9A" opacity={0.18} />
      <path d="M20 0v11" stroke="#9AA4AE" strokeWidth={1.4} />
      <circle cx={20} cy={22} r={11} fill="#C9D1DB" stroke={OUTLINE} strokeWidth={2} />
      <path d="M9 22h22 M11 16h18 M11 28h18 M20 11v22 M14 12.5v19 M26 12.5v19" stroke="#8C96A1" strokeWidth={1} />
      <rect x={14} y={15} width={4} height={4} fill={WHITE} />
      <rect y={134} width={W} height={36} fill={`url(#${c.id("floor")})`} opacity={0.85} />
      <path d="M0 134h120" stroke={OUTLINE} strokeWidth={2} />
    </g>
  ),
};

/** Where legendary sparkles go per slot: [x, y, size]. */
export const SPARKLES: Record<Slot, [number, number, number][]> = {
  hat: [[94, 12, 5], [26, 20, 3.5], [84, 2.5, 2.5]],
  outfit: [[23, 92, 4], [98, 100, 3]],
  tool: [[113, 62, 4.5], [114, 98, 3]],
  background: [[24, 8, 4], [104, 46, 3], [12, 118, 3.5]],
};
