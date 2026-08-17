import Link from "next/link";
import UpgradeButton from "@/components/UpgradeButton";
import { getEntitlement } from "@/lib/entitlements";
import { PLANS, formatPrice } from "@/lib/plans";
import { isStripeConfigured } from "@/lib/stripe";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata = {
  title: "Pricing",
  description:
    "Every browser tool is free and unlimited. Pro adds batch work and heavy document conversion.",
};

export default async function PricingPage() {
  const entitlement = isSupabaseConfigured
    ? await getEntitlement()
    : { plan: PLANS.free, signedIn: false, userId: null };

  const onPro = entitlement.plan.id === "pro";

  return (
    <div className="mx-auto max-w-4xl px-4 py-14">
      <section className="max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">
          The tools stay free. Always.
        </h1>
        <p className="mt-4 text-lg text-muted text-pretty">
          Compressing, cropping and passport photos run on your own machine, so
          they cost us nothing to give away — and we do. Pro exists for the two
          things that genuinely have a cost: batch work, and converting Office
          documents on a server.
        </p>
      </section>

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {Object.values(PLANS).map((plan) => {
          const isCurrent = entitlement.plan.id === plan.id;

          return (
            <section
              key={plan.id}
              className={[
                "flex flex-col rounded-[var(--radius-base)] border p-6",
                plan.id === "pro"
                  ? "border-accent bg-accent-subtle"
                  : "border-border bg-surface",
              ].join(" ")}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">{plan.name}</h2>
                {isCurrent ? (
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">
                    Current
                  </span>
                ) : null}
              </div>

              <p className="mt-1 text-sm text-muted text-pretty">{plan.tagline}</p>

              <p className="mt-4">
                <span className="text-3xl font-semibold tabular-nums">
                  {formatPrice(plan.priceCents)}
                </span>
                {plan.priceCents > 0 ? (
                  <span className="text-muted"> / month</span>
                ) : null}
              </p>

              <ul className="mt-5 flex-1 space-y-2 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span aria-hidden="true" className="text-accent">
                      ✓
                    </span>
                    <span className="text-pretty">{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                {plan.id === "free" ? (
                  <Link
                    href="/tools/compress"
                    className="block rounded-[var(--radius-base)] border border-border-strong px-5 py-2.5 text-center font-medium transition-colors hover:border-accent"
                  >
                    Start using it
                  </Link>
                ) : onPro ? (
                  <p className="text-center text-sm text-muted">
                    You&apos;re on Pro — thank you.
                  </p>
                ) : (
                  <UpgradeButton
                    signedIn={entitlement.signedIn}
                    available={isStripeConfigured}
                  />
                )}
              </div>
            </section>
          );
        })}
      </div>

      <section className="mt-12 max-w-2xl">
        <h2 className="text-sm font-medium tracking-wide text-muted uppercase">
          Questions you might reasonably have
        </h2>

        <dl className="mt-4 space-y-5 text-sm">
          <div>
            <dt className="font-medium">Will the free tools ever be taken away?</dt>
            <dd className="mt-1 text-muted text-pretty">
              No. They run on your device — your CPU, your electricity. Charging
              for something that costs us nothing to provide would be rent, not
              a product.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Why does Office→PDF need an account?</dt>
            <dd className="mt-1 text-muted text-pretty">
              It is the only tool that runs on a server we pay for. Metering it
              requires knowing who you are; everything else does not, so
              everything else does not ask.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Do you see my files?</dt>
            <dd className="mt-1 text-muted text-pretty">
              Only for Office→PDF, and only for the seconds it takes to convert
              — the file is deleted as soon as the PDF is returned. No other
              tool sends anything anywhere.
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
