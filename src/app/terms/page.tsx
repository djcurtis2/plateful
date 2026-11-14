import { ContactLine } from "@/components/ContactLine";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 pt-10 leading-relaxed">
      <h1 className="font-display text-4xl font-bold tracking-tight">Terms of use</h1>
      <p>Yumjack generates copycat recipes inspired by dishes in photos you upload. Recipes are AI-generated estimates: check ingredients for allergens and cook food to safe temperatures.</p>
      <p>Restaurant names are used only to describe the dish a recipe is inspired by. Yumjack is not affiliated with, endorsed by, or sponsored by any restaurant.</p>
      <p>Prices shown are estimates of typical US prices and are not offers. Grocery links go to third-party stores whose terms apply.</p>
      <p>You keep rights to photos you upload and give Yumjack permission to display them with the recipe and in the cook-off. Don&apos;t upload photos of other people without permission.</p>
      <p>Plus is billed monthly or yearly through Stripe and can be cancelled anytime from your account; it stays active until the end of the paid period.</p>
      <h2 className="font-display text-2xl font-bold">Digital items</h2>
      <p>
        Chef gear bought in the shop is a digital item that only changes how your chef looks. It is tied to your Yumjack account, has no cash value,
        can&apos;t be transferred, sold or exchanged, and is paid once through Stripe. Refunds are at our discretion; contact us if something went wrong.
      </p>
      <h2 className="font-display text-2xl font-bold">Buying in the iPhone app</h2>
      <p>
        In the Yumjack iPhone app you can pay for Plus and chef gear through Apple. Those purchases are billed by Apple to your Apple ID, Plus renews
        automatically until you cancel it in iPhone Settings, and Apple&apos;s terms apply. Refunds for Apple purchases are handled by Apple
        (reportaproblem.apple.com); if Apple refunds a purchase, the Plus time or gear it paid for is removed.
      </p>
      <h2 className="font-display text-2xl font-bold">Using Yumjack in other countries</h2>
      <p>
        The Yumjack app is available in many countries, but the content is US-focused: recipes are in English, and menu prices, home costs, savings
        and grocery stores are estimates in US dollars that may not match what you pay where you live. Store links work only in the US and Canada.
        What you pay in the App Store is set by Apple in your local currency and includes any local taxes Apple collects.
      </p>
      <ContactLine about="these terms or a purchase" />
    </main>
  );
}
