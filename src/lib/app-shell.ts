// Rules for the Yumjack iPhone app shell. Pure functions, no I/O.
import { BUNDLES, GEAR_BY_ID } from "./avatar.ts";
import { stripeLive, type ProfilePlanFields } from "./plan.ts";

export const APP_UA_MARKER = "YumjackApp/";

export function isAppUserAgent(ua: string | null): boolean {
  return !!ua && ua.includes(APP_UA_MARKER);
}

export type PlusSource = "stripe" | "apple" | "bonus" | null;

/** Where a cook's Plus comes from right now: Stripe first, then Apple, then bonus time. */
export function plusSource(p: ProfilePlanFields, now = new Date()): PlusSource {
  if (stripeLive(p)) return "stripe";
  if (p.apple_until && new Date(p.apple_until) > now) return "apple";
  if (p.bonus_until && new Date(p.bonus_until) > now) return "bonus";
  return null;
}

export type PlusOffers = { apple: boolean; stripe: boolean; note: string | null };

/** Stripe link-out is only allowed from the US App Store storefront. */
export function stripeLinkAllowed(storefront: string | null): boolean {
  return storefront === "USA";
}

/** Grocery store tabs (US stores) show on the website and in the US and Canada. */
export function groceryStoresShown(storefront: string | null): boolean {
  return storefront === null || storefront === "USA" || storefront === "CAN";
}

export function plusOffers(source: PlusSource, storefront: string | null): PlusOffers {
  if (source === "stripe") return { apple: false, stripe: false, note: "You have Plus (via yumjack.app)" };
  if (source === "apple") return { apple: false, stripe: false, note: "You have Plus (via Apple)" };
  return { apple: true, stripe: stripeLinkAllowed(storefront), note: null };
}

type GearTarget = { item: string } | { bundle: string };

const dashToUnderscore = (id: string) => id.replaceAll("-", "_");

export function appleProductForGear(target: GearTarget): string {
  return "item" in target ? `gear_${dashToUnderscore(target.item)}` : `bundle_${dashToUnderscore(target.bundle)}`;
}

const GEAR_PRODUCTS: Map<string, GearTarget> = new Map([
  ...Object.values(GEAR_BY_ID)
    .filter((g) => g.source.kind === "shop")
    .map((g): [string, GearTarget] => [appleProductForGear({ item: g.id }), { item: g.id }]),
  ...BUNDLES.map((b): [string, GearTarget] => [appleProductForGear({ bundle: b.id }), { bundle: b.id }]),
]);

/** Maps an Apple product id back to a shop item or bundle; unknown ids give null. */
export function gearForAppleProduct(id: string): GearTarget | null {
  const t = GEAR_PRODUCTS.get(id);
  return t ? { ...t } : null;
}

/** A bundle is sold on Apple only when the cook owns none of its items (Apple has one fixed price). */
export function appleBundleAllowed(bundleId: string, owned: string[]): boolean {
  const b = BUNDLES.find((x) => x.id === bundleId);
  return !!b && !b.items.some((i) => owned.includes(i));
}

/** apple-app-site-association: lets the app open these yumjack.app links. */
export function aasa(teamId: string, bundleId: string): object {
  const paths = ["/auth/callback*", "/r/*", "/plan*", "/trivia*", "/games*", "/pricing*", "/account*", "/chef*"];
  return {
    applinks: {
      details: [{ appIDs: [`${teamId}.${bundleId}`], components: paths.map((p) => ({ "/": p })) }],
    },
  };
}
