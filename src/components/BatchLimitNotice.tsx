import Link from "next/link";

interface BatchLimitNoticeProps {
  limit: number;
  attempted: number;
}

/**
 * Shown when a batch exceeds the current plan's cap.
 *
 * Deliberately states what was kept rather than only what was refused — the
 * files under the cap are still processed, so this is a ceiling, not a failure.
 */
export default function BatchLimitNotice({
  limit,
  attempted,
}: BatchLimitNoticeProps) {
  return (
    <p className="mt-3 rounded-[var(--radius-base)] border border-border bg-surface px-4 py-3 text-sm">
      <span className="text-muted">
        Kept the first {limit} of {attempted} files — that&apos;s the limit on the
        Free plan.{" "}
      </span>
      <Link href="/pricing" className="font-medium text-accent underline">
        Pro raises it to 100
      </Link>
      <span className="text-muted">.</span>
    </p>
  );
}
