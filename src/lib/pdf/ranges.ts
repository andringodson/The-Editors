/**
 * Page range parsing — "1-3, 7, 9-12".
 *
 * Kept separate from the PDF operations because it is pure: no document, no
 * async, nothing to mock. Everything about which pages a person meant is
 * decided here, so the operation itself only ever receives a plain list.
 */

export interface ParsedRange {
  /** 1-based page numbers, in the order the input asked for them. */
  pages: number[];
  /** Set when the input cannot be honoured, phrased for a person to read. */
  error?: string;
}

/**
 * Parse a page specification against a document of `total` pages.
 *
 * Order is preserved and duplicates are dropped, so "5, 1" really does mean
 * page five followed by page one. That falls out of the parsing rather than
 * being a feature built on purpose, but it is worth keeping: reordering a short
 * document is otherwise a merge with extra steps.
 */
export function parsePageRanges(input: string, total: number): ParsedRange {
  const trimmed = input.trim();
  if (trimmed === "") return { pages: [], error: "Name at least one page." };
  if (total < 1) return { pages: [], error: "That document has no pages." };

  const pages: number[] = [];
  const seen = new Set<number>();

  for (const raw of trimmed.split(",")) {
    const token = raw.trim();
    if (token === "") continue;

    // An en dash is what a phone keyboard and a word processor both produce,
    // and refusing it would be pedantry rather than validation.
    const match = /^(\d+)\s*(?:[-–—]\s*(\d+))?$/.exec(token);
    if (!match) {
      return { pages: [], error: `"${token}" is not a page or a range.` };
    }

    const from = Number(match[1]);
    const to = match[2] === undefined ? from : Number(match[2]);

    if (from < 1 || to < 1) {
      return { pages: [], error: "Pages are numbered from 1." };
    }
    if (from > total || to > total) {
      return {
        pages: [],
        error: `This document has ${total} page${total === 1 ? "" : "s"}, so ${Math.max(from, to)} does not exist.`,
      };
    }

    // A descending range is read as a descending range rather than rejected:
    // "9-7" plainly means those three pages, backwards.
    const step = to >= from ? 1 : -1;
    for (let page = from; step > 0 ? page <= to : page >= to; page += step) {
      if (seen.has(page)) continue;
      seen.add(page);
      pages.push(page);
    }
  }

  if (pages.length === 0)
    return { pages: [], error: "Name at least one page." };
  return { pages };
}

/** Everything except the named pages, in document order. */
export function invertPages(pages: number[], total: number): number[] {
  const drop = new Set(pages);
  const kept: number[] = [];
  for (let page = 1; page <= total; page++) {
    if (!drop.has(page)) kept.push(page);
  }
  return kept;
}

/** "1-3, 7" — the shortest way to write a list back to a person. */
export function describePages(pages: number[]): string {
  if (pages.length === 0) return "none";

  const parts: string[] = [];
  let start = pages[0];
  let previous = pages[0];

  for (const page of pages.slice(1)) {
    if (page === previous + 1) {
      previous = page;
      continue;
    }
    parts.push(start === previous ? `${start}` : `${start}-${previous}`);
    start = previous = page;
  }
  parts.push(start === previous ? `${start}` : `${start}-${previous}`);

  return parts.join(", ");
}
