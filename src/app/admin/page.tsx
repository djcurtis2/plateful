import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getAttempts, getChallengeById, getMe, isLive, recipesMissingDietTags, recipesMissingPackSizes } from "@/lib/data";
import { admin, publicImageUrl } from "@/lib/supabase/admin";
import { monthlyTop, publicNames } from "@/lib/game-server";
import { publicName, rankEntries } from "@/lib/game";
import { fillDietTags, fillPackSizes, importSamples, finalize, recordGiftCard, setChefPick, setHidden, setPrizeStatus, setReferencePhoto } from "./actions";
import { ReferencePhotoForm } from "@/components/ReferencePhotoForm";
import { money } from "@/lib/format";
import { AdminButton } from "@/components/AdminButton";
import { NewChallengeForm } from "@/components/NewChallengeForm";
import { SAMPLES } from "@/lib/samples";
import { topSavers } from "@/lib/savings-server";

export const metadata: Metadata = { title: "Cook-off admin", robots: { index: false } };
export const dynamic = "force-dynamic";

function localInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default async function AdminPage() {
  const me = await getMe();
  if (!me?.profile?.is_admin) notFound(); // don't reveal the page exists

  const db = admin();
  const now = new Date();
  const { data: recent } = await db.from("challenges").select("id").order("starts_at", { ascending: false }).limit(4);
  const challenges = (await Promise.all((recent ?? []).map((c) => getChallengeById(c.id)))).filter((c) => c !== null);
  const needsWork = challenges.filter((c) => !c.finalized_at);
  const boards = await Promise.all(needsWork.map(async (c) => ({ c, entries: rankEntries(await getAttempts({ challengeId: c.id }, 200)) })));

  const { data: prizes } = await db.from("prize_awards").select("*").eq("status", "pending").order("created_at", { ascending: true });
  const prizeNames = await publicNames((prizes ?? []).map((p) => p.user_id));

  const { data: reports } = await db.from("attempt_reports").select("attempt_id, reason");
  const reportCounts = new Map<string, number>();
  for (const r of reports ?? []) reportCounts.set(r.attempt_id, (reportCounts.get(r.attempt_id) ?? 0) + 1);
  const { data: reported } = reportCounts.size
    ? await db.from("attempts").select("id, user_id, image_path, caption, hidden").in("id", [...reportCounts.keys()])
    : { data: [] };
  const reportedNames = await publicNames((reported ?? []).map((r) => r.user_id));

  const missingPacks = (await recipesMissingPackSizes()).length;
  const missingDiets = (await recipesMissingDietTags()).length;
  const thisMonth = now.toISOString().slice(0, 7);
  const lastMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const lastMonth = lastMonthDate.toISOString().slice(0, 7);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [topLast, topThis, [saverLast]] = await Promise.all([monthlyTop(lastMonth), monthlyTop(thisMonth), topSavers(lastMonthDate, 1, monthStart)]);

  const nextStart = new Date(now);
  nextStart.setDate(now.getDate() + ((7 - now.getDay()) % 7 || 7)); // next Sunday
  nextStart.setHours(9, 0, 0, 0);
  const nextEnd = new Date(nextStart.getTime() + 6 * 86_400_000);
  nextEnd.setHours(21, 0, 0, 0);

  return (
    <main className="flex flex-col gap-10 pt-8">
      <div>
        <span className="label">Admin</span>
        <h1 className="font-display text-4xl font-bold tracking-tight">Cook-off admin</h1>
        <p className="text-muted">Pick the Chef&apos;s pick, finalize winners, hand out prizes, and schedule next week.</p>
      </div>

      {boards.length === 0 && <p className="card p-5 text-muted">Nothing to judge right now.</p>}
      {boards.map(({ c, entries }) => {
        const live = isLive(c);
        return (
          <section key={c.id} className="card flex flex-col gap-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className="label">{live ? "Live · voting open" : "Voting closed · not finalized"}</span>
                <h2 className="font-display text-2xl font-bold">{c.title}</h2>
                <p className="text-sm text-muted">
                  {entries.length} entries · closes {new Date(c.ends_at).toLocaleString("en-US")} ·{" "}
                  <Link href={`/cookoff/c/${c.slug}`} className="underline">
                    view
                  </Link>
                </p>
              </div>
              {!live && (
                <AdminButton
                  action={finalize.bind(null, c.id)}
                  label="Finalize and award prizes"
                  confirm={c.chef_pick_attempt_id ? "Locks results and gives out prizes." : "No Chef's pick chosen. Only the Crowd favorite will win."}
                  className="btn btn-sun"
                />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-sunk p-3">
              {c.reference_image_url && (
                <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-surface">
                  <Image src={c.reference_image_url} alt="Reference" fill sizes="64px" className="object-cover" />
                </span>
              )}
              <div className="flex flex-col gap-1">
                <p className="text-xs text-muted">
                  {c.reference_image_url !== c.recipe.image_url
                    ? "Voters compare copies against this photo."
                    : "Using the snapped recipe photo as the original. Upload a better one (yours or licensed)."}
                </p>
                <ReferencePhotoForm action={setReferencePhoto.bind(null, c.id)} hasPhoto={c.reference_image_url !== c.recipe.image_url} />
              </div>
            </div>
            {entries.length > 0 && (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {entries.map((e, i) => {
                  const picked = c.chef_pick_attempt_id === e.id;
                  return (
                    <li key={e.id} className={`flex flex-col gap-1.5 rounded-2xl border p-2 ${picked ? "border-saffron" : "border-line"}`}>
                      <Link href={`/cookoff/e/${e.id}`} className="relative aspect-square overflow-hidden rounded-xl bg-sunk">
                        <Image src={e.image_url} alt="" fill sizes="160px" className="object-cover" />
                      </Link>
                      <p className="truncate text-xs font-semibold">
                        #{i + 1} {publicName(e.name)} · ▲{e.votes}
                      </p>
                      {e.cost_per_plate != null && (
                        <p className="tabular font-mono text-[11px] text-muted">
                          {money(e.cost_per_plate)} {e.cost_source === "receipt" ? "✓ receipt" : "self"}
                        </p>
                      )}
                      <AdminButton
                        action={setChefPick.bind(null, c.id, picked ? null : e.id)}
                        label={picked ? "Chef's pick ✓" : "Make Chef's pick"}
                        className={`btn btn-sm px-2 py-1 text-xs ${picked ? "btn-sun" : "btn-ghost"}`}
                      />
                      <AdminButton action={setHidden.bind(null, e.id, true)} label="Hide" confirm="Removes it from the cook-off." className="text-left text-[11px] text-muted underline" />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      <section className="card flex flex-col gap-4 p-5">
        <h2 className="font-display text-2xl font-bold">Prizes to send</h2>
        {!prizes?.length ? (
          <p className="text-muted">Nothing pending. Plus months are applied automatically when you finalize.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {prizes.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <b>{publicName(prizeNames[p.user_id])}</b> · {p.detail} · {p.reason.replace("_", " ")}
                  {p.period ? ` · ${p.period}` : ""}
                </span>
                <span className="flex gap-2">
                  <AdminButton action={setPrizeStatus.bind(null, p.id, "fulfilled")} label="Mark sent" className="btn btn-primary btn-sm" />
                  <AdminButton action={setPrizeStatus.bind(null, p.id, "cancelled")} label="Cancel" confirm="Cancel this prize?" />
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { label: `Last month (${lastMonth})`, top: topLast, period: lastMonth, closed: true },
            { label: `This month so far (${thisMonth})`, top: topThis, period: thisMonth, closed: false },
          ].map(({ label, top, period, closed }) => (
            <div key={period} className="rounded-2xl bg-sunk p-4 text-sm">
              <p className="label">Monthly gift card · {label}</p>
              {top ? (
                <p className="mt-1">
                  <b>{publicName(top.name)}</b> with {top.points} points
                </p>
              ) : (
                <p className="mt-1 text-muted">No points yet.</p>
              )}
              {top && closed && <div className="mt-2"><AdminButton action={recordGiftCard.bind(null, top.userId, period)} label="Award gift card" /></div>}
              {!closed && <p className="mt-1 text-xs text-muted">Award once the month is over.</p>}
            </div>
          ))}
          <div className="rounded-2xl bg-sunk p-4 text-sm sm:col-span-2">
            <p className="label">Top saver gift card · {lastMonth}</p>
            {saverLast ? (
              <>
                <p className="mt-1">
                  <b>{publicName(saverLast.name)}</b> saved ${saverLast.saved.toFixed(2)} over {saverLast.meals} meals
                </p>
                <div className="mt-2">
                  <AdminButton action={recordGiftCard.bind(null, saverLast.userId, lastMonth, "top_saver")} label="Award gift card" />
                </div>
              </>
            ) : (
              <p className="mt-1 text-muted">No savings logged last month.</p>
            )}
          </div>
        </div>
      </section>

      <section className="card flex flex-col gap-4 p-5">
        <h2 className="font-display text-2xl font-bold">Reported entries</h2>
        {!reported?.length ? (
          <p className="text-muted">No reports. Entries with 3 reports are hidden automatically until you review them.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {reported.map((r) => (
              <li key={r.id} className="flex flex-col gap-1.5 rounded-2xl border border-line p-2 text-xs">
                <span className="relative aspect-square overflow-hidden rounded-xl bg-sunk">
                  <Image src={publicImageUrl("attempts", r.image_path)!} alt="" fill sizes="160px" className="object-cover" />
                </span>
                <span>
                  {publicName(reportedNames[r.user_id])} · {reportCounts.get(r.id)} reports · {r.hidden ? "hidden" : "visible"}
                </span>
                {r.hidden ? (
                  <AdminButton action={setHidden.bind(null, r.id, false)} label="Restore" />
                ) : (
                  <AdminButton action={setHidden.bind(null, r.id, true)} label="Hide" confirm="Removes it from the cook-off." />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card flex flex-col gap-3 p-5">
        <h2 className="font-display text-2xl font-bold">Recipe data</h2>
        <p className="text-sm text-muted">
          {missingPacks
            ? `${missingPacks} older ${missingPacks === 1 ? "recipe has" : "recipes have"} no package sizes, so "Use it up" can only guess what's left over.`
            : "Every recipe has package sizes."}
        </p>
        {missingPacks > 0 && <AdminButton action={fillPackSizes} label="Fill in package sizes (10 at a time)" className="btn btn-primary btn-sm w-fit" />}
        <p className="text-sm text-muted">
          {missingDiets
            ? `${missingDiets} ${missingDiets === 1 ? "recipe has" : "recipes have"} no diet tags yet, so they're hidden from anyone filtering by diet.`
            : "Every recipe has diet tags."}
        </p>
        {missingDiets > 0 && <AdminButton action={fillDietTags} label="Tag diets (10 at a time)" className="btn btn-primary btn-sm w-fit" />}
        <p className="text-sm text-muted">
          Sample recipes: {SAMPLES.length} copycats and Plateful originals with free Unsplash photos, so the site doesn&apos;t look empty. Remove them with
          supabase/demo_cleanup.sql.
        </p>
        <AdminButton action={importSamples} label="Add sample recipes" className="btn btn-ghost btn-sm w-fit" />
      </section>

      <section className="card flex flex-col gap-4 p-5">
        <h2 className="font-display text-2xl font-bold">Schedule the next cook-off</h2>
        <p className="text-sm text-muted">Snap the dish first so it has a recipe page, then paste that page&apos;s URL here.</p>
        <NewChallengeForm defaultStart={localInput(nextStart)} defaultEnd={localInput(nextEnd)} />
      </section>
    </main>
  );
}
