// A small pill naming a chef club; links to the club's page. Unknown ids render nothing.
import Link from "next/link";
import { CLUB_BY_ID } from "@/lib/clubs";

export function ClubBadge({ id }: { id: string }) {
  const club = CLUB_BY_ID[id];
  if (!club) return null;
  return (
    <Link
      href={`/clubs/${id}`}
      className="inline-block max-w-full truncate rounded-full bg-sunk px-2 py-0.5 text-[11px] font-semibold text-basil hover:underline"
    >
      {club.name}
    </Link>
  );
}
