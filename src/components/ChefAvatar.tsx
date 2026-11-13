// A layered cartoon chef drawn from saved avatar data. Plain inline SVG with no hooks, so it renders in
// server and client components. Art lives in ./chef/look.tsx (free look parts) and ./chef/gear.tsx
// (catalog items, keyed by gear id). Layers, back to front, follow the design spec.
import { GEAR_BY_ID, type Avatar, type GearItem, type Slot } from "@/lib/avatar";
import { BACKGROUNDS, FRAMES, HATS, OUTFITS, SAYINGS, SPARKLES, SayingPatch, TOOLS, type GearCtx } from "./chef/gear";
import {
  BROWS, Body, EYES, FACIAL_HAIRS, FaceBase, GLASSES, HAIRS, HAIR_COLORS, Head, MOUTHS, OUTLINE, SKINS, type LookCtx,
} from "./chef/look";

type Props = {
  avatar: Avatar;
  /** Rendered height in px (width follows the canvas shape). */
  size?: number;
  /** Crop to the head and hat (square). */
  head?: boolean;
  /** Unique per chef on the page: prefixes gradient/clip/filter ids so chefs don't collide. */
  uid: string;
  /** Accessible name; without it the drawing is decorative. */
  title?: string;
};

const FULL_BOX = "0 0 120 170";
// Headroom above y 0 so the tall toques, their outline, the legendary glow and top sparkle all fit.
const HEAD_BOX = "10 -8 100 100";

const pick = <T,>(list: T[], i: number): T => list[Number.isInteger(i) && i >= 0 && i < list.length ? i : 0];

/** The equipped item in a slot, only if it exists and belongs there. */
function equippedIn(avatar: Avatar, slot: Slot): GearItem | undefined {
  const id = avatar.equipped?.[slot];
  const item = id ? GEAR_BY_ID[id] : undefined;
  return item?.slot === slot ? item : undefined;
}

const sparkle = (x: number, y: number, s: number) =>
  `M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}z`;

export function ChefAvatar({ avatar, size = 160, head = false, uid, title }: Props): React.JSX.Element {
  const safe = uid.replace(/[^A-Za-z0-9_-]/g, "_");
  const id = (name: string) => `${safe}-${name}`;
  const look = avatar.look;
  const ctx: LookCtx = { skin: pick(SKINS, look?.skin), hair: pick(HAIR_COLORS, look?.hairColor) };
  const gctx: GearCtx = { id, skin: ctx.skin };

  const hatItem = equippedIn(avatar, "hat");
  const outfitItem = equippedIn(avatar, "outfit");
  const toolItem = head ? undefined : equippedIn(avatar, "tool");
  const bgItem = equippedIn(avatar, "background");
  const hat = hatItem && HATS[hatItem.id];
  const outfit = outfitItem && OUTFITS[outfitItem.id];
  const tool = toolItem && TOOLS[toolItem.id];
  const bg = bgItem && BACKGROUNDS[bgItem.id];
  const frameItem = equippedIn(avatar, "frame");
  const frame = frameItem && FRAMES[frameItem.id];
  // The saying sits on the chef's front, so head-only pictures leave it off.
  const sayingItem = head ? undefined : equippedIn(avatar, "saying");
  const saying = sayingItem && SAYINGS[sayingItem.id];

  const legendary = (item: GearItem | undefined, art: unknown) => !!art && item?.rarity === "legendary";
  const glow = `url(#${id("glow")})`;
  const sparkleSlots = (
    [
      ["background", legendary(bgItem, bg)],
      ["hat", legendary(hatItem, hat)],
      ["outfit", !head && legendary(outfitItem, outfit)],
      ["tool", legendary(toolItem, tool)],
    ] as [Slot, boolean][]
  ).filter(([, on]) => on).map(([s]) => s);
  const anyGlow = legendary(hatItem, hat) || legendary(outfitItem, outfit) || legendary(toolItem, tool);
  const hairClip = hat?.hairClip;

  return (
    <svg
      viewBox={head ? HEAD_BOX : FULL_BOX}
      width={head ? size : Math.round((size * 120) / 170)}
      height={size}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      overflow="hidden"
    >
      {title && <title>{title}</title>}
      <defs>
        {anyGlow && (
          <filter id={id("glow")} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2.6" result="blur" />
            <feFlood floodColor="#F2B630" floodOpacity="0.95" />
            <feComposite in2="blur" operator="in" result="gold" />
            <feMerge>
              <feMergeNode in="gold" />
              <feMergeNode in="gold" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
        {hairClip !== undefined && (
          <clipPath id={id("hair")}>
            <rect x={0} y={hairClip} width={120} height={170 - hairClip} />
          </clipPath>
        )}
      </defs>

      {/* 1. Background */}
      {bg?.(gctx)}
      {/* 2. Body and arms */}
      <Body skin={ctx.skin} />
      {/* 3. Outfit */}
      {outfit && <g filter={legendary(outfitItem, outfit) ? glow : undefined}>{outfit(gctx)}</g>}
      {/* 3b. Saying patch on the front */}
      {saying && <SayingPatch lines={saying} legendary={sayingItem?.rarity === "legendary"} />}
      {/* 4. Head */}
      <Head skin={ctx.skin} />
      {/* 5. Face */}
      <FaceBase skin={ctx.skin} />
      {pick(EYES, look?.eyes).draw(ctx)}
      {pick(BROWS, look?.brows).draw(ctx)}
      {pick(MOUTHS, look?.mouth).draw(ctx)}
      {/* 6. Hair, tucked under the hat */}
      <g clipPath={hairClip !== undefined ? `url(#${id("hair")})` : undefined}>{pick(HAIRS, look?.hair).draw(ctx)}</g>
      {/* 7. Facial hair */}
      {pick(FACIAL_HAIRS, look?.facialHair).draw(ctx)}
      {/* 8. Glasses */}
      {pick(GLASSES, look?.glasses).draw(ctx)}
      {/* 9. Hat */}
      {hat && <g filter={legendary(hatItem, hat) ? glow : undefined}>{hat.draw(gctx)}</g>}
      {/* 10. Held tool */}
      {tool && <g filter={legendary(toolItem, tool) ? glow : undefined}>{tool(gctx)}</g>}
      {/* 10b. Frame, on top of everything but the sparkles */}
      {frame?.(gctx, head ? { x: 10, y: -8, w: 100, h: 100 } : { x: 0, y: 0, w: 120, h: 170 })}
      {/* 11. Effects: legendary sparkle */}
      {sparkleSlots.length > 0 && (
        <g fill="#F2B630" stroke={OUTLINE} strokeWidth={1.2} strokeLinejoin="round">
          {sparkleSlots.flatMap((s) => SPARKLES[s].map(([x, y, r]) => <path key={`${s}-${x}-${y}`} d={sparkle(x, y, r)} />))}
        </g>
      )}
    </svg>
  );
}
