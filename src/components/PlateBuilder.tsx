"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { buildPlate } from "@/app/actions";
import {
  FLAVOR_BY_ID,
  MAX_ADD_INS,
  MAX_NOTE,
  MAX_SIDES,
  PROTEINS,
  cleanBuild,
  describeBuild,
  inPantry,
  rankFor,
  suggestionsFor,
} from "@/lib/builder";

type Props = { signedIn: boolean; plus: boolean; left: number; plusPerDay: number; pantry: string[] };

/** Build a plate, step by step: protein → method → flavor → add-ins and sides → Claude writes it. */
export function PlateBuilder({ signedIn, plus, left, plusPerDay, pantry }: Props) {
  const router = useRouter();
  const [protein, setProtein] = useState<string | null>(null);
  const [method, setMethod] = useState<string | null>(null);
  const [flavor, setFlavor] = useState<string | null>(null);
  const [addIns, setAddIns] = useState<string[]>([]);
  const [sides, setSides] = useState<string[]>([]);
  const [servings, setServings] = useState(2);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  const ranked = useMemo(() => rankFor(protein), [protein]);
  const ideas = useMemo(() => suggestionsFor(flavor), [flavor]);
  const build = cleanBuild({ protein, method, flavor, addIns, sides, servings, note });

  function pickFlavor(id: string) {
    setFlavor(id);
    // Add-ins and sides belong to a flavor; keep only the ones the new flavor also suggests.
    const next = suggestionsFor(id);
    setAddIns((a) => a.filter((x) => next.addIns.includes(x)));
    setSides((s) => s.filter((x) => next.sides.includes(x)));
  }

  function toggle(list: string[], set: (v: string[]) => void, item: string, max: number) {
    if (list.includes(item)) set(list.filter((x) => x !== item));
    else if (list.length < max) set([...list, item]);
  }

  return (
    <div className="flex flex-col gap-5">
      <Step n={1} title="Pick a protein" done={!!protein}>
        <div className="flex flex-wrap gap-2">
          {PROTEINS.map((p) => (
            <Chip key={p.id} on={protein === p.id} onClick={() => setProtein(p.id)} tag={inPantry(p.label, pantry) ? "in pantry" : null}>
              <span aria-hidden>{p.emoji}</span> {p.label}
            </Chip>
          ))}
        </div>
      </Step>

      {protein && (
        <Step n={2} title="How do you want to cook it?" done={!!method}>
          <div className="flex flex-wrap gap-2">
            {ranked.methods.map((m) => (
              <Chip key={m.id} on={method === m.id} onClick={() => setMethod(m.id)} tag={m.good ? "goes great" : null}>
                <span aria-hidden>{m.emoji}</span> {m.label}
              </Chip>
            ))}
          </div>
        </Step>
      )}

      {protein && method && (
        <Step n={3} title="Pick a flavor" done={!!flavor}>
          <div className="flex flex-wrap gap-2">
            {ranked.flavors.map((f) => (
              <Chip key={f.id} on={flavor === f.id} onClick={() => pickFlavor(f.id)} tag={f.good ? "goes great" : null}>
                <span aria-hidden>{f.emoji}</span> {f.label}
              </Chip>
            ))}
          </div>
        </Step>
      )}

      {build && (
        <>
          <Step n={4} title="What goes in it?" hint={`Up to ${MAX_ADD_INS}. We picked these to go with ${flavorName(flavor)}.`} done={addIns.length > 0}>
            <div className="flex flex-wrap gap-2">
              {ideas.addIns.map((a) => (
                <Chip
                  key={a}
                  on={addIns.includes(a)}
                  onClick={() => toggle(addIns, setAddIns, a, MAX_ADD_INS)}
                  tag={inPantry(a, pantry) ? "in pantry" : null}
                  disabled={!addIns.includes(a) && addIns.length >= MAX_ADD_INS}
                >
                  {a}
                </Chip>
              ))}
            </div>
          </Step>

          <Step n={5} title="Sides" hint={`Up to ${MAX_SIDES}, or none and we'll suggest one.`} done={sides.length > 0}>
            <div className="flex flex-wrap gap-2">
              {ideas.sides.map((s) => (
                <Chip
                  key={s}
                  on={sides.includes(s)}
                  onClick={() => toggle(sides, setSides, s, MAX_SIDES)}
                  tag={inPantry(s, pantry) ? "in pantry" : null}
                  disabled={!sides.includes(s) && sides.length >= MAX_SIDES}
                >
                  {s}
                </Chip>
              ))}
            </div>
          </Step>

          <section className="card flex flex-col gap-4 p-5">
            <div className="flex flex-wrap items-center gap-4">
              <span className="label">Servings</span>
              <span className="flex items-center gap-2">
                <button type="button" className="btn btn-ghost btn-sm" aria-label="Fewer servings" onClick={() => setServings((n) => Math.max(1, n - 1))}>
                  −
                </button>
                <span className="tabular w-6 text-center font-mono font-semibold">{servings}</span>
                <button type="button" className="btn btn-ghost btn-sm" aria-label="More servings" onClick={() => setServings((n) => Math.min(8, n + 1))}>
                  +
                </button>
              </span>
            </div>
            <label className="flex flex-col gap-1">
              <span className="label">Anything else? (optional)</span>
              <input
                className="input"
                maxLength={MAX_NOTE}
                placeholder="Extra spicy, no dairy, ready in 30 minutes…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <div className="rounded-2xl bg-sunk p-4">
              <span className="label">Your plate</span>
              <p className="font-display text-xl font-bold first-letter:uppercase">{describeBuild(build)}</p>
            </div>
            <MakeButton
              signedIn={signedIn}
              plus={plus}
              left={left}
              plusPerDay={plusPerDay}
              pending={pending}
              onMake={() =>
                start(async () => {
                  setMsg("");
                  const r = await buildPlate({ ...build, note });
                  if (!r.ok) return setMsg(r.message);
                  router.push(`/r/${r.slug}`);
                })
              }
            />
            {msg && (
              <p role="alert" className="text-sm text-chili">
                {msg}
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function flavorName(id: string | null) {
  return (id && FLAVOR_BY_ID[id]?.label.toLowerCase()) || "it";
}

function MakeButton({ signedIn, plus, left, plusPerDay, pending, onMake }: { signedIn: boolean; plus: boolean; left: number; plusPerDay: number; pending: boolean; onMake: () => void }) {
  if (!signedIn)
    return (
      <Link href="/login?next=/build" className="btn btn-primary">
        Sign in free to make the recipe
      </Link>
    );
  if (left <= 0)
    return plus ? (
      <p className="text-sm text-muted">That&apos;s {plusPerDay} new recipes today. More tomorrow.</p>
    ) : (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted">You&apos;ve used your free try. Plus builds up to {plusPerDay} recipes a day with you.</p>
        <Link href="/pricing" className="btn btn-sun">
          See Plus
        </Link>
      </div>
    );
  return (
    <div className="flex flex-col gap-1">
      <button type="button" className="btn btn-primary" disabled={pending} onClick={onMake}>
        {pending ? "Writing your recipe… (about 20 seconds)" : "Make my recipe"}
      </button>
      <span className="text-xs text-muted">
        {plus ? `${left} of ${plusPerDay} new recipes left today.` : "Your free try. Plus makes up to " + plusPerDay + " a day."}
      </span>
    </div>
  );
}

function Step({ n, title, hint, done, children }: { n: number; title: string; hint?: string; done: boolean; children: React.ReactNode }) {
  return (
    <section className="card flex flex-col gap-3 p-5">
      <div className="flex items-center gap-3">
        <span
          className={`grid size-8 shrink-0 place-items-center rounded-full font-mono text-sm font-bold ${done ? "bg-basil text-basil-ink" : "bg-sunk text-muted"}`}
          aria-hidden
        >
          {done ? "✓" : n}
        </span>
        <div>
          <h2 className="font-display text-xl font-bold">{title}</h2>
          {hint && <p className="text-sm text-muted">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Chip({ on, onClick, tag, disabled, children }: { on: boolean; onClick: () => void; tag?: string | null; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-40 ${
        on ? "border-basil bg-basil text-basil-ink" : "border-line bg-surface hover:border-basil"
      }`}
    >
      {children}
      {tag && (
        <span className={`rounded-full px-1.5 py-px font-mono text-[10px] uppercase tracking-wide ${on ? "bg-basil-ink/20" : "bg-saffron/30 text-saffron-ink"}`}>
          {tag}
        </span>
      )}
    </button>
  );
}
