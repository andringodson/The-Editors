import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Short-lived request tokens.
 *
 * An unauthenticated conversion endpoint is a free CPU farm for anyone who
 * finds it. Requiring a login would be worse for users — most people converting
 * one slide deck will not sign up — so instead the web app mints a token that
 * expires in minutes, and the converter verifies it.
 *
 * This is deliberately not an identity check. It proves only that the request
 * originated from our front end recently, which is enough to stop drive-by
 * abuse without putting a wall in front of a legitimate first-time user.
 *
 * This file is duplicated in the Next.js app (`src/lib/convert-token.ts`)
 * because the two deploy separately and share no build. Keep them in sync.
 */

const TOKEN_TTL_MS = 5 * 60 * 1000;

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function issueToken(secret: string, now = Date.now()): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: now + TOKEN_TTL_MS }),
  ).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyToken(
  token: string,
  secret: string,
  now = Date.now(),
): boolean {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  const expected = sign(payload, secret);

  // Compare in constant time; lengths must match first or timingSafeEqual
  // throws rather than returning false.
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof exp === "number" && exp > now;
  } catch {
    return false;
  }
}
