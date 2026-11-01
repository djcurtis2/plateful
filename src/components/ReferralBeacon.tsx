"use client";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/** Counts a referral-link visit once per page load. Rewards depend on cooks, never visits. */
export function ReferralBeacon({ recipeId }: { recipeId: string }) {
  const params = useSearchParams();
  const ref = params.get("ref");
  useEffect(() => {
    if (!ref) return;
    const key = `pf_ref_seen_${ref}_${recipeId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {}
    fetch("/api/ref/visit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: ref, recipeId }),
      keepalive: true,
    }).catch(() => {});
  }, [ref, recipeId]);
  return null;
}
