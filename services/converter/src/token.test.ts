import assert from "node:assert/strict";
import { test } from "node:test";
import { issueToken, verifyToken } from "./token.js";

const SECRET = "test-secret-value";

test("accepts a freshly issued token", () => {
  assert.equal(verifyToken(issueToken(SECRET), SECRET), true);
});

test("rejects a token signed with a different secret", () => {
  assert.equal(verifyToken(issueToken("other-secret"), SECRET), false);
});

test("rejects an expired token", () => {
  const issuedAt = Date.now() - 10 * 60 * 1000; // TTL is 5 minutes
  assert.equal(verifyToken(issueToken(SECRET, issuedAt), SECRET), false);
});

test("rejects a tampered payload", () => {
  const token = issueToken(SECRET);
  const [, signature] = token.split(".");

  const forged = Buffer.from(
    JSON.stringify({ exp: Date.now() + 60 * 60 * 1000 }),
  ).toString("base64url");

  assert.equal(verifyToken(`${forged}.${signature}`, SECRET), false);
});

test("rejects malformed input without throwing", () => {
  for (const bad of ["", ".", "abc", "a.b.c", "nodot"]) {
    assert.equal(verifyToken(bad, SECRET), false);
  }
});
