import { NextResponse, type NextRequest } from "next/server";
import { dishOfDay } from "@/lib/games-server";
import { triviaDay } from "@/lib/trivia";

/**
 * Guess the Dish photo, served through here so its file name (which contains the dish) never reaches the browser.
 * Only today's or past days' photos.
 */
export async function GET(req: NextRequest) {
  const day = req.nextUrl.searchParams.get("day") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day > triviaDay()) return new NextResponse("Not found", { status: 404 });
  const today = await dishOfDay(day);
  const src = today?.recipe.image_url;
  if (!src) return new NextResponse("Not found", { status: 404 });
  const upstream = await fetch(src);
  if (!upstream.ok || !upstream.body) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(upstream.body, {
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "image/jpeg",
      "cache-control": "public, max-age=3600",
      "content-disposition": "inline; filename=dish.jpg",
    },
  });
}
