import { NextResponse } from "next/server";
import { issueConvertToken } from "@/lib/convert-token";
import { checkOfficeQuota } from "@/lib/entitlements";

/**
 * Hands the browser a short-lived token so it can call the conversion service
 * directly.
 *
 * The file itself deliberately does not pass through here: Vercel functions cap
 * request bodies at about 4.5 MB, which a slide deck clears easily. Uploading
 * straight to the converter also avoids paying for the same bytes twice.
 *
 * This route is also where the Office→PDF quota is enforced. It is the only
 * unavoidable chokepoint — the converter will not accept a request without a
 * token, and tokens are only minted here — so a client-side check would be
 * decoration whereas this is a real limit on real spend.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const secret = process.env.CONVERT_SIGNING_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "Conversion is not configured" },
      { status: 503 },
    );
  }

  const quota = await checkOfficeQuota();
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: quota.reason ?? "Daily conversion limit reached",
        used: quota.used,
        limit: quota.limit,
      },
      // 402 rather than 429: the fix is a plan, not a wait.
      { status: quota.used >= quota.limit ? 402 : 401 },
    );
  }

  return NextResponse.json(
    { token: issueConvertToken(secret), remaining: quota.limit - quota.used },
    { headers: { "cache-control": "no-store" } },
  );
}
