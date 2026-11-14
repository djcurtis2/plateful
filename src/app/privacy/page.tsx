import { ContactLine } from "@/components/ContactLine";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 pt-10 leading-relaxed">
      <h1 className="font-display text-4xl font-bold tracking-tight">Privacy</h1>
      <p className="text-sm text-muted">Last updated November 14, 2026</p>
      <p>We store your email to sign you in, the recipes you make, your pantry list and cook-off posts.</p>
      <p>If you sign in with Google, Google shares your name, email address and profile picture with us. We use your email to sign you in and don&apos;t ask for anything else from your Google account.</p>
      <p>Dish photos are sent to Anthropic&apos;s Claude API to identify the dish, and stored so the recipe page can show them. Recipe pages are public by link.</p>
      <p>If you add a grocery receipt to a cook-off entry, the image is sent to Anthropic&apos;s Claude API once to read prices, then discarded. We keep only the result: your cost per plate, the store name and when it was checked. We never keep card numbers, names or addresses from a receipt.</p>
      <p>To prevent abuse we keep a one-way hash of your IP address and a random browser ID with each scan. We never store raw IP addresses.</p>
      <p>Payments are handled by Stripe; we never see your card number. If you use &ldquo;Send to my Kroger cart&rdquo;, the item names on that list go to Kroger and you sign in on Kroger&apos;s own site; we don&apos;t keep your Kroger sign-in. Referral links record when they&apos;re opened and when invited friends sign up and cook. We count page visits with Vercel Web Analytics, which uses no cookies and keeps no personal data.</p>
      <p>Purchases in the iPhone app go through Apple, and RevenueCat processes the purchase records for us: it receives your Yumjack account ID and what you bought from Apple, never your card details. Apple handles refunds for those purchases.</p>
      <p>You can download a copy of your data or delete your account at any time from your Account page. Deleting removes your account and everything tied to it; recipes you made stay public without your name.</p>
      <h2 className="font-display text-2xl font-bold">If you live outside the US (EU, UK and elsewhere)</h2>
      <p>Yumjack is run from the United States, and your data is stored and processed there, whichever country you are in. Where your country&apos;s law requires it, we rely on the standard safeguards our providers offer for sending data abroad.</p>
      <p>What we collect and why: your email (to sign you in), the recipes, photos, pantry list and posts you make (to run the app), purchase records (to give you Plus or gear), your App Store country (to show the right options in the app), a push notification token and your time zone if you turn on notifications (to send them at the right time), and a one-way hash of your IP address with a random browser ID (to prevent abuse and keep scan limits fair).</p>
      <p>Why we are allowed to use it: to provide the service you asked for (your account, recipes and purchases); with your consent for notifications and optional features, which you can turn off at any time; and for our legitimate interest in keeping Yumjack secure and free of abuse.</p>
      <p>Your rights: you can ask for a copy of your data, ask us to fix it, delete it, or object to how we use it. Deleting your account from the Account page removes your account and everything tied to it, and the Account page also lets you download a copy. If you are unhappy with how we handle your data, you can complain to the data protection authority in your country.</p>
      <p>Who handles data for us: Supabase (database, sign-in and photo storage), Vercel (hosting and cookie-free visit counts), Stripe (card payments on the website), Apple (App Store purchases and push notifications), RevenueCat (purchase records for the iPhone app), and Anthropic (reading dish photos and receipts, and writing recipes). Each only receives what it needs to do its job. We don&apos;t sell your data.</p>
      <p>Push notifications: if you allow them, we store a token Apple gives your phone, plus your time zone, so we can send you at most one notification of each kind a day. Turn them off in your phone&apos;s Settings and you stop receiving them. Deleting your account deletes the token.</p>
      <p>How long we keep things: your account data, recipes you save, posts, points and purchase records stay while your account exists. When you delete your account, they are deleted, except that recipes you made stay public without your name. We keep anonymous counts of scans (with the IP hash and browser ID removed, so nothing links them to you) for cost limits and statistics. Receipt images are never kept. Purchase records may be kept longer where tax or accounting law requires it, for example by Stripe and Apple.</p>
      <p>Cookies: we set a sign-in cookie (Supabase); an anonymous visitor ID, pf_vid (1 year), for abuse limits; a referral code, pf_ref (30 days), only if you open a friend&apos;s invite link; pf_seen (1 year), which remembers which points and badges you&apos;ve already seen; pf_welcome (10 minutes), to show a welcome card once after sign-in; and yj_kroger (1 hour), only while you sign in to Kroger. There is no cookie banner because they are used only for sign-in, security, referrals and remembering your own settings, with no advertising or tracking.</p>
      <ContactLine about="your data or these rights" />
    </main>
  );
}
