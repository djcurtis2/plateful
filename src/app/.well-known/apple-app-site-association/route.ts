import { aasa } from "@/lib/app-shell";

// Read the env at request time so the file always matches the current Vercel settings.
export const dynamic = "force-dynamic";

/** Tells iPhones that yumjack.app links may open in the Yumjack app. */
export function GET() {
  const teamId = process.env.APPLE_TEAM_ID;
  const bundleId = process.env.APPLE_BUNDLE_ID;
  if (!teamId || !bundleId) return new Response("Not found", { status: 404 });
  return Response.json(aasa(teamId, bundleId), { headers: { "Content-Type": "application/json" } });
}
