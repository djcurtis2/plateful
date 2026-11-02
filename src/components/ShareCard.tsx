"use client";
import { celebrate, earnedText, here } from "@/lib/celebrate";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { postAttempt } from "@/app/actions";
import type { Recipe } from "@/lib/recipe";
import { menuPlate, savings } from "@/lib/recipe";
import { money } from "@/lib/format";

const W = 1080;
const H = 1350;

type Props = {
  recipe: Recipe;
  shareUrl: string;
  /** A photo already on the card, e.g. an entry that's already posted. */
  initialAttempt?: string | null;
  /** Offer "Also post to Who made it" (signed-in users adding a new photo). */
  canPost?: boolean;
  /** The viewer already has an entry for this recipe; posting replaces it. */
  hasEntry?: boolean;
  /** Words before the link on the card, e.g. "Vote for me" on a cook-off entry. */
  cta?: string;
  challengeId?: string;
};

async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = "anonymous"; // Supabase public storage sends CORS headers, so the canvas stays exportable
  img.src = src;
  await img.decode();
  return img;
}

function wrap(g: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (g.measureText(t).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, "") + "…";
  }
  return lines;
}

async function panel(
  g: CanvasRenderingContext2D,
  src: string | null,
  x: number,
  y: number,
  w: number,
  h: number,
  tag: string,
  fonts: { mono: string; body: string; display?: string },
) {
  g.save();
  g.beginPath();
  g.roundRect(x, y, w, h, 28);
  g.clip();
  let drawn = false;
  if (src) {
    try {
      const im = await loadImage(src);
      const s = Math.max(w / im.naturalWidth, h / im.naturalHeight);
      const iw = im.naturalWidth * s;
      const ih = im.naturalHeight * s;
      g.drawImage(im, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
      drawn = true;
    } catch {
      /* fall through to placeholder */
    }
  }
  if (!drawn) {
    g.fillStyle = "rgba(255,255,255,.08)";
    g.fillRect(x, y, w, h);
    g.restore();
    g.save();
    g.setLineDash([14, 12]);
    g.strokeStyle = "rgba(255,255,255,.45)";
    g.lineWidth = 3;
    g.beginPath();
    g.roundRect(x + 2, y + 2, w - 4, h - 4, 26);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = "rgba(255,255,255,.85)";
    g.textAlign = "center";
    if (tag === "Mine") {
      g.font = `600 34px ${fonts.body}`;
      g.fillText("Your attempt", x + w / 2, y + h / 2);
      g.font = `400 26px ${fonts.body}`;
      g.fillText("goes here", x + w / 2, y + h / 2 + 40);
    } else {
      // No restaurant photo: show the restaurant's name as the "plate".
      const isOriginal = tag === "The recipe";
      const name = isOriginal ? "Plateful" : tag.replace(/^At /, "");
      g.font = `700 52px ${fonts.display ?? fonts.body}`;
      const lines = wrap(g, name, w - 60, 3);
      const top = y + h / 2 - ((lines.length - 1) * 58) / 2;
      lines.forEach((l, i) => g.fillText(l, x + w / 2, top + i * 58));
      g.font = `400 24px ${fonts.body}`;
      g.fillStyle = "rgba(255,255,255,.6)";
      g.fillText(isOriginal ? "original recipe" : "the original", x + w / 2, top + lines.length * 58);
    }
    g.textAlign = "left";
  }
  g.restore();
  g.font = `600 26px ${fonts.mono}`;
  const tw = g.measureText(tag).width + 36;
  g.fillStyle = "rgba(15,30,20,.78)";
  g.beginPath();
  g.roundRect(x + 20, y + 20, tw, 52, 26);
  g.fill();
  g.fillStyle = "#FFFFFF";
  g.fillText(tag, x + 38, y + 55);
}

/** The "restaurant vs. mine" image people post. Rendered on a canvas so it saves as a real PNG. */
export function ShareCard({ recipe, shareUrl, initialAttempt = null, canPost = false, hasEntry = false, challengeId, cta = "Cook it" }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [attempt, setAttempt] = useState<string | null>(initialAttempt);
  const [file, setFile] = useState<File | null>(null);
  // Replacing an existing entry resets its votes, so make that opt-in.
  const [alsoPost, setAlsoPost] = useState(!hasEntry);
  const [posted, setPosted] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputId = useId();
  const [mobile, setMobile] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    // Touch devices with file sharing get the native sheet (TikTok, Instagram...). Desktops get explicit options.
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const probe = new File([new Blob(["x"], { type: "image/png" })], "x.png", { type: "image/png" });
    setMobile(coarse && !!navigator.canShare?.({ files: [probe] }));
  }, []);
  const router = useRouter();
  const [toast, setToast] = useState("");
  const displayUrl = shareUrl.replace(/^https?:\/\//, "");

  const draw = useCallback(async () => {
    const cv = canvas.current;
    if (!cv) return;
    const g = cv.getContext("2d")!;
    const css = getComputedStyle(document.documentElement);
    const fonts = {
      display: `${css.getPropertyValue("--font-bricolage") || "system-ui"}, system-ui, sans-serif`,
      mono: `${css.getPropertyValue("--font-jetbrains") || "monospace"}, ui-monospace, monospace`,
      body: `${css.getPropertyValue("--font-instrument") || "system-ui"}, system-ui, sans-serif`,
    };
    await document.fonts.ready;
    g.clearRect(0, 0, W, H);
    g.fillStyle = "#24563A";
    g.fillRect(0, 0, W, H);

    g.fillStyle = "#F2B630";
    g.font = `600 28px ${fonts.mono}`;
    const original = !recipe.restaurant && (!!recipe.style || recipe.source === "leftovers");
    g.fillText(
      (original ? `PLATEFUL ORIGINAL${recipe.style ? " · " + recipe.style.toUpperCase() : ""}` : `COPYCAT${recipe.restaurant ? " · " + recipe.restaurant.toUpperCase() : ""}`).slice(0, 52),
      64,
      100,
    );
    g.fillStyle = "#FFFFFF";
    g.font = `700 76px ${fonts.display}`;
    wrap(g, recipe.dish, W - 128, 2).forEach((l, i) => g.fillText(l, 64, 186 + i * 80));

    const py = 330, pw = 460, ph = 540, lx = 64, rx = 64 + pw + 32;
    if (original && !recipe.image_url) {
      // A Plateful original with no photo yet: nothing to compare against, so your plate gets the whole card.
      await panel(g, attempt, lx, py, W - 128, ph, "Mine", fonts);
    } else {
      await panel(g, recipe.image_url, lx, py, pw, ph, original ? "The recipe" : `At ${(recipe.restaurant ?? "the restaurant").slice(0, 22)}`, fonts);
      await panel(g, attempt, rx, py, pw, ph, "Mine", fonts);
    }

    const yL = py + ph + 58;
    g.fillStyle = "rgba(255,255,255,.7)";
    g.font = `600 24px ${fonts.mono}`;
    g.fillText(recipe.menu_price ? (recipe.menu_serves > 1 ? "MENU, PER PLATE" : "MENU PRICE") : "READY IN", lx, yL);
    g.fillText("PER PLATE AT HOME", rx, yL);
    g.fillStyle = "#FFFFFF";
    g.font = `600 64px ${fonts.mono}`;
    g.fillText(recipe.menu_price ? money(menuPlate(recipe)) : `${recipe.minutes ?? 30} min`, lx, yL + 72);
    g.fillText(money(recipe.plate_cost), rx, yL + 72);

    const s = savings(recipe);
    if (s) {
      g.fillStyle = "#F2B630";
      g.beginPath();
      g.roundRect(64, 1062, W - 128, 120, 24);
      g.fill();
      g.fillStyle = "#3A2A00";
      g.font = `700 52px ${fonts.display}`;
      g.fillText(`Saved ${money(s.saved)} a plate`, 100, 1138);
      g.font = `600 34px ${fonts.mono}`;
      g.textAlign = "right";
      g.fillText(`${s.pct}% less`, W - 100, 1136);
      g.textAlign = "left";
    }
    g.beginPath();
    g.arc(78, 1240, 14, 0, Math.PI * 2);
    g.fillStyle = "#F2B630";
    g.fill();
    g.fillStyle = "#FFFFFF";
    g.font = `700 40px ${fonts.display}`;
    g.fillText("Plateful", 104, 1254);
    g.fillStyle = "rgba(255,255,255,.85)";
    g.font = `500 24px ${fonts.mono}`;
    g.fillText(`${cta} → ${displayUrl}`.slice(0, 70), 64, 1302);
  }, [recipe, attempt, displayUrl, cta]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Free only the preview URLs this card created, and only when the card goes away.
  // (Revoking on every change also revoked photos handed in by the parent, which then failed to draw.)
  const createdUrls = useRef<string[]>([]);
  useEffect(() => {
    const urls = createdUrls.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  function flash(m: string) {
    setToast(m);
    setTimeout(() => setToast(""), 2400);
  }

  async function toBlob() {
    await draw();
    return new Promise<Blob | null>((res) => canvas.current?.toBlob(res, "image/png"));
  }

  /** Returns true when this click posted the photo to "Who made it". */
  async function postIfWanted(): Promise<boolean> {
    if (!canPost || !alsoPost || !file || posted) return false;
    const fd = new FormData();
    fd.set("image", file);
    fd.set("recipeId", recipe.id);
    if (challengeId) fd.set("challengeId", challengeId);
    const at = here();
    const r = await postAttempt(fd);
    if (r.ok) {
      if (r.points || r.saved) celebrate({ text: earnedText(r.points, r.saved), origin: at, big: true });
      setPosted(true);
      router.refresh(); // show the new entry in "Who made it"
      return true;
    }
    flash(`Not posted: ${r.message}`);
    return false;
  }

  const shareText = `${recipe.restaurant ? recipe.restaurant + "-style " : ""}${recipe.dish}, made at home${
    recipe.menu_price && recipe.plate_cost ? ` for ${money(recipe.plate_cost)} a plate instead of ${money(menuPlate(recipe))}` : ""
  }.`;

  /** Runs a share action, posting the photo to "Who made it" first when that box is ticked. */
  async function run(action: (justPosted: boolean) => Promise<void> | void) {
    if (!attempt || busy) return;
    setBusy(true);
    try {
      const justPosted = await postIfWanted();
      await action(justPosted);
    } finally {
      setBusy(false);
    }
  }

  const posted_ = (justPosted: boolean, msg: string) => flash(justPosted ? `${msg} and posted to Who made it` : msg);

  async function pngFile() {
    const blob = await toBlob();
    return blob ? new File([blob], `${recipe.slug}-copycat.png`, { type: "image/png" }) : null;
  }

  /** Phones: the native share sheet, which includes TikTok, Instagram, Snapchat and Messages. */
  const nativeShare = (justPosted: boolean) =>
    (async () => {
      const png = await pngFile();
      if (!png) return flash("Couldn't make the image. Try again.");
      try {
        await navigator.share({ files: [png], text: `${shareText} Cook it: ${shareUrl}` });
        if (justPosted) flash("Shared and posted to Who made it");
      } catch (e) {
        if ((e as Error).name !== "AbortError") download(justPosted);
      }
    })();

  async function download(justPosted: boolean) {
    const png = await pngFile();
    if (!png) return flash("Couldn't make the image. Try again.");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(png);
    a.download = png.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    posted_(justPosted, "Card saved to your downloads");
  }

  async function copyImage(justPosted: boolean) {
    try {
      const blob = await toBlob();
      if (!blob || typeof ClipboardItem === "undefined") throw new Error("unsupported");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      posted_(justPosted, "Card copied. Paste it anywhere");
    } catch {
      flash("This browser can't copy images. Use Save my card instead.");
    }
  }

  function openSocial(url: string) {
    window.open(url, "_blank", "noopener,noreferrer,width=640,height=720");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      flash("Link copied");
    } catch {
      flash("Copy the link from the box");
    }
  }

  async function toggleQr() {
    if (qr) return setQr(null);
    const QRCode = (await import("qrcode")).default;
    setQr(await QRCode.toDataURL(shareUrl, { margin: 1, width: 240, color: { dark: "#1b2a22", light: "#ffffff" } }));
  }

  const u = encodeURIComponent(shareUrl);
  const t = encodeURIComponent(shareText);
  const SOCIAL: { name: string; url: string }[] = [
    { name: "X", url: `https://twitter.com/intent/tweet?text=${t}&url=${u}` },
    { name: "Facebook", url: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    {
      name: "Pinterest",
      url: `https://pinterest.com/pin/create/button/?url=${u}&description=${t}${
        recipe.image_url ? `&media=${encodeURIComponent(recipe.image_url)}` : ""
      }`,
    },
    { name: "Reddit", url: `https://www.reddit.com/submit?url=${u}&title=${t}` },
    { name: "WhatsApp", url: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}` },
  ];

  return (
    <div className="flex flex-col gap-3">
      <canvas
        ref={canvas}
        width={W}
        height={H}
        className="aspect-[4/5] h-auto w-full max-w-full rounded-2xl bg-sunk"
        role="img"
        aria-label={`Share card comparing ${recipe.restaurant ?? "the restaurant"} and homemade ${recipe.dish}`}
      />
      <div className="grid grid-cols-2 gap-2">
        <label htmlFor={inputId} className={`btn cursor-pointer ${attempt ? "btn-ghost" : "btn-sun"}`}>
          {attempt ? "Change photo" : "1. Add my photo"}
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setFile(f);
            setPosted(false);
            const url = URL.createObjectURL(f);
            createdUrls.current.push(url);
            setAttempt(url);
          }}
        />
        <button
          className="btn btn-primary"
          onClick={() => run(mobile ? nativeShare : download)}
          disabled={!attempt || busy}
          title={attempt ? undefined : "Add your photo first"}
        >
          {busy ? "Working…" : mobile ? "2. Share my card" : "2. Save my card"}
        </button>
      </div>
      {attempt && !mobile && (
        <div className="flex flex-col gap-2 rounded-2xl bg-sunk p-3">
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => run(copyImage)} disabled={busy}>
              Copy card
            </button>
            <button className="btn btn-ghost btn-sm" onClick={toggleQr} aria-expanded={!!qr}>
              {qr ? "Hide QR code" : "Send to my phone"}
            </button>
          </div>
          {qr && (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR code for this recipe" width={120} height={120} className="rounded-lg" />
              <p className="text-xs text-muted">
                Scan with your phone camera, add your photo there, and share to TikTok or Instagram from the share sheet.
              </p>
            </div>
          )}
          <span className="label pt-1">Post the link to</span>
          <div className="flex flex-wrap gap-2">
            {SOCIAL.map((s) => (
              <button key={s.name} className="btn btn-ghost btn-sm" onClick={() => {
                  openSocial(s.url);
                  run((justPosted) => { if (justPosted) flash("Posted to Who made it"); });
                }} disabled={busy}>
                {s.name}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">TikTok and Instagram only accept posts from their phone apps. Save your card or send it to your phone.</p>
        </div>
      )}
      {!attempt && <p className="-mt-1 text-xs text-muted">Add a photo of your version to unlock sharing.</p>}
      {canPost && file && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-[var(--basil)]"
            checked={alsoPost}
            disabled={posted}
            onChange={(e) => setAlsoPost(e.target.checked)}
          />
          {posted ? (hasEntry ? "Replaced your entry in Who made it" : "Posted to Who made it") : hasEntry ? "Replace my entry in Who made it (resets its votes)" : "Also post to Who made it"}
        </label>
      )}
      <div className="flex items-center gap-2 rounded-xl bg-sunk py-1.5 pl-3 pr-1.5 font-mono text-xs">
        <input readOnly value={shareUrl} aria-label="Your share link" className="min-w-0 flex-1 bg-transparent outline-none" onFocus={(e) => e.target.select()} />
        <button className="btn btn-ghost btn-sm" onClick={copy}>
          Copy link
        </button>
      </div>
      <p aria-live="polite" className="min-h-5 text-sm text-basil">
        {toast}
      </p>
    </div>
  );
}
