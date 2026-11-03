import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getMe, getSavedRecipes } from "@/lib/data";
import { Suspense } from "react";
import { LibraryBrowser } from "@/components/LibraryBrowser";

export const metadata: Metadata = { title: "My recipes" };

export default async function LibraryPage() {
  const me = await getMe();
  if (!me) redirect("/login?next=/library");
  const saved = await getSavedRecipes(me.user.id);

  return (
    <main className="flex flex-col gap-6 pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl font-bold tracking-tight">My recipes</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/library/new" className="btn btn-ghost btn-sm">
            Add my own recipe
          </Link>
          <Link href="/" className="btn btn-primary btn-sm">
            Snap a new dish
          </Link>
        </div>
      </div>
      {saved.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-10 text-center">
          <p className="font-display text-xl font-bold">No copycats yet</p>
          <p className="max-w-sm text-muted">Snap a restaurant dish and it lands here, with your pantry already ticked off. Or add your own family recipes.</p>
        </div>
      ) : (
        <Suspense>
          <LibraryBrowser items={saved} myDiets={me.profile?.diets ?? []} />
        </Suspense>
      )}
    </main>
  );
}
