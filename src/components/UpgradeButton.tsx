"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface UpgradeButtonProps {
  signedIn: boolean;
  available: boolean;
}

export default function UpgradeButton({ signedIn, available }: UpgradeButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!available) {
    return (
      <p className="text-center text-sm text-muted">
        Checkout isn&apos;t connected to this deployment yet.
      </p>
    );
  }

  if (!signedIn) {
    return (
      <button
        type="button"
        onClick={() => router.push("/login?next=/pricing")}
        className="w-full rounded-[var(--radius-base)] bg-accent px-5 py-2.5 font-medium text-accent-foreground transition-opacity hover:opacity-90"
      >
        Sign in to upgrade
      </button>
    );
  }

  async function upgrade() {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/checkout", { method: "POST" });
      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Could not start checkout");
      }

      // Full navigation, not router.push — Checkout is on Stripe's origin.
      window.location.href = data.url;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start checkout");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={upgrade}
        disabled={busy}
        className="w-full rounded-[var(--radius-base)] bg-accent px-5 py-2.5 font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-45"
      >
        {busy ? "Opening checkout…" : "Upgrade to Pro"}
      </button>
      {error ? (
        <p className="mt-2 text-center text-sm text-danger">{error}</p>
      ) : null}
    </>
  );
}
