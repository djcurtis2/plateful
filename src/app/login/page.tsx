import type { Metadata } from "next";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  link_expired: "That sign-in link has expired or was already used. Send a new one.",
  missing_code: "That sign-in link is incomplete. Send a new one.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-bold tracking-tight">Sign in to Plateful</h1>
        <p className="text-muted">Save your copycats, keep a pantry, and earn free months when friends cook from your link. No password needed.</p>
      </div>
      {error && ERRORS[error] && (
        <p role="alert" className="rounded-xl bg-chili/10 px-4 py-3 text-sm text-chili">
          {ERRORS[error]}
        </p>
      )}
      <LoginForm next={next && next.startsWith("/") && !next.startsWith("//") ? next : "/library"} />
    </main>
  );
}
