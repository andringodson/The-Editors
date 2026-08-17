/**
 * Usage ceilings.
 *
 * There are no paid tiers — the site is funded by advertising, so every tool is
 * available to everyone. What remains are two limits with real causes behind
 * them, neither of which is a sales tactic:
 *
 *   BATCH_FILE_LIMIT       a memory ceiling. pdf-lib holds whole documents in
 *                          memory, so a large enough batch crashes the tab.
 *
 *   OFFICE_CONVERSIONS     a cost ceiling. Office→PDF is the one tool running
 *                          on hardware we pay for, and ad revenue per visitor
 *                          does not cover unbounded LibreOffice time.
 */

/** Files accepted in one batch operation (PDF merge, images→PDF). */
export const BATCH_FILE_LIMIT = 100;

/** Office→PDF conversions per account per rolling 24 hours. */
export const OFFICE_CONVERSIONS_PER_DAY = 10;

/**
 * Office→PDF requires an account. It is the only tool that spends our money,
 * and there is no reliable way to meter an anonymous visitor — an unmetered
 * paid resource is an invitation. Every other tool stays anonymous, because
 * every other tool runs on the visitor's own machine.
 */
export const OFFICE_REQUIRES_ACCOUNT = true;
