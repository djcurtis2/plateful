import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/data";
import { OwnRecipeForm } from "@/components/OwnRecipeForm";

export const metadata: Metadata = { title: "Add my own recipe" };

type Search = { searchParams: Promise<{ next?: string; meal?: string }> };

export default async function NewOwnRecipePage({ searchParams }: Search) {
  const sp = await searchParams;
  // Only come back to the week planner's picker; anything else goes to the new recipe's page.
  const next = sp.next?.startsWith("/plan/pick?") ? sp.next : null;
  const me = await getMe();
  if (!me) redirect(`/login?next=${encodeURIComponent(`/library/new${next ? `?next=${encodeURIComponent(next)}` : ""}`)}`);
  return (
    <main className="flex flex-col gap-6 pt-8">
      <div>
        <span className="label">My recipes</span>
        <h1 className="font-display text-4xl font-bold tracking-tight">Add my own recipe</h1>
        <p className="max-w-[60ch] text-muted">
          The family favorite, the Tuesday standby, the thing you make without looking. Save it here and put it in any week.
        </p>
      </div>
      <OwnRecipeForm next={next} meal={sp.meal ?? null} />
    </main>
  );
}
