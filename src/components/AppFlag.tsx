"use client";
import { useEffect } from "react";
import { closeExternal, isNativeApp, plugin, type AppPlugin } from "@/lib/native";
import { appCallbackToWeb } from "@/lib/auth-links";
import { isAppUserAgent } from "@/lib/app-shell";

/** Marks <html data-app> inside the iPhone app so CSS can add phone-only touches (safe areas), and opens tapped yumjack.app links. Does nothing on the website. */
export function AppFlag() {
  useEffect(() => {
    if (isNativeApp() || isAppUserAgent(navigator.userAgent)) document.documentElement.dataset.app = "";
    if (!isNativeApp()) return;
    // A tapped yumjack.app link opens the app, but the web view does not move by itself: load it here.
    // Google sign-in comes back as app.yumjack.ios://auth/callback?… from the browser sheet: close the sheet
    // and finish on the site's callback inside the web view, where sign-in started.
    const handle = plugin<AppPlugin>("App")?.addListener("appUrlOpen", ({ url }) => {
      const callback = appCallbackToWeb(url); // always https://yumjack.app, even from the offline page
      if (callback) {
        void closeExternal();
        window.location.href = callback;
        return;
      }
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
