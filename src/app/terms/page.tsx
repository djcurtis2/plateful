import type { Metadata } from "next";
export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 pt-10 leading-relaxed">
      <h1 className="font-display text-4xl font-bold tracking-tight">Terms of use</h1>
      <p className="rounded-2xl bg-saffron/20 px-4 py-3 text-sm">Draft placeholder. Have a lawyer review before launch.</p>
      <p>Plateful generates copycat recipes inspired by dishes in photos you upload. Recipes are AI-generated estimates: check ingredients for allergens and cook food to safe temperatures.</p>
      <p>Restaurant names are used only to describe the dish a recipe is inspired by. Plateful is not affiliated with, endorsed by, or sponsored by any restaurant.</p>
      <p>Prices shown are estimates of typical US prices and are not offers. Grocery links go to third-party stores whose terms apply.</p>
      <p>You keep rights to photos you upload and give Plateful permission to display them with the recipe and in the cook-off. Don&apos;t upload photos of other people without permission.</p>
      <p>Plus is billed monthly through Stripe and can be cancelled anytime from your account; it stays active until the end of the paid period.</p>
      <h2 className="font-display text-2xl font-bold">Digital items</h2>
      <p>
        Chef gear bought in the shop is a digital item that only changes how your chef looks. It is tied to your Plateful account, has no cash value,
        can&apos;t be transferred, sold or exchanged, and is paid once through Stripe. Refunds are at our discretion; contact us if something went wrong.
      </p>
    </main>
  );
}
