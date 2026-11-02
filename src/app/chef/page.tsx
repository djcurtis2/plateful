import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/data";
import { myChef } from "@/lib/avatar-server";
import { refreshGearPurchase } from "@/lib/gear-billing";
import { ChefEditor, CHEF_TABS, type ChefTab } from "@/components/ChefEditor";

export const metadata: Metadata = { title: "My chef" };

export default async function ChefPage({ searchParams }: { searchParams: Promise<{ tab?: string; bought?: string }> }) {
  const me = await getMe();
  if (!me) redirect("/login?next=/chef");
  const { tab, bought } = await searchParams;
  // Back from Stripe Checkout: check the session directly in case the webhook is late (safe to repeat).
  const added = typeof bought === "string" ? await refreshGearPurchase(me.user.id, bought) : 0;
  const chef = await myChef(me.user.id);
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
      {typeof bought === "string" && (
        <p role="status" className="card p-4 text-sm">
          {added > 0
            ? "Thanks! Your new gear is unlocked. Pick it below and save your chef."
            : "Thanks for your purchase. If your new gear isn't unlocked yet, give it a minute and refresh."}
        </p>
      )}
      <ChefEditor initial={chef.avatar} unlocked={[...chef.unlocked]} clubs={chef.clubs} saved={chef.saved} plus={chef.ctx.plus} owned={chef.ctx.owned} tab={active} />
    </main>
  );
}
