import { Fragment, type CSSProperties } from "react";

/** Milliseconds between one character appearing and the next. */
export const TYPE_STEP_MS = 22;

/** How long a single character takes to fade in, once its turn arrives. */
const CHAR_FADE_MS = 320;

/**
 * How long `<TypeOn>` takes to finish, so callers can time whatever follows
 * against it instead of hard-coding a guess that drifts when the copy changes.
 */
export function typeOnDuration(text: string, step: number = TYPE_STEP_MS) {
  return text.replace(/\s/g, "").length * step + CHAR_FADE_MS;
}

type Props = {
  text: string;
  /** Milliseconds before the first character appears. */
  startDelay?: number;
  step?: number;
};

/**
 * Types a string on, one character at a time.
 *
 * This is a *server* component, and deliberately so — the whole effect is an
 * inline `animation-delay` per character plus one CSS rule. Three things that
 * the obvious client-side implementation gets wrong and this one does not:
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
 */
export default function TypeOn({
  text,
  startDelay = 0,
  step = TYPE_STEP_MS,
}: Props) {
  const words = text.split(" ");
  let index = 0;

  return (
    <span
      aria-hidden="true"
      // Drives the travelling caret's window, so the caret stays in step with
      // whatever cadence the caller picked.
      style={{ "--type-step": `${step}ms` } as CSSProperties}
    >
      {words.map((word, w) => (
        <Fragment key={w}>
          <span className="type-word">
            {[...word].map((char, c) => (
              <span
                key={c}
                className="type-char"
                style={{ animationDelay: `${startDelay + index++ * step}ms` }}
              >
                {char}
              </span>
            ))}
          </span>
          {/* A real space between the inline-block words, so the line still
              breaks between them and a copy-paste keeps its spaces. */}
          {w < words.length - 1 ? " " : null}
        </Fragment>
      ))}
      <span
        className="type-caret"
        style={{ animationDelay: `${startDelay + index * step}ms` }}
      />
    </span>
  );
}
