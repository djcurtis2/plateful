import "server-only";
import { siteUrl } from "@/lib/env";
import { krogerTerm } from "@/lib/kroger";

// Kroger Public API (developer.kroger.com). The app's own token searches products; the shopper's
// token (from Kroger sign-in, scope cart.basic:write) adds to their cart. Nothing is stored.

const API = "https://api.kroger.com/v1";

export const krogerRedirectUri = `${siteUrl}/api/kroger/callback`;

export function krogerConfigured(): boolean {
  return !!(process.env.KROGER_CLIENT_ID && process.env.KROGER_CLIENT_SECRET);
}

function basicAuth(): string {
  return "Basic " + Buffer.from(`${process.env.KROGER_CLIENT_ID}:${process.env.KROGER_CLIENT_SECRET}`).toString("base64");
}

/** The Kroger sign-in page. The shopper picks their store and approves cart access there. */
export function krogerAuthorizeUrl(state: string): string {
  const u = new URL(`${API}/connect/oauth2/authorize`);
  u.searchParams.set("scope", "cart.basic:write");
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", process.env.KROGER_CLIENT_ID ?? "");
  u.searchParams.set("redirect_uri", krogerRedirectUri);
  u.searchParams.set("state", state);
  return u.toString();
}

async function token(body: Record<string, string>): Promise<string> {
  const res = await fetch(`${API}/connect/oauth2/token`, {
    method: "POST",
    headers: { Authorization: basicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Kroger token ${res.status}`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Kroger token missing");
  return json.access_token;
}

export const shopperToken = (code: string) =>
  token({ grant_type: "authorization_code", code, redirect_uri: krogerRedirectUri });

const appToken = () => token({ grant_type: "client_credentials", scope: "product.compact" });

/** First Kroger product for a search, or null. */
async function findUpc(term: string, auth: string): Promise<string | null> {
  const u = new URL(`${API}/products`);
  u.searchParams.set("filter.term", term);
  u.searchParams.set("filter.limit", "1");
  const res = await fetch(u, { headers: { Authorization: `Bearer ${auth}`, Accept: "application/json" }, cache: "no-store" });
  if (!res.ok) return null;
  const json = (await res.json()) as { data?: { upc?: string }[] };
  return json.data?.[0]?.upc ?? null;
}

/** Matches each item to a Kroger product and adds one of each to the shopper's cart. Returns how many went in. */
export async function sendToKrogerCart(items: string[], shopper: string): Promise<number> {
  const app = await appToken();
  const upcs: string[] = [];
  // A few searches at a time: quick, and gentle on Kroger's rate limit.
  for (let i = 0; i < items.length; i += 5) {
    const batch = await Promise.all(
      items.slice(i, i + 5).map((name) => {
        const term = krogerTerm(name);
        return term ? findUpc(term, app).catch(() => null) : null;
      }),
    );
    for (const upc of batch) if (upc && !upcs.includes(upc)) upcs.push(upc);
  }
  if (!upcs.length) return 0;
  const res = await fetch(`${API}/cart/add`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${shopper}`, "Content-Type": "application/json" },
    body: JSON.stringify({ items: upcs.map((upc) => ({ upc, quantity: 1, modality: "PICKUP" })) }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Kroger cart ${res.status}`);
  return upcs.length;
}
