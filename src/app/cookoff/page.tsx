import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentChallenge } from "@/lib/data";
import { CookoffView } from "@/components/CookoffView";

export const metadata: Metadata = {
  title: "Cook-off",
  description: "One restaurant dish a week. Everyone makes it at home, 3 votes each, and two winners take home free Plus.",
};
export const dynamic = "force-dynamic";

export default async function CookoffPage() {
  const challenge = await getCurrentChallenge();
  if (!challenge) {
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-4 py-16 text-center">
        <span className="label">Cook-off</span>
        <h1 className="font-display text-4xl font-bold tracking-tight">The first cook-off starts soon</h1>
        <p className="text-muted">Every week we pick one restaurant dish. Everyone makes it at home, posts their version, and the community votes.</p>
        <Link href="/" className="btn btn-primary mx-auto">
          Snap a dish meanwhile
        </Link>
      </main>
    );
  }
  return <CookoffView challenge={challenge} isCurrent />;
}
