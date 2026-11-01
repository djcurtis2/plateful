import type { Metadata } from "next";
import { POINTS, PRIZES, VOTES_PER_COOKOFF } from "@/lib/game";

export const metadata: Metadata = { title: "Cook-off rules" };

export default function RulesPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 pt-10 leading-relaxed">
      <h1 className="font-display text-4xl font-bold tracking-tight">Cook-off official rules</h1>
      <p className="rounded-2xl bg-saffron/20 px-4 py-3 text-sm">Draft. Have a lawyer review before awarding real prizes.</p>
      <h2 className="font-display text-xl font-bold">Entering</h2>
      <p>No purchase is necessary. Free accounts can enter. You must be 18 or older and a US resident. One entry per person per cook-off; posting again replaces your entry and resets its votes. Your photo must be of food you made yourself.</p>
      <h2 className="font-display text-xl font-bold">Voting</h2>
      <p>Each signed-in person gets {VOTES_PER_COOKOFF} votes per cook-off and can&apos;t vote for their own entry. Vote for the copies that look closest to the original dish. Votes can be taken back and moved until voting closes. Fake accounts, bought votes or automated voting will get entries removed.</p>
      <h2 className="font-display text-xl font-bold">Winners and prizes</h2>
      <p>
        Up to three winners each week. <b>Crowd favorite</b>: the entry with the most votes when voting closes (ties go to the earlier entry). <b>Chef&apos;s pick</b>: the best-looking copy, chosen by the Plateful team based on how closely it matches the original and how good it looks. Each wins {PRIZES.crowd_favorite.plusMonths} months of Plateful Plus, a winner badge, and may be featured on Plateful&apos;s homepage and social accounts. <b>Thriftiest copy</b>: the lowest receipt-verified price per plate (ties go to the earlier entry), which wins {PRIZES.thriftiest.plusMonths} month of Plus and a badge. Self-reported prices can&apos;t win Thriftiest copy. The month&apos;s top points scorer wins a {PRIZES.monthlyGiftCard}. Prizes have no cash value and can&apos;t be transferred.
      </p>
      <h2 className="font-display text-xl font-bold">Points</h2>
      <p>Points ({POINTS.post} for an entry, {POINTS.vote_received} per vote received, and more) count toward levels and the monthly prize. Plateful may remove points earned through abuse.</p>
      <h2 className="font-display text-xl font-bold">Prices and receipts</h2>
      <p>
        You can add your cost per plate, cooking time, swaps and notes to your entry. Prices you type in are shown as self-reported. To get a verified price, add a photo of your grocery receipt: Plateful reads it once to match items to the recipe and work out your cost per plate, then discards the image. We keep only the result (price, store name and date checked). The receipt must be dated from two weeks before the cook-off started onward and cover at least half of the recipe&apos;s paid ingredients. Pantry staples you already had count at the recipe&apos;s estimate. Plateful may remove a verified badge it believes is inaccurate.
      </p>
      <h2 className="font-display text-xl font-bold">Your photos</h2>
      <p>By entering, you let Plateful show your photo, public name and caption on Plateful and its social accounts. Plateful isn&apos;t affiliated with any restaurant named in a cook-off.</p>
    </main>
  );
}
