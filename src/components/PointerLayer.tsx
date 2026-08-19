"use client";

import { useEffect } from "react";

/**
 * The section pool: a pool of a section's own colour trailing the cursor
 * through it. Sections opt in with `data-fluid`; this publishes `--fx`/`--fy`
 * and one CSS gradient does the painting.
 *
 * The cursor itself is deliberately *not* here. It was, as two divs tracking
 * the pointer, and it moved into `globals.css` as a native `cursor: url(…)`.
 * The compositor draws that, so it has no latency — and, the reason it matters
 * on this site specifically, it does not stutter while the main thread is busy
 * encoding an image. A DOM cursor freezes exactly when the tool is working.
 *
 * Three things keep what remains off the budget the encoders need:
 *
 * - **One delegated listener for the whole document**, resolved with
 *   `closest()`, rather than a pair per section.
 * - **The rect is measured once per section**, when the pointer enters it, not
 *   once per frame — reading a bounding rect forces layout, and this runs on
 *   every pointer move.
 * - **The loop cancels itself** once the pool catches up, so a still cursor
 *   costs no frames at all. `e2e/pointer.spec.ts` asserts that.
 */

/** Per-frame easing. The lag is what makes the pool read as fluid rather than
 *  as a shape welded to the cursor. */
const POOL_EASING = 0.12;

/** Below this, the pool has arrived and the loop can stop. */
const SETTLED = 0.15;

export default function PointerLayer() {
  useEffect(() => {
    // A coarse pointer never hovers, so the pool would appear on tap and stick
    // there — which reads as a rendering fault rather than as a response.
    if (!window.matchMedia("(hover: hover)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let section: HTMLElement | null = null;
    let rect: DOMRect | null = null;
    let targetX = 50;
    let targetY = 50;
    let x = 50;
    let y = 50;
    let frame = 0;

    const step = () => {
      frame = 0;
      if (!section) return;

      x += (targetX - x) * POOL_EASING;
      y += (targetY - y) * POOL_EASING;
      section.style.setProperty("--fx", `${x.toFixed(2)}%`);
      section.style.setProperty("--fy", `${y.toFixed(2)}%`);

      if (Math.abs(targetX - x) > SETTLED || Math.abs(targetY - y) > SETTLED) {
        frame = requestAnimationFrame(step);
      }
    };

    const onMove = (event: PointerEvent) => {
      const next =
        (event.target as Element | null)?.closest<HTMLElement>(
          "[data-fluid]",
        ) ?? null;

      if (next !== section) {
        section = next;
        // Measured once when the pointer enters, not once per frame.
        rect = next?.getBoundingClientRect() ?? null;
        if (rect) {
          // Start the pool where the pointer entered rather than easing it in
          // from wherever the last section left it.
          x = targetX = ((event.clientX - rect.left) / rect.width) * 100;
          y = targetY = ((event.clientY - rect.top) / rect.height) * 100;
        }
      }

      if (!rect || !section) return;
      targetX = ((event.clientX - rect.left) / rect.width) * 100;
      targetY = ((event.clientY - rect.top) / rect.height) * 100;
      if (!frame) frame = requestAnimationFrame(step);
    };

    // The cached rect is only wrong once the page moves under it.
    const invalidate = () => {
      rect = section?.getBoundingClientRect() ?? null;
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", invalidate, { passive: true });
    window.addEventListener("resize", invalidate);

    return () => {
      document.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", invalidate);
      window.removeEventListener("resize", invalidate);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
