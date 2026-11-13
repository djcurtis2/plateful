import Link from "next/link";
import { mySavings } from "@/lib/savings-server";
import { cookies } from "next/headers";
import { getMe } from "@/lib/data";
import { headerStats } from "@/lib/game-server";
import { chefFrom, ownedGear, type ChefCard } from "@/lib/avatar-server";
import { GEAR_BY_ID, newUnlocks, visibleAvatar, type Avatar, type GearItem } from "@/lib/avatar";
import { GearUnlock } from "@/components/GearUnlock";
import { ChefAvatar } from "@/components/ChefAvatar";
import { UserMenu } from "@/components/UserMenu";
import { publicName } from "@/lib/game";
import { SEEN_COOKIE, WELCOME_COOKIE } from "@/lib/cookies";
import { LevelIcon } from "@/components/GameIcons";
import { StatusToast } from "@/components/StatusToast";

export function Logo() {
  return (
    <span className="flex items-center gap-2 whitespace-nowrap font-display text-lg font-bold tracking-tight sm:text-xl">
      <span
        aria-hidden
        className="inline-block size-5 rounded-full bg-saffron shadow-[inset_0_0_0_5px_var(--basil)]"
      />
      Yumjack
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
  let gear: { items: GearItem[]; avatar: Avatar } | null = null;
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
      // All unseen gear shows in one celebration, so a backlog doesn't drip out one item per page load.
      const fresh = !busyToast ? newUnlocks(mine.unlocked, mine.seen).map((id) => GEAR_BY_ID[id]).filter(Boolean) : [];
      if (fresh.length) gear = { items: fresh, avatar: mine.avatar };
    } catch (e) {
      console.error("header stats failed", e);
    }
  }
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <Link href="/" aria-label="Yumjack home">
            <Logo />
          </Link>
          <nav className="flex items-center gap-1 whitespace-nowrap text-sm font-medium sm:gap-3">
            <Link
              href="/cookoff"
              className="rounded-lg px-2 py-1.5 text-muted hover:text-ink"
            >
              Cook-off
            </Link>
            <Link href="/games" className="hidden rounded-lg px-2 py-1.5 text-muted hover:text-ink md:inline">
              Games
            </Link>
            <Link
              href="/leaderboard"
              className="hidden rounded-lg px-2 py-1.5 text-muted hover:text-ink sm:inline"
            >
              Leaderboard
            </Link>
            {!me?.plus && (
              <Link href="/pricing" className={`rounded-lg px-2 py-1.5 font-semibold text-basil hover:text-ink ${me ? "" : "hidden min-[400px]:inline"}`}>
                Plus
              </Link>
            )}
            {me ? (
              <>
                <Link
                  href="/library"
                  className="hidden rounded-lg px-2 py-1.5 text-muted hover:text-ink sm:inline"
                >
                  My recipes
                </Link>
                <Link href="/plan" className="hidden rounded-lg px-2 py-1.5 text-muted hover:text-ink md:inline">
                  Plan
                </Link>
                <Link
                  href="/pantry"
                  className="hidden rounded-lg px-2 py-1.5 text-muted hover:text-ink lg:inline"
                >
                  Pantry
                </Link>
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
                {(() => {
                  // Never saved a chef: nudge with a dot until they make one.
                  const nudge = me.profile?.avatar == null;
                  const label = nudge ? "Make your chef" : "My chef";
                  return (
                    <UserMenu label={label} nudge={nudge} plus={me.plus}>
                      {chef ? (
                        <ChefAvatar avatar={chef.avatar} head size={32} uid="header-chef" />
                      ) : (
                        <span className="flex size-8 items-center justify-center rounded-full border border-line bg-surface text-xs">Me</span>
                      )}
                    </UserMenu>
                  );
                })()}
              </>
            ) : (
              <Link href="/login" className="btn btn-primary btn-sm">
                Sign up free
              </Link>
            )}
          </nav>
        </div>
      </header>
      {toast && <StatusToast {...toast} />}
      {gear && <GearUnlock key={gear.items[0].id} items={gear.items} avatar={gear.avatar} uid={me!.user.id.slice(0, 8)} />}
    </>
  );
}
