import Link from "next/link";
import { cookies } from "next/headers";
import { getMe } from "@/lib/data";
import { headerStats } from "@/lib/game-server";
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
  let toast: React.ComponentProps<typeof StatusToast> | null = null;
  if (me) {
    try {
      stats = await headerStats(me.user.id);
      const jar = await cookies();
      const seen = jar.get(SEEN_COOKIE)?.value?.split("|").map(Number);
      const welcome = jar.get(WELCOME_COOKIE)?.value === "1";
      const seenBadges = seen && Number.isFinite(seen[1]) ? seen[1] : null;
      const seenLevel = seen && Number.isFinite(seen[2]) ? seen[2] : null;
      toast = {
        name: publicName(me.profile?.public_name),
        points: stats.points,
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
                {stats && (
                  <Link
                    href="/account"
                    className="ml-1 flex items-center gap-1.5 rounded-full border border-line bg-surface py-0.5 pl-0.5 pr-2.5 hover:border-basil"
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
    </>
  );
}
