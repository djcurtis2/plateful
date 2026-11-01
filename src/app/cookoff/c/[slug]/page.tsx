import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getChallengeBySlug } from "@/lib/data";
import { CookoffView } from "@/components/CookoffView";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const c = await getChallengeBySlug((await params).slug);
  return { title: c ? `${c.title} cook-off` : "Cook-off" };
}

export default async function PastCookoffPage({ params }: Params) {
  const challenge = await getChallengeBySlug((await params).slug);
  if (!challenge) notFound();
  return <CookoffView challenge={challenge} isCurrent={false} />;
}
