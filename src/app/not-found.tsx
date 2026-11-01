import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
      <h1 className="font-display text-4xl font-bold tracking-tight">That plate&apos;s empty</h1>
      <p className="text-muted">We couldn&apos;t find that page or recipe.</p>
      <Link href="/" className="btn btn-primary">
        Snap a dish
      </Link>
    </main>
  );
}
