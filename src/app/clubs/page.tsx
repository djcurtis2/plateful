import type { Metadata } from "next";
import Link from "next/link";
import { CLUBS } from "@/lib/clubs";

export const metadata: Metadata = { title: "Chef clubs" };

export default function ClubsPage() {
  return (
    <main className="flex flex-col gap-6 pt-8">
      <div>
        <span className="label">Community</span>
        <h1 className="font-display text-4xl font-bold tracking-tight">Chef clubs</h1>
        <p className="text-muted">See what each club cooks and saves most.</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {CLUBS.map((c) => (
          <li key={c.id}>
            <Link href={`/clubs/${c.id}`} className="card flex h-full flex-col gap-1 p-4 hover:border-basil">
              <span className="font-display text-lg font-bold">{c.name}</span>
              <span className="text-sm text-muted">{c.blurb}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
