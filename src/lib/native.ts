"use client";
// Bridge to phone features inside the Yumjack iPhone app (a Capacitor shell that loads this site).
// Plugin packages live only in the mobile project; here we reach them through window.Capacitor.
// Every function is safe on the plain website: it does nothing or tells the caller to fall back.
import { useSyncExternalStore } from "react";
import { safeNext } from "@/lib/auth-links";
import { OFFLINE_KEY, upsertOfflineList, type OfflineList } from "@/lib/offline-lists";

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

export type AppPlugin = {
  addListener(event: "appUrlOpen", cb: (e: { url: string }) => void): Promise<{ remove(): void }>;
};
type CameraPlugin = {
  getPhoto(o: { resultType: "uri"; source: "PROMPT"; quality: number; correctOrientation: boolean }): Promise<{ webPath?: string }>;
};
type SharePlugin = { share(o: { text?: string; url?: string; files?: string[] }): Promise<unknown> };
type FilesystemPlugin = { writeFile(o: { path: string; data: string; directory: "CACHE" }): Promise<{ uri: string }> };
type BrowserPlugin = {
  open(o: { url: string }): Promise<void>;
  close(): Promise<void>;
  addListener(event: "browserFinished", cb: () => void): Promise<{ remove(): void }>;
};

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

/** The App Store country (e.g. "USA"), or null on the website or when not available. Cached once known. */
export function appStorefront(): Promise<string | null> {
  storefront ??= (async () => {
    const purchases = await rcReady();
    if (!purchases) return null;
    try {
      return (await purchases.getStorefront())?.countryCode ?? null;
    } catch {
      return null;
    }
  })();
  const p = storefront;
  // Don't remember a miss (say the phone was offline): ask again next time.
  void p.then((v) => {
    if (v === null && storefront === p) storefront = undefined;
  });
  return p;
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

/**
 * Opens a page in the in-app browser sheet and calls `onClose` once the cook closes it (to reload what changed).
 * On the website it just navigates there.
 */
export async function openExternalThen(url: string, onClose: () => void): Promise<void> {
  const browser = plugin<BrowserPlugin>("Browser");
  if (browser) {
    try {
      const handle = await browser.addListener("browserFinished", () => {
        void handle.remove();
        onClose();
      });
    } catch {
      // no close event; the page still opens
    }
  }
  await openExternal(url);
}

/** Closes the in-app browser sheet if one is open. Does nothing on the website. */
export async function closeExternal(): Promise<void> {
  try {
    await plugin<BrowserPlugin>("Browser")?.close();
  } catch {
    // nothing open
  }
}

type PreferencesPlugin = {
  get(o: { key: string }): Promise<{ value: string | null }>;
  set(o: { key: string; value: string }): Promise<void>;
};

async function readAllOfflineLists(prefs: PreferencesPlugin): Promise<OfflineList[]> {
  const { value } = await prefs.get({ key: OFFLINE_KEY });
  const parsed = value ? JSON.parse(value) : [];
  return Array.isArray(parsed) ? (parsed as OfflineList[]) : [];
}

/** Keeps a grocery list on the phone (native storage, shared with the offline page). Never throws. */
export async function saveOfflineList(list: OfflineList): Promise<void> {
  const prefs = plugin<PreferencesPlugin>("Preferences");
  if (!prefs) return;
  try {
    const all = await readAllOfflineLists(prefs).catch(() => []);
    await prefs.set({ key: OFFLINE_KEY, value: JSON.stringify(upsertOfflineList(all, list)) });
  } catch {
    // saving for offline is a bonus; never break the page
  }
}

/** The list as last saved on the phone (including ticks made offline), or null. */
export async function readOfflineList(id: string): Promise<OfflineList | null> {
  const prefs = plugin<PreferencesPlugin>("Preferences");
  if (!prefs) return null;
  try {
    return (await readAllOfflineLists(prefs)).find((l) => l.id === id) ?? null;
  } catch {
    return null;
  }
}

/** Ticks made on the phone for a saved list, or null when there is none. */
export async function readOfflineTicks(id: string): Promise<string[] | null> {
  return (await readOfflineList(id))?.ticks ?? null;
}

/** Puts a File into a file input and tells React about it, as if the cook had picked it. */
export function setInputFile(input: HTMLInputElement, file: File) {
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

type PushPlugin = {
  requestPermissions(): Promise<{ receive: string }>;
  register(): Promise<void>;
  addListener(event: "registration", cb: (e: { value: string }) => void): Promise<{ remove(): void }>;
  addListener(event: "registrationError", cb: (e: unknown) => void): Promise<{ remove(): void }>;
  addListener(event: "pushNotificationActionPerformed", cb: (e: { notification?: { data?: { url?: unknown } } }) => void): Promise<{ remove(): void }>;
};

/**
 * Asks iPhone for permission to send notifications, gets this phone's push token and gives it to the site.
 * "ok" when the phone is registered, "denied" when iPhone permission is off, "failed" for anything else (including not being the app).
 */
export async function enablePush(): Promise<"ok" | "denied" | "failed"> {
  const push = plugin<PushPlugin>("PushNotifications");
  if (!push) return "failed";
  try {
    const perm = await push.requestPermissions();
    if (perm.receive !== "granted") return "denied";
    const handles: Promise<{ remove(): void }>[] = [];
    let token: string | null;
    try {
      token = await new Promise<string | null>((resolve) => {
        const timer = setTimeout(() => resolve(null), 10_000);
        const done = (v: string | null) => {
          clearTimeout(timer);
          resolve(v);
        };
        handles.push(push.addListener("registration", (e) => done(e.value)));
        handles.push(push.addListener("registrationError", () => done(null)));
        void push.register().catch(() => done(null));
      });
    } finally {
      for (const h of handles) void h.then((x) => x.remove()).catch(() => undefined);
    }
    if (!token) return "failed";
    const res = await fetch("/api/push/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, storefront: await appStorefront() }),
    });
    if (res.ok) {
      try {
        localStorage.setItem(PUSH_TOKEN_KEY, token); // sent with sign-out, so this phone stops getting this account's notifications
      } catch {
        // storage blocked: sign-out just can't unhook the phone
      }
    }
    return res.ok ? "ok" : "failed";
  } catch {
    return "failed";
  }
}

const PUSH_TOKEN_KEY = "yj_push_token";
let signOutHooked = false;

/**
 * In the app, every sign-out form (posting to /auth/signout) also sends this phone's push token, so the server can
 * remove this phone from the account being signed out. Add once per app start. Does nothing on the website.
 */
export function addPushTokenToSignOut(): void {
  if (signOutHooked || !isNativeApp()) return;
  signOutHooked = true;
  document.addEventListener(
    "submit",
    (e) => {
      const form = e.target;
      if (!(form instanceof HTMLFormElement) || new URL(form.action, location.href).pathname !== "/auth/signout") return;
      let token: string | null = null;
      try {
        token = localStorage.getItem(PUSH_TOKEN_KEY);
      } catch {
        return;
      }
      if (!token || form.querySelector('input[name="push_token"]')) return;
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "push_token";
      input.value = token;
      form.appendChild(input);
    },
    true,
  );
}

let tapListening = false;

/** A tapped notification opens the page it names (a path on yumjack.app only). Add once per app start. */
export function listenForPushTaps(): void {
  if (tapListening) return;
  const push = plugin<PushPlugin>("PushNotifications");
  if (!push) return;
  tapListening = true;
  void push.addListener("pushNotificationActionPerformed", (e) => {
    const url = e.notification?.data?.url;
    window.location.href = `https://yumjack.app${safeNext(typeof url === "string" ? url : null, "/")}`;
  });
}

// ---- Apple in-app purchases (RevenueCat's Capacitor plugin, 11.x API) ----

/** Apple's own page for managing (and cancelling) App Store subscriptions. */
export const APPLE_SUBSCRIPTIONS = "https://apps.apple.com/account/subscriptions";

/** A RevenueCat package or store product as the plugin hands it over; passed back to it unchanged. */
export type RcPackage = { identifier: string; product: { identifier: string; priceString: string } };
export type RcProduct = { identifier: string; priceString: string };
type PurchasesPlugin = {
  configure(o: { apiKey: string }): Promise<void>;
  getAppUserID(): Promise<{ appUserID: string }>;
  logIn(o: { appUserID: string }): Promise<unknown>;
  logOut(): Promise<unknown>;
  getStorefront(): Promise<{ countryCode?: string } | null>;
  getOfferings(): Promise<{ current: { availablePackages: RcPackage[] } | null }>;
  getProducts(o: { productIdentifiers: string[]; type?: "NON_SUBSCRIPTION" | "SUBSCRIPTION" }): Promise<{ products: RcProduct[] }>;
  purchasePackage(o: { aPackage: RcPackage }): Promise<unknown>;
  purchaseStoreProduct(o: { product: RcProduct }): Promise<unknown>;
  restorePurchases(): Promise<unknown>;
};

let rc: Promise<PurchasesPlugin | null> | undefined;

/** Sets up RevenueCat once per app start (anonymous until rcLogIn). Null on the website or when the key isn't set. */
function rcReady(): Promise<PurchasesPlugin | null> {
  rc ??= (async () => {
    const purchases = plugin<PurchasesPlugin>("Purchases");
    const apiKey = process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY;
    if (!purchases || !apiKey) return null;
    try {
      await purchases.configure({ apiKey });
      return purchases;
    } catch {
      return null;
    }
  })();
  return rc;
}

/** Called once when the app starts (AppFlag). Does nothing on the website. */
export async function rcConfigure(): Promise<void> {
  await rcReady();
}

const ANON = "$RCAnonymousID:";

/** Ties Apple purchases on this phone to the signed-in Yumjack account (RevenueCat app user id = Supabase user id). */
export async function rcLogIn(userId: string): Promise<boolean> {
  const purchases = await rcReady();
  if (!purchases) return false;
  try {
    const { appUserID } = await purchases.getAppUserID();
    if (appUserID !== userId) await purchases.logIn({ appUserID: userId });
    return true;
  } catch {
    return false;
  }
}

/** After sign-out: back to an anonymous RevenueCat user, so the next account doesn't inherit purchases. */
export async function rcLogOut(): Promise<void> {
  const purchases = await rcReady();
  if (!purchases) return;
  try {
    const { appUserID } = await purchases.getAppUserID();
    if (!appUserID.startsWith(ANON)) await purchases.logOut();
  } catch {
    // already anonymous
  }
}

/** The Plus monthly and yearly packages with Apple's prices in the cook's own currency. Null when Apple can't be reached. */
export async function rcPlusPackages(): Promise<{ monthly: RcPackage | null; yearly: RcPackage | null } | null> {
  const purchases = await rcReady();
  if (!purchases) return null;
  try {
    const packages = (await purchases.getOfferings()).current?.availablePackages ?? [];
    const find = (id: string) => packages.find((p) => p.product.identifier === id) ?? null;
    const out = { monthly: find("yumjack_plus_monthly"), yearly: find("yumjack_plus_yearly") };
    return out.monthly || out.yearly ? out : null;
  } catch {
    return null;
  }
}

/** Apple's gear products (prices in the cook's currency), by product id. Empty when Apple can't be reached. */
export async function rcGearProducts(ids: string[]): Promise<Record<string, RcProduct>> {
  const purchases = await rcReady();
  if (!purchases || !ids.length) return {};
  try {
    const { products } = await purchases.getProducts({ productIdentifiers: ids, type: "NON_SUBSCRIPTION" });
    return Object.fromEntries(products.map((p) => [p.identifier, p]));
  } catch {
    return {};
  }
}

export type RcResult = { ok: true } | { ok: false; cancelled: true } | { ok: false; cancelled: false; message: string };

/** RevenueCat error codes (PURCHASES_ERROR_CODE) in plain English. A cancelled purchase says nothing. */
function rcFailure(e: unknown, fallback: string): RcResult {
  const err = e as { code?: unknown; userCancelled?: unknown; data?: { userCancelled?: unknown; code?: unknown } } | null;
  const code = String(err?.code ?? err?.data?.code ?? "");
  const fail = (message: string): RcResult => ({ ok: false, cancelled: false, message });
  if (code === "1" || err?.userCancelled === true || err?.data?.userCancelled === true) return { ok: false, cancelled: true };
  if (code === "2" || code === "10" || code === "35") return fail("Couldn't reach the App Store. Check your connection and try again.");
  if (code === "3") return fail("Purchases are turned off on this iPhone (check Screen Time settings).");
  if (code === "6") return fail("You already bought this. Tap Restore purchases.");
  if (code === "20") return fail("Your purchase is waiting for approval. It will show up once it's approved.");
  return fail(fallback);
}

/** Runs an Apple purchase step as the signed-in cook. Never while RevenueCat is anonymous, so nothing lands on a nameless id. */
async function rcAsCook(userId: string, step: (p: PurchasesPlugin) => Promise<unknown>, fallback: string): Promise<RcResult> {
  const purchases = await rcReady();
  if (!purchases) return { ok: false, cancelled: false, message: "Apple purchases aren't available right now." };
  if (!(await rcLogIn(userId))) return { ok: false, cancelled: false, message: "Couldn't connect to the App Store. Try again." };
  try {
    await step(purchases);
    return { ok: true };
  } catch (e) {
    return rcFailure(e, fallback);
  }
}

const BUY_FAILED = "The purchase didn't go through, and you weren't charged. Try again.";

export function rcBuyPackage(userId: string, pkg: RcPackage): Promise<RcResult> {
  return rcAsCook(userId, (p) => p.purchasePackage({ aPackage: pkg }), BUY_FAILED);
}

export function rcBuyProduct(userId: string, product: RcProduct): Promise<RcResult> {
  return rcAsCook(userId, (p) => p.purchaseStoreProduct({ product }), BUY_FAILED);
}

/** Restore purchases: brings this Apple ID's purchases to the signed-in account. */
export function rcRestore(userId: string): Promise<RcResult> {
  return rcAsCook(userId, (p) => p.restorePurchases(), "Couldn't restore purchases. Try again.");
}

/**
 * "Pay on yumjack.app" in the app: the browser sheet isn't signed in, so the Stripe Checkout page is made here
 * (signed in, via the route's ?mode=json) and only its address is opened. Returns an error to show, or null.
 */
export async function openStripeCheckout(route: "/api/stripe/checkout" | "/api/stripe/gear", fields: Record<string, string>, onClose: () => void): Promise<string | null> {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.set(k, v);
  try {
    const res = await fetch(`${route}?mode=json`, { method: "POST", body });
    const data = (await res.json().catch(() => null)) as { url?: unknown; error?: unknown } | null;
    if (typeof data?.url === "string" && data.url.startsWith("https://checkout.stripe.com/")) {
      await openExternalThen(data.url, onClose);
      return null;
    }
    return typeof data?.error === "string" ? data.error : "Couldn't open checkout. Try again.";
  } catch {
    return "Couldn't open checkout. Check your connection and try again.";
  }
}

/** Asks the site to re-check this cook's Apple purchases with RevenueCat (backup for a late webhook). */
export async function rcSyncSite(): Promise<void> {
  await fetch("/api/revenuecat/refresh", { method: "POST" }).catch(() => undefined);
}
