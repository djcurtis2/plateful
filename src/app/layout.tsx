import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { Header } from "@/components/Header";
import { siteUrl } from "@/lib/env";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-bricolage" });
const body = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-instrument" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Plateful — make restaurant dishes at home for less", template: "%s · Plateful" },
  description: "Snap a restaurant dish. Get the copycat recipe, see what you save per plate, and shop the ingredients in one tap.",
  openGraph: { siteName: "Plateful", type: "website" },
  twitter: { card: "summary_large_image" },
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
      <body className="min-h-dvh">
        <Header />
        <div className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">{children}</div>
        <footer className="border-t border-line">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap justify-between gap-4 px-4 py-8 text-sm text-muted sm:px-6">
            <p>Plateful makes copycat recipes inspired by restaurant dishes. Not affiliated with any restaurant.</p>
            <nav className="flex gap-4">
              <a href="/cookoff" className="hover:text-ink">Cook-off</a>
              <a href="/leaderboard" className="hover:text-ink">Leaderboard</a>
              <a href="/rules" className="hover:text-ink">Rules</a>
              <a href="/pricing" className="hover:text-ink">Pricing</a>
              <a href="/terms" className="hover:text-ink">Terms</a>
              <a href="/privacy" className="hover:text-ink">Privacy</a>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
