"use client";
// Bridge to phone features inside the Yumjack iPhone app (a Capacitor shell that loads this site).
// Plugin packages live only in the mobile project; here we reach them through window.Capacitor.
// Every function is safe on the plain website: it does nothing or tells the caller to fall back.
import { useSyncExternalStore } from "react";

type CapacitorWindow = Window & {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    Plugins?: Record<string, unknown>;
  };
};

const cap = () => (typeof window === "undefined" ? undefined : (window as CapacitorWindow).Capacitor);

export function isNativeApp(): boolean {
  return cap()?.isNativePlatform?.() === true;
}

/** React-safe version: false on the server and the first render, then true inside the app. */
export function useIsApp(): boolean {
  return useSyncExternalStore(
    () => () => {},
    isNativeApp,
    () => false,
  );
}

export function plugin<T>(name: string): T | null {
  if (!isNativeApp()) return null;
  return (cap()?.Plugins?.[name] as T | undefined) ?? null;
}

type CameraPlugin = {
  getPhoto(o: { resultType: "uri"; source: "PROMPT"; quality: number; correctOrientation: boolean }): Promise<{ webPath?: string }>;
};
type SharePlugin = { share(o: { text?: string; url?: string; files?: string[] }): Promise<unknown> };
type FilesystemPlugin = { writeFile(o: { path: string; data: string; directory: "CACHE" }): Promise<{ uri: string }> };
type BrowserPlugin = { open(o: { url: string }): Promise<void> };
type PurchasesPlugin = { getStorefront(): Promise<{ countryCode?: string } | null> };

const isCancel = (e: unknown) => /cancel|abort|dismiss/i.test(`${(e as Error)?.name ?? ""} ${(e as Error)?.message ?? ""}`);

/** Opens the iPhone camera / photo picker. Null when cancelled, on the website, or if it fails. */
export async function nativePhoto(): Promise<File | null> {
  const camera = plugin<CameraPlugin>("Camera");
  if (!camera) return null;
  try {
    const photo = await camera.getPhoto({ resultType: "uri", source: "PROMPT", quality: 90, correctOrientation: true });
    if (!photo.webPath) return null;
    const blob = await fetch(photo.webPath).then((r) => r.blob());
    return new File([blob], "photo.jpg", { type: blob.type || "image/jpeg" });
  } catch {
    return null;
  }
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(blob);
  });
}

/** The iPhone share sheet. "fallback" means the caller should do what the website does today. */
export async function nativeShare(opts: { text: string; url?: string; file?: Blob; fileName?: string }): Promise<"shared" | "fallback"> {
  const share = plugin<SharePlugin>("Share");
  if (!share) return "fallback";
  try {
    let files: string[] | undefined;
    if (opts.file) {
      const fs = plugin<FilesystemPlugin>("Filesystem");
      if (!fs) return "fallback";
      const written = await fs.writeFile({ path: opts.fileName ?? "yumjack.png", data: await toBase64(opts.file), directory: "CACHE" });
      files = [written.uri];
    }
    await share.share({ text: opts.text, url: opts.url, files });
    return "shared";
  } catch (e) {
    return isCancel(e) ? "shared" : "fallback";
  }
}

let storefront: Promise<string | null> | undefined;

/** The App Store country (e.g. "USA"), or null on the website or when not available. Cached per page load. */
export function appStorefront(): Promise<string | null> {
  storefront ??= (async () => {
    const purchases = plugin<PurchasesPlugin>("Purchases");
    if (!purchases) return null;
    try {
      return (await purchases.getStorefront())?.countryCode ?? null;
    } catch {
      return null;
    }
  })();
  return storefront;
}

/** Opens a link in the in-app browser, or just navigates on the website. */
export async function openExternal(url: string): Promise<void> {
  const browser = plugin<BrowserPlugin>("Browser");
  if (browser) {
    try {
      await browser.open({ url });
      return;
    } catch {
      // fall through to a normal navigation
    }
  }
  window.location.href = url;
}

/** Puts a File into a file input and tells React about it, as if the cook had picked it. */
export function setInputFile(input: HTMLInputElement, file: File) {
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}
