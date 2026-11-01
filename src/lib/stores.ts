// Grocery handoff. Today each item links to the store's search; Instacart's partner
// "shoppable list" API (one cart for the whole recipe) can replace instacart.cartUrl
// once your partnership is approved. See README > Grocery partners.

export type StoreId = "instacart" | "walmart" | "kroger";

export const STORES: Record<StoreId, { name: string; searchUrl: (q: string) => string }> = {
  instacart: { name: "Instacart", searchUrl: (q) => `https://www.instacart.com/store/s?k=${encodeURIComponent(q)}` },
  walmart: { name: "Walmart", searchUrl: (q) => `https://www.walmart.com/search?q=${encodeURIComponent(q)}` },
  kroger: { name: "Kroger", searchUrl: (q) => `https://www.kroger.com/search?query=${encodeURIComponent(q)}` },
};

export const STORE_IDS = Object.keys(STORES) as StoreId[];
