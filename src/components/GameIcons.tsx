// Icons for cook levels and badges. Plain inline SVG so they work in server and client components
// and pick up the theme colors (light and dark) through currentColor.
import type { BadgeId } from "@/lib/database.types";
import { BADGES, LEVELS } from "@/lib/game";

type P = { size?: number };
const svg = (size: number, children: React.ReactNode) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);

// ---------------------------------------------------------------------------
// Levels: a kitchen career ladder. Spoon → knife → pan → chef's hat → chef's hat with a star.

const LEVEL_GLYPHS: React.ReactNode[] = [
  // Line cook: wooden spoon
  <>
    <ellipse cx="15.5" cy="7.5" rx="3.5" ry="4.5" transform="rotate(40 15.5 7.5)" />
    <path d="M12.8 10.6 5 19" strokeWidth="2.2" />
  </>,
  // Prep cook: chef's knife
  <>
    <path d="M4 20 15.5 8.5c1.6-1.6 3.6-2.6 5.5-3l-1.2 3.6c-.6 1.8-1.7 3.4-3.2 4.6L10 18.5" />
    <path d="m4 20 2.6-2.6" strokeWidth="2.6" />
  </>,
  // Sous chef: frying pan
  <>
    <circle cx="10" cy="12" r="6" />
    <path d="M16 12h6" strokeWidth="2.4" />
    <path d="M7.5 10.5c.8-1 2-1.5 3-1.4" />
  </>,
  // Head chef: toque
  <>
    <path d="M7 14.5C4.6 14 3 12.2 3 10c0-2.5 2-4.5 4.5-4.5.4 0 .8 0 1.1.1A4.5 4.5 0 0 1 12 4a4.5 4.5 0 0 1 3.4 1.6c.3-.1.7-.1 1.1-.1C19 5.5 21 7.5 21 10c0 2.2-1.6 4-4 4.5" />
    <path d="M7 14.5V20h10v-5.5" />
    <path d="M7 17h10" />
  </>,
  // Executive chef: toque with a star
  <>
    <path d="M7 14.5C4.6 14 3 12.2 3 10c0-2.5 2-4.5 4.5-4.5.4 0 .8 0 1.1.1A4.5 4.5 0 0 1 12 4a4.5 4.5 0 0 1 3.4 1.6c.3-.1.7-.1 1.1-.1C19 5.5 21 7.5 21 10c0 2.2-1.6 4-4 4.5" />
    <path d="M7 14.5V20h10v-5.5" />
    <path d="m12 8.6.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2L9.1 10.7l2-.3z" fill="currentColor" strokeWidth="1" />
  </>,
];

// Medal colors climb from plain to gold.
const LEVEL_STYLES = [
  "bg-sunk text-muted ring-line",
  "bg-basil/15 text-basil ring-basil/30",
  "bg-basil text-basil-ink ring-basil",
  "bg-saffron text-saffron-ink ring-saffron",
  "bg-saffron text-saffron-ink ring-2 ring-offset-2 ring-offset-surface ring-saffron",
];

export function LevelIcon({ index, size = 36, title }: P & { index: number; title?: string }) {
  const i = Math.max(0, Math.min(LEVELS.length - 1, index));
  return (
    <span
      className={`inline-grid shrink-0 place-items-center rounded-full ring-1 ${LEVEL_STYLES[i]}`}
      style={{ width: size, height: size }}
      title={title ?? LEVELS[i].name}
      role="img"
      aria-label={LEVELS[i].name}
    >
      {svg(Math.round(size * 0.58), LEVEL_GLYPHS[i])}
    </span>
  );
}

/** The whole ladder in a row, with the person's current level highlighted. */
export function LevelLadder({ current }: { current?: number }) {
  return (
    <ol className="flex flex-wrap items-start gap-x-4 gap-y-3">
      {LEVELS.map((l, i) => (
        <li key={l.name} className={`flex w-20 flex-col items-center gap-1 text-center ${current != null && i > current ? "opacity-50" : ""}`}>
          <LevelIcon index={i} size={40} />
          <span className="text-xs font-semibold leading-tight">{l.name}</span>
          <span className="tabular font-mono text-[11px] text-muted">{l.min}+</span>
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Badges

// Savings milestones: a piggy bank, with a coin going in for the bigger ones.
const piggy = (coins: number) => (
  <>
    <path d="M5 11.5C5 8.5 8 6.5 12 6.5c3.3 0 5.8 1.4 6.7 3.5H20a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-1.3c-.5 1.3-1.5 2.3-2.7 2.9V19h-2.5v-1.6a10 10 0 0 1-3 0V19H8v-2.3c-1.9-1.1-3-3-3-5.2Z" />
    <path d="M5.5 10.5c-1.4 0-2.3-.7-2.5-1.8" />
    <circle cx="15.5" cy="10" r=".8" fill="currentColor" />
    {coins > 0 && <path d="M10 3.5h3" strokeWidth="2.2" />}
    {coins > 1 && <path d="M10.5 1.5h2" strokeWidth="2" />}
  </>
);

const BADGE_GLYPHS: Record<BadgeId, React.ReactNode> = {
  saved_100: piggy(0),
  saved_500: piggy(1),
  saved_1000: piggy(1),
  saved_5000: piggy(2),
  saved_10000: piggy(2),
  // First copycat: camera
  first_copycat: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="3" />
      <circle cx="12" cy="13.5" r="3.5" />
      <path d="M9 7l1.5-2.5h3L15 7" />
    </>
  ),
  // Top 10: ribbon medal
  top10: (
    <>
      <path d="M8 3h3l1 5M16 3h-3l-1 5" />
      <circle cx="12" cy="14.5" r="6" />
      <path d="M10.2 12.5v4.2M13 12.5h1.3a.9.9 0 0 1 .9.9v2.4a.9.9 0 0 1-.9.9H13a.9.9 0 0 1-.9-.9v-2.4a.9.9 0 0 1 .9-.9Z" strokeWidth="1.4" />
    </>
  ),
  // Crowd favorite: trophy
  crowd_favorite: (
    <>
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4.5a2.5 2.5 0 0 0 2.6 4M17 6h2.5a2.5 2.5 0 0 1-2.6 4" />
      <path d="M12 14v3M8.5 20h7M9.5 17h5v3h-5z" />
    </>
  ),
  // Chef's pick: seal with a check
  chef_pick: (
    <>
      <path d="M12 3l2.1 1.5 2.6-.2.8 2.5 2.1 1.5-.8 2.5.8 2.5-2.1 1.5-.8 2.5-2.6-.2L12 19l-2.1-1.5-2.6.2-.8-2.5-2.1-1.5.8-2.5-.8-2.5 2.1-1.5.8-2.5 2.6.2z" />
      <path d="m9 11.3 2 2 4-4" />
    </>
  ),
  // Thriftiest copy: price tag
  thriftiest: (
    <>
      <path d="M3.5 12.3V4.5a1 1 0 0 1 1-1h7.8a1 1 0 0 1 .7.3l7.5 7.5a1 1 0 0 1 0 1.4l-7.8 7.8a1 1 0 0 1-1.4 0l-7.5-7.5a1 1 0 0 1-.3-.7Z" />
      <circle cx="8" cy="8" r="1.4" fill="currentColor" />
      <path d="M12.5 11.2c-.4-.5-1-.7-1.6-.6-.8.2-1 1.2-.3 1.6l1.6.9c.7.4.4 1.5-.4 1.6-.6.1-1.2-.2-1.6-.6M11.6 9.6v.9M11.6 15v.9" strokeWidth="1.3" />
    </>
  ),
  // 4-week streak: flame
  streak_4: (
    <>
      <path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.3 2.4-5.4 3.6-8.3.4 1.6 1.3 2.7 2.4 3.3.2-2.7 1.3-5.2 3.6-6.8-.3 3 .9 4.6 2.2 6.4 1 1.4 1.7 3 1.7 5.1 0 3.8-2.8 6.5-7 6.5Z" />
      <path d="M12 21c-1.7 0-2.8-1.1-2.8-2.7 0-1.8 1.6-2.6 2.3-4.3.9 1 3.3 2.2 3.3 4.4 0 1.5-1.1 2.6-2.8 2.6Z" />
    </>
  ),
  // Brought 3 friends: group
  brought_3: (
    <>
      <circle cx="12" cy="8" r="3" />
      <path d="M6.5 20v-1a5.5 5.5 0 0 1 11 0v1" />
      <circle cx="5" cy="10" r="2.2" />
      <path d="M1.8 19v-.5a3.5 3.5 0 0 1 4-3.5" />
      <circle cx="19" cy="10" r="2.2" />
      <path d="M22.2 19v-.5a3.5 3.5 0 0 0-4-3.5" />
    </>
  ),
};

const WIN_BADGES: BadgeId[] = ["crowd_favorite", "chef_pick", "thriftiest", "saved_1000", "saved_5000", "saved_10000"];

export function BadgeIcon({ id, size = 36, earned = true }: P & { id: BadgeId; earned?: boolean }) {
  const tone = !earned ? "bg-sunk text-muted ring-line" : WIN_BADGES.includes(id) ? "bg-saffron text-saffron-ink ring-saffron" : "bg-basil text-basil-ink ring-basil";
  return (
    <span
      className={`inline-grid shrink-0 place-items-center rounded-full ring-1 ${tone}`}
      style={{ width: size, height: size }}
      title={BADGES[id].label}
      role="img"
      aria-label={BADGES[id].label}
    >
      {svg(Math.round(size * 0.58), BADGE_GLYPHS[id])}
    </span>
  );
}
