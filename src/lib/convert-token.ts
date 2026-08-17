import { createHmac } from "node:crypto";

/**
 * Mints short-lived tokens for the conversion service.
 *
 * Server-only: importing this from a client component would leak the secret
 * into the bundle. The verifying half lives in
 * `services/converter/src/token.ts` — the two deploy separately and share no
 * build, so changes must be mirrored by hand.
 */

const TOKEN_TTL_MS = 5 * 60 * 1000;

export function issueConvertToken(secret: string, now = Date.now()): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: now + TOKEN_TTL_MS }),
  ).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}
