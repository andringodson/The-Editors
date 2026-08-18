import { Fragment, type CSSProperties } from "react";

/*
 * Cadence.
 *
 * A fixed interval per character does not read as typing — it reads as a
 * progress bar made of letters. Real typing has a rhythm: an uneven stroke
 * rate, a beat at the end of every word, a longer one at punctuation. These
 * numbers reproduce that, and they are the only place to tune the effect.
 */

/** Baseline gap between two keystrokes. */
const BASE_STEP_MS = 15;

/** How far a single keystroke may run fast or slow, as a fraction of the base. */
const STROKE_JITTER = 0.55;

/** The beat between words — the gap the caret rests in mid-sentence. */
const WORD_PAUSE_MS = 55;

const CLAUSE_PAUSE_MS = 150;
const SENTENCE_PAUSE_MS = 220;

/** One blink of the caret before the first keystroke: the wait before typing. */
export const LEAD_IN_MS = 600;

/** How long a character takes to fade in once its turn arrives. */
const CHAR_FADE_MS = 300;

/**
 * Deterministic per-stroke jitter.
 *
 * `Math.random()` cannot be used: this renders on the server, and a different
 * number on a re-render would mean different markup. A hash of the stroke index
 * gives the same irregularity every time.
 */
function stroke(index: number) {
  let h = Math.imul(index + 1, 2654435761);
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

type Slot = {
  char: string;
  /** Milliseconds from page load until this character appears. */
  at: number;
  /** How long the caret sits after this character before the next arrives. */
  lit: number;
};

/**
 * Turns a sentence into a keystroke schedule.
 *
 * Spaces get no slot of their own — a caret does not stop inside a gap, it
 * lingers after the word that just finished, so the word pause is added to the
 * preceding character's caret instead.
 */
function schedule(text: string) {
  const slots: Slot[] = [];
  let at = LEAD_IN_MS;

  for (const char of text) {
    if (char === " ") {
      const previous = slots.at(-1);
      if (previous) previous.lit += WORD_PAUSE_MS;
      at += WORD_PAUSE_MS;
      continue;
    }

    let gap =
      BASE_STEP_MS * (1 + (stroke(slots.length) * 2 - 1) * STROKE_JITTER);
    if (/[,;:]/.test(char)) gap += CLAUSE_PAUSE_MS;
    else if (/[.!?]/.test(char)) gap += SENTENCE_PAUSE_MS;

    gap = Math.round(gap);
    slots.push({ char, at: Math.round(at), lit: gap });
    at += gap;
  }

  return {
    slots,
    restAt: Math.round(at),
    total: Math.round(at) + CHAR_FADE_MS,
  };
}

/**
 * How long `<TypeOn>` takes to finish, so callers can time whatever follows
 * against it instead of hard-coding a guess that drifts when the copy changes.
 */
export function typeOnDuration(text: string) {
  return schedule(text).total;
}

/**
 * Types a string on, one character at a time.
 *
 * This is a *server* component, and deliberately so — the whole effect is one
 * CSS rule plus a delay stamped on each character at render. Three things the
 * obvious client-side implementation gets wrong and this one does not:
 *
 * 1. **The sentence is in the HTML.** A component that starts empty and appends
 *    characters ships an empty `<h1>` to crawlers and to anyone whose JS never
 *    arrives. Splitting a fully-rendered string across inline spans keeps the
 *    text extractable as one line.
 * 2. **Nothing moves.** Characters reveal with opacity, so the final layout is
 *    settled from the first frame — `text-wrap: balance` does not resettle and
 *    the hero contributes no layout shift.
 * 3. **The accessible name stays one sentence.** Screen readers announce split
 *    spans erratically, so the characters are hidden from the tree and the
 *    caller labels the heading with the same constant. See `page.tsx`.
 *
 * The caret is continuous rather than a repeating flash: each character lights
 * its own for exactly the gap until the next one, so it holds through the
 * pauses instead of going dark in them. It waits, blinking, before the first
 * keystroke, and stays blinking at the end of the line.
 */
export default function TypeOn({ text }: { text: string }) {
  const { slots, restAt } = schedule(text);
  let index = 0;

  return (
    <span aria-hidden="true">
      {/* The caret waiting to start. Zero advance width, so it sits at the
          head of the line without displacing it. */}
      <span className="type-caret type-caret--lead" />

      {text.split(" ").map((word, w, words) => (
        <Fragment key={w}>
          <span className="type-word">
            {[...word].map((char, c) => {
              const slot = slots[index++];
              return (
                <span
                  key={c}
                  className="type-char"
                  style={
                    {
                      animationDelay: `${slot.at}ms`,
                      "--caret-lit": `${slot.lit}ms`,
                    } as CSSProperties
                  }
                >
                  {char}
                </span>
              );
            })}
          </span>
          {/* A real space between the inline-block words, so the line still
              breaks between them and a copy-paste keeps its spaces. */}
          {w < words.length - 1 ? " " : null}
        </Fragment>
      ))}

      <span
        className="type-caret type-caret--rest"
        style={{ animationDelay: `${restAt}ms` }}
      />
    </span>
  );
}
