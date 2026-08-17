"use client";

import { useEffect, useState } from "react";
import { PLANS, planOf, type Plan } from "@/lib/plans";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * The current user's plan, for client components.
 *
 * Used only to shape the UI — showing the right cap, offering the right
 * prompt. It is not a security boundary: the batch limits it drives are
 * affordances, and bypassing them costs us nothing because the work happens on
 * the user's own machine. The one limit that spends our money (Office→PDF) is
 * enforced server-side in `entitlements.ts` instead.
 */
export function usePlan(): { plan: Plan; loading: boolean } {
  const [plan, setPlan] = useState<Plan>(PLANS.free);
  // Seeded from config rather than always starting true, so the no-Supabase
  // case never needs a synchronous setState inside the effect.
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    let cancelled = false;

    void (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        const { data } = await supabase
          .from("profiles")
          .select("plan")
          .eq("id", user.id)
          .maybeSingle();

        if (!cancelled) setPlan(planOf(data?.plan));
      } catch {
        // Fall back to Free — the safe default, and the tools still work.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { plan, loading };
}
