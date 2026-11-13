import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { getMe } from "@/lib/data";

export const metadata: Metadata = { title: "Sign up or sign in" };

const ERRORS: Record<string, string> = {
  link_expired: "That sign-in link has expired or was already used. Send a new one.",
  missing_code: "That sign-in link is incomplete. Send a new one.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/library";
  // Already signed in: skip the form and go where they were headed.
  if (await getMe().catch(() => null)) redirect(dest);
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-bold tracking-tight">Sign in or create your free account</h1>
        <p className="text-muted">New here? The same email link makes your account. Save your copycats, keep a pantry, and earn free months when friends cook from your link. No password needed.</p>
      </div>
      {error && ERRORS[error] && (
        <p role="alert" className="rounded-xl bg-chili/10 px-4 py-3 text-sm text-chili">
          {ERRORS[error]}
        </p>
      )}
      <LoginForm next={dest} />
    </main>
  );
}
