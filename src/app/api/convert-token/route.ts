import { NextResponse } from "next/server";
import { issueConvertToken } from "@/lib/convert-token";

/**
 * Hands the browser a short-lived token so it can call the conversion service
 * directly.
 *
 * The file itself deliberately does not pass through here: Vercel functions cap
 * request bodies at about 4.5 MB, which a slide deck clears easily. Uploading
 * straight to the converter also avoids paying for the same bytes twice.
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

  return NextResponse.json(
    { token: issueConvertToken(secret) },
    { headers: { "cache-control": "no-store" } },
  );
}
