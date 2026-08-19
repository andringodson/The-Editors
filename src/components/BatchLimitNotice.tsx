interface BatchLimitNoticeProps {
  limit: number;
  attempted: number;
}

/**
 * Shown when a batch exceeds what one tab can safely hold.
 *
 * This is a memory ceiling, not a sales tactic — pdf-lib keeps whole documents
 * in memory, and past a certain point the tab simply dies. Saying so plainly is
 * better than an unexplained cap that reads like an upsell.
 */
export default function BatchLimitNotice({
  limit,
  attempted,
}: BatchLimitNoticeProps) {
  return (
    <div className="panel mt-[var(--space-2xs)]">
      <div className="panel-meta">
        <span>
          Batch <span className="text-accent">/</span> capped
        </span>
        <span>
          {limit} of {attempted}
        </span>
      </div>
      <p className="px-[var(--space-xs)] py-[var(--space-2xs)] text-muted">
        Everything is held in memory at once, so past {limit} the browser tab
        runs out of room — run the rest as a second batch.
      </p>
    </div>
  );
}
