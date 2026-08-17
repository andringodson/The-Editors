import { createClient } from "@/lib/supabase/server";
import { OFFICE_CONVERSIONS_PER_DAY } from "@/lib/quotas";

/**
 * Server-side quota enforcement for Office→PDF.
 *
 * This is the only limit in the product with teeth, because it is the only one
 * protecting something that costs money. Everything else runs on the visitor's
 * own hardware, so a client-side cap there would be theatre.
 */

export interface QuotaVerdict {
  allowed: boolean;
  used: number;
  limit: number;
  reason?: string;
}

/**
 * How many Office conversions this account has run in the last 24 hours.
 *
 * Counted from `tool_runs`, which the client already writes. That makes it
 * approximate at the margin — a conversion whose telemetry insert fails goes
 * uncounted. Deliberate: letting the occasional extra through beats blocking
 * someone because a background request was dropped.
 */
export async function checkOfficeQuota(): Promise<QuotaVerdict> {
  const limit = OFFICE_CONVERSIONS_PER_DAY;

  const supabase = await createClient();
  if (!supabase) {
    // No Supabase means no accounts and no way to meter. Office→PDF is
    // unavailable rather than unlimited.
    return {
      allowed: false,
      used: 0,
      limit,
      reason: "Accounts are unavailable, so Office→PDF cannot be metered.",
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      allowed: false,
      used: 0,
      limit,
      reason:
        "Office→PDF needs an account — it is the one tool that runs on a server.",
    };
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from("tool_runs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("tool_id", "office-to-pdf")
    .eq("succeeded", true)
    .gte("created_at", since);

  // A failed count must not lock someone out of a working tool.
  if (error) return { allowed: true, used: 0, limit };

  const used = count ?? 0;

  return {
    allowed: used < limit,
    used,
    limit,
    reason:
      used < limit
        ? undefined
        : `You've used all ${limit} conversions for today. The counter resets 24 hours after each one.`,
  };
}
