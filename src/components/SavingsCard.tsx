"use client";
import { useCallback, useEffect, useRef, useState } from "react";

const W = 1080;
const H = 1350;

/** "I've saved $412 cooking at home" image for sharing, with the person's referral link. */
export function SavingsCard({ saved, meals, shareUrl }: { saved: number; meals: number; shareUrl: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [msg, setMsg] = useState("");
  const amount = `$${Math.round(saved).toLocaleString("en-US")}`;
  const text = `I've saved ${amount} cooking restaurant favorites at home with Yumjack.`;

  const draw = useCallback(async () => {
    const cv = canvas.current;
    if (!cv) return;
    const g = cv.getContext("2d")!;
    const css = getComputedStyle(document.documentElement);
    const display = `${css.getPropertyValue("--font-bricolage") || "system-ui"}, system-ui, sans-serif`;
    const mono = `${css.getPropertyValue("--font-jetbrains") || "monospace"}, ui-monospace, monospace`;
    await document.fonts.ready;
    g.fillStyle = "#24563A";
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#F2B630";
    g.font = `600 30px ${mono}`;
    g.fillText("COOKED AT HOME WITH YUMJACK", 72, 130);
    g.fillStyle = "#FFFFFF";
    g.font = `700 92px ${display}`;
    g.fillText("I've saved", 72, 330);
    g.fillStyle = "#F2B630";
    g.font = `700 ${amount.length > 7 ? 190 : 230}px ${display}`;
    g.fillText(amount, 64, 560);
    g.fillStyle = "#FFFFFF";
    g.font = `600 64px ${display}`;
    g.fillText("cooking restaurant", 72, 700);
    g.fillText("favorites at home.", 72, 780);
    g.fillStyle = "rgba(255,255,255,.75)";
    g.font = `600 40px ${mono}`;
    g.fillText(`${meals} ${meals === 1 ? "meal" : "meals"} cooked`, 72, 900);
    g.fillStyle = "rgba(255,255,255,.12)";
    g.beginPath();
    g.roundRect(72, 1060, W - 144, 150, 28);
    g.fill();
    g.fillStyle = "#FFFFFF";
    g.font = `700 46px ${display}`;
    g.fillText("Snap a dish, make it for less", 112, 1130);
    g.fillStyle = "rgba(255,255,255,.7)";
    g.font = `500 30px ${mono}`;
    g.fillText(shareUrl.replace(/^https?:\/\//, "").slice(0, 52), 112, 1180);
  }, [amount, meals, shareUrl]);

  useEffect(() => {
    void draw();
  }, [draw]);

  async function file() {
    const blob = await new Promise<Blob | null>((r) => canvas.current?.toBlob(r, "image/png"));
    return blob ? new File([blob], "yumjack-savings.png", { type: "image/png" }) : null;
  }

  return (
    <div className="flex flex-col gap-3">
      <canvas ref={canvas} width={W} height={H} className="w-full max-w-xs rounded-2xl" role="img" aria-label={text} />
      <div className="flex flex-wrap gap-2">
        <button
          className="btn btn-primary btn-sm"
          onClick={async () => {
            const f = await file();
            if (f && navigator.canShare?.({ files: [f] })) {
              try {
                await navigator.share({ files: [f], text: `${text} ${shareUrl}` });
              } catch {
                /* cancelled */
              }
              return;
            }
            if (!f) return;
            const a = document.createElement("a");
            a.href = URL.createObjectURL(f);
            a.download = f.name;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            setMsg("Saved the image. Post it with your link.");
          }}
        >
          Share my savings
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(`${text} ${shareUrl}`);
              setMsg("Copied the text and your link.");
            } catch {
              /* blocked */
            }
          }}
        >
          Copy text
        </button>
      </div>
      {msg && <p className="text-xs text-muted">{msg}</p>}
    </div>
  );
}
