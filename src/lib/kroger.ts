// Pure helpers for "Send to Kroger cart". Network calls live in kroger-server.ts.

/** Most items sent to a Kroger cart in one go. */
export const KROGER_MAX_ITEMS = 40;

/** Cookie that holds the list (and where to come back to) while the shopper signs in at Kroger. */
export const KROGER_COOKIE = "yj_kroger";

export type KrogerTrip = { state: string; back: string; items: string[] };

/**
 * Turns an ingredient name into a Kroger product search: drops notes in brackets and after commas
 * ("butter, softened" → "butter"), keeps letters, numbers and spaces, and at most 8 words (Kroger's limit).
 * Returns null when fewer than 3 letters are left (Kroger needs 3).
 */
export function krogerTerm(name: string): string | null {
  const words = name
    .replace(/\([^)]*\)/g, " ")
    .split(/[,;]/)[0]
    .replace(/[^\p{L}\p{N}' -]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8);
  const term = words.join(" ").trim();
  return term.replace(/[^\p{L}]/gu, "").length >= 3 ? term : null;
}

/** Cleans the list a browser sent: strings only, trimmed, no repeats (ignoring case), at most KROGER_MAX_ITEMS. */
export function cleanCartItems(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const s = v.trim().slice(0, 80);
    const k = s.toLowerCase();
    if (!s || seen.has(k)) continue;
    seen.add(k);
    out.push(s);
    if (out.length >= KROGER_MAX_ITEMS) break;
  }
  return out;
}

/** Only paths on this site, so the round trip can't be used to send people elsewhere. */
export function safeBack(raw: unknown): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "/";
  return raw.slice(0, 300);
}

/** Adds the result to the page we return to, e.g. /r/tacos?kroger=5-6 (5 of 6 added) or ?kroger=error. */
export function withResult(back: string, result: string): string {
  const [path, hash = ""] = back.split("#");
  const url = new URL(path, "https://x.invalid");
  url.searchParams.set("kroger", result);
  return url.pathname + url.search + (hash ? `#${hash}` : "");
}

/** Reads `kroger` from the page address: added/of counts, an error, or a cancel. */
export function parseResult(v: string | null): { added: number; of: number } | "error" | "cancel" | "off" | null {
  if (!v) return null;
  if (v === "error" || v === "cancel" || v === "off") return v;
  const m = /^(\d+)-(\d+)$/.exec(v);
  return m ? { added: Number(m[1]), of: Number(m[2]) } : null;
}
