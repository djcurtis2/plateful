// Central place to read configuration. Server-only values throw a clear error when missing.

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`);
  return v;
}

export function intEnv(name: string, fallback: number): number {
  const n = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Where people reach a human (shown on Terms, Privacy and Rules). Set NEXT_PUBLIC_CONTACT_EMAIL in Vercel; hidden until then. */
export const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || null;
