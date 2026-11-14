import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import Script from "next/script";
import { Header } from "@/components/Header";
import { siteUrl } from "@/lib/env";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-bricolage" });
const body = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-instrument" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-jetbrains" });

const IMPACT_SITE_ID = "6761530c-c63b-4602-a0be-614e6a933c59";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Yumjack — make restaurant dishes at home for less", template: "%s · Yumjack" },
  description: "Snap a restaurant dish. Get the copycat recipe, see what you save per plate, and shop the ingredients in one tap.",
  openGraph: { siteName: "Yumjack", type: "website" },
  twitter: { card: "summary_large_image" },
  // iPhone "Add to Home Screen": open full screen under the Yumjack name.
  appleWebApp: { capable: true, title: "Yumjack", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f5f0" },
    { media: "(prefers-color-scheme: dark)", color: "#111813" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <head>
        {/* Impact (Instacart affiliate program) site ownership check. Impact reads `value`; `content` is the standard spelling. */}
        <meta name="impact-site-verification" content={IMPACT_SITE_ID} {...{ value: IMPACT_SITE_ID }} />
      </head>
      <body className="min-h-dvh">
        <Header />
        <div className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">{children}</div>
        <footer className="border-t border-line">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap justify-between gap-4 px-4 py-8 text-sm text-muted sm:px-6">
            <p>Yumjack makes copycat recipes inspired by restaurant dishes. Not affiliated with any restaurant.</p>
            <nav className="flex flex-wrap gap-x-4 gap-y-2">
              <Link href="/cookoff" className="hover:text-ink">Cook-off</Link>
              <Link href="/games" className="hover:text-ink">Daily games</Link>
              <Link href="/trivia" className="hover:text-ink">Daily trivia</Link>
              <Link href="/leaderboard" className="hover:text-ink">Leaderboard</Link>
              <Link href="/clubs" className="hover:text-ink">Clubs</Link>
              <Link href="/cookoff/past" className="hover:text-ink">Hall of fame</Link>
              <Link href="/rules" className="hover:text-ink">Rules</Link>
              <Link href="/pricing" className="hover:text-ink">Pricing</Link>
              <Link href="/terms" className="hover:text-ink">Terms</Link>
              <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            </nav>
          </div>
        </footer>
        {/* Vercel Web Analytics (no cookies, no personal data). Served from our own domain; does nothing on localhost.
            Bio links carry ?utm_source=tiktok etc.; the UTM tab is a paid add-on, so we log a "Visit from" event instead (once per tab). */}
        <Script id="vercel-analytics-queue" strategy="afterInteractive">
          {`window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};
try{var s=(new URLSearchParams(location.search).get("utm_source")||"").toLowerCase().replace(/[^a-z0-9_-]/g,"").slice(0,30);
if(s&&!sessionStorage.getItem("yj-src")){sessionStorage.setItem("yj-src",s);window.va("event",{name:"Visit from",data:{source:s}});}}catch(e){}`}
        </Script>
        <Script src="/_vercel/insights/script.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
