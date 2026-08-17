import { createClient } from "@/lib/supabase/server";
import { PLANS, planOf, type Plan, type PlanId } from "@/lib/plans";

/**
 * Server-side entitlement checks.
 *
 * Anything enforced only in the browser is a suggestion, not a limit. The
 * batch-size caps are UI affordances — a determined user can bypass them and it
 * costs us nothing, because the work happens on their machine. The Office→PDF
 * quota is different: it spends real CPU we pay for, so it is enforced here,
 * server-side, at the one chokepoint that cannot be skipped — token issuance.
 */

export interface Entitlement {
  plan: Plan;
  userId: string | null;
  signedIn: boolean;
}

export async function getEntitlement(): Promise<Entitlement> {
  const supabase = await createClient();
  if (!supabase) {
    return { plan: PLANS.free, userId: null, signedIn: false };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { plan: PLANS.free, userId: null, signedIn: false };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle();

  return {
    plan: planOf(profile?.plan),
    userId: user.id,
    signedIn: true,
  };
}

export interface QuotaVerdict {
  allowed: boolean;
  used: number;
  limit: number;
  reason?: string;
}

/**
 * How many Office conversions this user has run in the last 24 hours.
 *
 * Counted from `tool_runs`, which the client already writes. That makes the
 * quota approximate at the margin — a conversion that succeeds but whose
 * telemetry insert fails goes uncounted. Deliberate: erring toward letting a
 * paying-ish user through beats blocking someone because a background request
 * was dropped.
 */
export async function checkOfficeQuota(): Promise<QuotaVerdict> {
  const { plan, userId, signedIn } = await getEntitlement();
  const limit = plan.limits.officeConversionsPerDay;

  if (!signedIn || !userId) {
    return {
      allowed: false,
      used: 0,
      limit,
      reason: "Office→PDF needs an account — it is the one tool that runs on a server.",
    };
  }

  const supabase = await createClient();
  if (!supabase) return { allowed: true, used: 0, limit };

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from("tool_runs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("tool_id", "office-to-pdf")
    .eq("succeeded", true)
    .gte("created_at", since);

  // A failed count must not lock a paying user out of what they bought.
  if (error) return { allowed: true, used: 0, limit };

  const used = count ?? 0;

  return {
    allowed: used < limit,
    used,
    limit,
    reason:
      used < limit
        ? undefined
        : `You've used all ${limit} conversions for today on the ${plan.name} plan.`,
  };
}

export function planIdOf(entitlement: Entitlement): PlanId {
  return entitlement.plan.id;
}
