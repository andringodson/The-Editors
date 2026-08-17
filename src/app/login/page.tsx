"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) {
      setError("Sign-in is not configured yet.");
      return;
    }

    setBusy(true);
    setError(null);

    // Magic link rather than passwords: nothing to store, nothing to leak, and
    // no reset flow to build.
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (authError) setError(authError.message);
    else setSent(true);
    setBusy(false);
  }

  if (!supabase) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">Sign-in unavailable</h1>
        <p className="mt-2 text-muted">
          Supabase is not configured for this deployment. Every tool still works
          without an account.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-2 text-muted text-pretty">
        An account keeps your presets and history. The tools themselves work
        without one.
      </p>

      {sent ? (
        <p className="mt-6 bevel-out bg-surface px-4 py-3 text-sm font-bold text-success">
          Check your inbox for a sign-in link.
        </p>
      ) : (
        <form onSubmit={signIn} className="mt-6 space-y-3">
          <label htmlFor="email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            disabled={busy}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full bevel-field px-3 py-2"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full btn-95 bevel-out font-bold"
          >
            {busy ? "Sending…" : "Email me a link"}
          </button>
        </form>
      )}

      {error ? (
        <p className="mt-4 text-sm text-danger">{error}</p>
      ) : null}
    </div>
  );
}
