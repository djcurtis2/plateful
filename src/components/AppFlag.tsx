"use client";
import { useEffect } from "react";
import { isNativeApp, plugin, type AppPlugin } from "@/lib/native";
import { isAppUserAgent } from "@/lib/app-shell";

/** Marks <html data-app> inside the iPhone app so CSS can add phone-only touches (safe areas), and opens tapped yumjack.app links. Does nothing on the website. */
export function AppFlag() {
  useEffect(() => {
    if (isNativeApp() || isAppUserAgent(navigator.userAgent)) document.documentElement.dataset.app = "";
    if (!isNativeApp()) return;
    // A tapped yumjack.app link opens the app, but the web view does not move by itself: load it here.
    const handle = plugin<AppPlugin>("App")?.addListener("appUrlOpen", ({ url }) => {
      try {
        if (new URL(url).hostname === "yumjack.app") window.location.href = url;
      } catch {
        // ignore malformed links
      }
    });
    return () => {
      void handle?.then((h) => h.remove());
    };
  }, []);
  return null;
}
