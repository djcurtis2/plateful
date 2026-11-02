import Link from "next/link";
import { mySavings } from "@/lib/savings-server";
import { cookies } from "next/headers";
import { getMe } from "@/lib/data";
import { headerStats } from "@/lib/game-server";
import { chefFrom, ownedGear, type ChefCard } from "@/lib/avatar-server";
import { GEAR_BY_ID, newUnlocks, visibleAvatar, type Avatar, type GearItem } from "@/lib/avatar";
import { GearUnlock } from "@/components/GearUnlock";
import { ChefAvatar } from "@/components/ChefAvatar";
import { publicName } from "@/lib/game";
import { SEEN_COOKIE, WELCOME_COOKIE } from "@/lib/cookies";
import { LevelIcon } from "@/components/GameIcons";
import { StatusToast } from "@/components/StatusToast";

export function Logo() {
  return (
    <span className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
      <span
        aria-hidden
        className="inline-block size-5 rounded-full bg-saffron shadow-[inset_0_0_0_5px_var(--basil)]"
      />
      Plateful
    </span>
  );
}

export async function Header() {
  let me = null;
  try {
    me = await getMe();
  } catch {
    // Supabase not configured yet: render a signed-out header.
  }
  let stats: Awaited<ReturnType<typeof headerStats>> | null = null;
  let chef: ChefCard | null = null;
  let toast: React.ComponentProps<typeof StatusToast> | null = null;
  let gear: { item: GearItem; avatar: Avatar } | null = null;
  if (me) {
    try {
      const [st, sv, owned] = await Promise.all([
        headerStats(me.user.id),
        mySavings(me.user.id),
        ownedGear(me.user.id).catch(() => [] as string[]),
      ]);
      // Built from the profile getMe already read plus points/badges from headerStats: no repeat queries.
      const mine = chefFrom(me.user.id, me.profile, { points: st.points, badges: st.badges, owned });
      stats = st;
      chef = { name: me.profile?.public_name ?? null, avatar: visibleAvatar(mine.avatar, mine.ctx.plus), clubs: mine.clubs };
      const jar = await cookies();
      const seen = jar.get(SEEN_COOKIE)?.value?.split("|").map(Number);
      const welcome = jar.get(WELCOME_COOKIE)?.value === "1";
      const seenBadges = seen && Number.isFinite(seen[1]) ? seen[1] : null;
      const seenLevel = seen && Number.isFinite(seen[2]) ? seen[2] : null;
      toast = {
        name: publicName(me.profile?.public_name),
        points: stats.points,
        saved: sv.saved,
        levelIndex: stats.level.index,
        levelName: stats.level.name,
        next: stats.level.next,
        toNext: stats.level.toNext,
        progress: stats.level.progress,
        badges: stats.badges,
        // Badges are newest first, so the new ones are at the front.
        newBadges:
          seenBadges != null && stats.badges.length > seenBadges
            ? stats.badges.slice(0, stats.badges.length - seenBadges)
            : [],
        levelUp: seenLevel != null && stats.level.index > seenLevel,
        welcome,
        seenValue: `${stats.points}|${stats.badges.length}|${stats.level.index}`,
        hasBaseline: !!seen,
      };
      // Gear can wait a load if the level/badge/welcome toast is showing.
      const busyToast = toast.levelUp || toast.newBadges.length > 0 || toast.welcome;
      const first = !busyToast ? newUnlocks(mine.unlocked, mine.seen)[0] : undefined;
      if (first && GEAR_BY_ID[first]) gear = { item: GEAR_BY_ID[first], avatar: mine.avatar };
    } catch (e) {
      console.error("header stats failed", e);
    }
  }
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" aria-label="Plateful home">
            <Logo />
          </Link>
          <nav className="flex items-center gap-1 text-sm font-medium sm:gap-3">
            <Link
              href="/cookoff"
              className="rounded-lg px-2 py-1.5 text-muted hover:text-ink"
            >
              Cook-off
            </Link>
            <Link
              href="/leaderboard"
              className="hidden rounded-lg px-2 py-1.5 text-muted hover:text-ink sm:inline"
            >
              Leaderboard
            </Link>
            {me ? (
              <>
                <Link
                  href="/library"
                  className="rounded-lg px-2 py-1.5 text-muted hover:text-ink"
                >
                  My recipes
                </Link>
                <Link href="/plan" className="hidden rounded-lg px-2 py-1.5 text-muted hover:text-ink md:inline">
                  Plan
                </Link>
                <Link
                  href="/pantry"
                  className="hidden rounded-lg px-2 py-1.5 text-muted hover:text-ink sm:inline"
                >
                  Pantry
                </Link>
                <Link
                  href="/account"
                  className="rounded-lg px-2 py-1.5 text-muted hover:text-ink"
                >
                  {me.plus ? "Plus" : "Account"}
                </Link>
                {chef && (() => {
                  // Never saved a chef: nudge with a dot until they make one.
                  const nudge = me.profile?.avatar == null;
                  const label = nudge ? "Make your chef" : "My chef";
                  return (
                    <Link href="/chef" aria-label={label} title={label} className="relative ml-1 flex rounded-full hover:opacity-80">
                      <ChefAvatar avatar={chef.avatar} head size={32} uid="header-chef" />
                      {nudge && (
                        <span aria-hidden className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-chili ring-2 ring-bg" />
                      )}
                    </Link>
                  );
                })()}
                {stats && (
                  <Link
                    href="/account"
                    className="flex items-center gap-1.5 rounded-full border border-line bg-surface py-0.5 pl-0.5 pr-2.5 hover:border-basil"
                    title={`${stats.level.name} · ${stats.points} points${stats.badges.length ? ` · ${new Set(stats.badges).size} badges` : ""}`}
                  >
                    <LevelIcon index={stats.level.index} size={26} />
                    <span className="tabular font-mono text-xs font-semibold">
                      {stats.points}
                    </span>
                  </Link>
                )}
              </>
            ) : (
              <Link href="/login" className="btn btn-ghost btn-sm">
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>
      {toast && <StatusToast {...toast} />}
      {gear && <GearUnlock key={gear.item.id} item={gear.item} avatar={gear.avatar} uid={me!.user.id.slice(0, 8)} />}
    </>
  );
}
