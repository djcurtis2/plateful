"use client";
import { useEffect } from "react";
import { isNativeApp } from "@/lib/native";
import { isAppUserAgent } from "@/lib/app-shell";

/** Marks <html data-app> inside the iPhone app so CSS can add phone-only touches (safe areas). Does nothing on the website. */
export function AppFlag() {
  useEffect(() => {
    if (isNativeApp() || isAppUserAgent(navigator.userAgent)) document.documentElement.dataset.app = "";
  }, []);
  return null;
}
