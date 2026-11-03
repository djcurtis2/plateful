import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMe, getPantry } from "@/lib/data";
import { PantryEditor } from "@/components/PantryEditor";

export const metadata: Metadata = { title: "Pantry" };

export default async function PantryPage() {
  const me = await getMe();
  if (!me) redirect("/login?next=/pantry");
  const items = await getPantry(me.user.id);
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 pt-8">
      <div>
        <h1 className="font-display text-4xl font-bold tracking-tight">Pantry</h1>
        <p className="text-muted">What you keep on hand. Dupe Kitchen leaves these off your cart automatically.</p>
      </div>
      <PantryEditor initial={items} />
    </main>
  );
}
