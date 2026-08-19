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
    <p className="mt-3 panel bg-panel px-4 py-3 text-sm text-muted">
      Kept the first {limit} of {attempted} files. Everything is held in memory
      at once, so past {limit} the browser tab runs out of room — run the rest as
      a second batch.
    </p>
  );
}
