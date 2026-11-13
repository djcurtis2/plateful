import { ContactLine } from "@/components/ContactLine";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 pt-10 leading-relaxed">
      <h1 className="font-display text-4xl font-bold tracking-tight">Privacy</h1>
      <p>We store your email to sign you in, the recipes you make, your pantry list and cook-off posts.</p>
      <p>If you sign in with Google, Google shares your name, email address and profile picture with us. We use your email to sign you in and don&apos;t ask for anything else from your Google account.</p>
      <p>Dish photos are sent to Anthropic&apos;s Claude API to identify the dish, and stored so the recipe page can show them. Recipe pages are public by link.</p>
      <p>If you add a grocery receipt to a cook-off entry, the image is sent to Anthropic&apos;s Claude API once to read prices, then discarded. We keep only the result: your cost per plate, the store name and when it was checked. We never keep card numbers, names or addresses from a receipt.</p>
      <p>To prevent abuse we keep a one-way hash of your IP address and a random browser ID with each scan. We never store raw IP addresses.</p>
      <p>Payments are handled by Stripe; we never see your card number. If you use &ldquo;Send to my Kroger cart&rdquo;, the item names on that list go to Kroger and you sign in on Kroger&apos;s own site; we don&apos;t keep your Kroger sign-in. Referral links record when they&apos;re opened and when invited friends sign up and cook.</p>
      <p>You can download a copy of your data or delete your account at any time from your Account page. Deleting removes your account and everything tied to it; recipes you made stay public without your name.</p>
      <ContactLine about="your data" />
    </main>
  );
}
