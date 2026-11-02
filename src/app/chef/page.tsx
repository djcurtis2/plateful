import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/data";
import { myChef } from "@/lib/avatar-server";
import { ChefEditor, CHEF_TABS, type ChefTab } from "@/components/ChefEditor";

export const metadata: Metadata = { title: "My chef" };

export default async function ChefPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const me = await getMe();
  if (!me) redirect("/login?next=/chef");
  const chef = await myChef(me.user.id);
  const { tab } = await searchParams;
  // No ?tab= (including the first visit) opens on Look.
  const active: ChefTab = CHEF_TABS.find((t) => t.id === tab)?.id ?? "look";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 pt-8">
      <div>
        <h1 className="font-display text-4xl font-bold tracking-tight">My chef</h1>
        <p className="text-muted">
          {chef.saved ? "Dress your chef, pick your clubs." : "Make your chef. It takes a minute."}
        </p>
      </div>
      <ChefEditor initial={chef.avatar} unlocked={[...chef.unlocked]} clubs={chef.clubs} saved={chef.saved} tab={active} />
    </main>
  );
}
