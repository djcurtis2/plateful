"use client";
// Confetti burst + a floating "+20 points" label. No dependencies; respects "reduce motion".

const COLORS = ["#2f6b46", "#6fbf8a", "#f2b630", "#ffd36b", "#c23b2a", "#ffffff"];

type Origin = { x: number; y: number };

/** Where the burst starts: call at click time, before awaiting, so a disabled button still has a position. */
export function here(): Origin {
  return originFromFocus();
}

function originFromFocus(): Origin {
  const el = document.activeElement;
  if (el instanceof HTMLElement && el !== document.body) {
    const r = el.getBoundingClientRect();
    if (r.width && r.height) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  return { x: window.innerWidth / 2, y: window.innerHeight / 3 };
}

function burst(origin: Origin, big: boolean) {
  const cv = document.createElement("canvas");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = window.innerWidth * dpr;
  cv.height = window.innerHeight * dpr;
  cv.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:100";
  cv.setAttribute("aria-hidden", "true");
  document.body.appendChild(cv);
  const g = cv.getContext("2d")!;
  g.scale(dpr, dpr);
  const n = big ? 160 : 70;
  const parts = Array.from({ length: n }, () => {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * (big ? Math.PI * 1.4 : Math.PI);
    const v = (big ? 9 : 7) + Math.random() * (big ? 9 : 6);
    return {
      x: origin.x,
      y: origin.y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      w: 5 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      round: Math.random() < 0.3,
    };
  });
  const start = performance.now();
  const life = big ? 2200 : 1500;
  const frame = (t: number) => {
    const age = t - start;
    g.clearRect(0, 0, window.innerWidth, window.innerHeight);
    g.globalAlpha = Math.max(0, 1 - Math.max(0, age - life * 0.6) / (life * 0.4));
    for (const p of parts) {
      p.vy += 0.32; // gravity
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.fillStyle = p.color;
      if (p.round) {
        g.beginPath();
        g.arc(0, 0, p.w / 2, 0, Math.PI * 2);
        g.fill();
      } else g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot * 2)) + 1);
      g.restore();
    }
    if (age < life) requestAnimationFrame(frame);
    else cv.remove();
  };
  requestAnimationFrame(frame);
}

function label(text: string, origin: Origin) {
  const el = document.createElement("div");
  el.textContent = text;
  el.setAttribute("role", "status");
  el.style.cssText = [
    "position:fixed",
    `left:${Math.min(window.innerWidth - 16, Math.max(16, origin.x))}px`,
    `top:${Math.max(70, origin.y - 24)}px`,
    "transform:translate(-50%,0)",
    "z-index:101",
    "pointer-events:none",
    "padding:6px 14px",
    "border-radius:999px",
    "background:var(--saffron)",
    "color:var(--saffron-ink)",
    "font:700 15px var(--font-jetbrains, ui-monospace), monospace",
    "box-shadow:0 8px 24px rgba(0,0,0,.25)",
    "white-space:nowrap",
  ].join(";");
  document.body.appendChild(el);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.animate(
    reduce
      ? [{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }]
      : [
          { opacity: 0, transform: "translate(-50%, 8px) scale(.8)" },
          { opacity: 1, transform: "translate(-50%, -12px) scale(1.08)", offset: 0.15 },
          { opacity: 1, transform: "translate(-50%, -40px) scale(1)", offset: 0.75 },
          { opacity: 0, transform: "translate(-50%, -64px) scale(1)" },
        ],
    { duration: 1800, easing: "ease-out" },
  ).onfinish = () => el.remove();
}

/**
 * Celebrate something that earned points or savings.
 * `text` is the floating label ("+20 points", "+$15.70 saved"); `big` for badges and level-ups.
 */
export function celebrate(opts: { text?: string; big?: boolean; origin?: Origin } = {}) {
  if (typeof window === "undefined") return;
  const origin = opts.origin ?? originFromFocus();
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduce) burst(origin, !!opts.big);
  if (opts.text) label(opts.text, origin);
}

/** "+20 points · +$15.70 saved" from whatever was earned. */
export function earnedText(points?: number, saved?: number) {
  const parts = [points ? `+${points} points` : "", saved ? `+$${saved.toFixed(2)} saved` : ""].filter(Boolean);
  return parts.join(" · ") || undefined;
}
