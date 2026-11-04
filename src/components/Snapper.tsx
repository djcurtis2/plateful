"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const MAX_EDGE = 1280;

/** Shrinks the photo in the browser before upload: faster on mobile data, and cheaper to recognize. */
async function downscale(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file; // e.g. HEIC on a browser that can't decode it; the server will say if it can't either
  }
}

type Phase = { kind: "idle" } | { kind: "working"; preview: string } | { kind: "error"; message: string; code?: string };

export function Snapper({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [restaurant, setRestaurant] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [over, setOver] = useState(false);

  async function handle(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhase({ kind: "error", message: "That file isn't a photo. Choose a JPEG, PNG or WebP image." });
      return;
    }
    const preview = URL.createObjectURL(file);
    setPhase({ kind: "working", preview });
    try {
      const body = new FormData();
      body.set("image", await downscale(file), "dish.jpg");
      body.set("restaurant", restaurant.trim());
      const res = await fetch("/api/recognize", { method: "POST", body });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.slug) {
        setPhase({
          kind: "error",
          code: json?.error?.code,
          message: json?.error?.message ?? "Something went wrong reading your photo. Try again.",
        });
        return;
      }
      router.push(`/r/${json.slug}`);
    } catch {
      setPhase({ kind: "error", message: "Couldn't reach Yumjack. Check your connection and try again." });
    } finally {
      URL.revokeObjectURL(preview);
      if (input.current) input.current.value = "";
    }
  }

  if (phase.kind === "working") {
    return (
      <div className="card flex flex-col items-center gap-5 p-6 text-center" aria-live="polite">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={phase.preview} alt="Your photo" className="aspect-[4/3] w-full rounded-2xl object-cover" />
        <div className="relative size-24 overflow-hidden rounded-full border-2 border-line">
          <span className="absolute inset-x-0 top-0 h-[3px] animate-[sweep_1.4s_ease-in-out_infinite_alternate] bg-saffron" />
        </div>
        <div>
          <p className="font-display text-2xl font-bold">Reading your plate…</p>
          <p className="text-sm text-muted">Identifying the dish, pricing it, and writing the copycat. About 10 seconds.</p>
        </div>
        <style>{`@keyframes sweep{to{top:calc(100% - 3px)}}`}</style>
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="restaurant" className="label">
          Where was it from? (optional)
        </label>
        <input
          id="restaurant"
          className="input"
          autoComplete="off"
          maxLength={80}
          value={restaurant}
          onChange={(e) => setRestaurant(e.target.value)}
          placeholder="Chipotle, Olive Garden, a local spot…"
        />
      </div>

      <label
        htmlFor="photo"
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          handle(e.dataTransfer.files[0]);
        }}
        className={`flex cursor-pointer flex-col items-center gap-3 rounded-3xl border-[1.5px] border-dashed bg-sunk px-5 py-8 text-center transition-colors ${over ? "border-basil" : "border-line hover:border-basil"}`}
      >
        <span className="grid size-16 place-items-center rounded-full bg-basil text-basil-ink">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <rect x="3" y="6" width="18" height="14" rx="3" />
            <circle cx="12" cy="13" r="3.5" />
            <path d="M9 6l1.5-2h3L15 6" />
          </svg>
        </span>
        <span className="font-display text-xl font-bold">Snap or upload the dish</span>
        <span className="text-sm text-muted">Take a photo, pick one from your camera roll, or drop it here</span>
        <input
          ref={input}
          id="photo"
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => handle(e.target.files?.[0])}
        />
      </label>

      {phase.kind === "error" && (
        <div role="alert" className="flex flex-col gap-2 rounded-2xl bg-chili/10 px-4 py-3 text-sm text-chili">
          <p>{phase.message}</p>
          {phase.code === "anon_limit" && !signedIn && (
            <Link href="/login?next=/" className="font-semibold underline">
              Sign in free
            </Link>
          )}
          {phase.code === "free_limit" && (
            <Link href="/pricing" className="font-semibold underline">
              See Plus
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
