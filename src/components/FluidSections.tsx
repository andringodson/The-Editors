"use client";

import { useEffect } from "react";

/**
 * Pointer-reactive glow inside each section.
 *
 * The same idea as the page backdrop, scoped: a pool of the section's own
 * colour that trails the cursor through it. Sections are marked with
 * `data-fluid`; the paint itself is one CSS gradient, and this component only
 * publishes where the pool should be.
 *
 * Three things keep it from costing anything the tools need:
 *
 * 1. **One listener for the whole document**, delegated through `closest()`,
 *    rather than a pair per section.
 * 2. **The rect is measured once per section**, when the pointer enters it, not
 *    once per frame — reading a bounding rect forces layout, and this runs on
 *    every pointer move.
 * 3. **The loop cancels itself** once the pool catches up, so a still cursor
 *    costs no frames at all. It is not a permanent animation frame.
 *
 * The 12%-per-frame easing is what makes it read as fluid rather than welded to
 * the cursor — the same lag the backdrop uses, slightly quicker because the
 * distance travelled inside one section is shorter.
 */

const EASING = 0.12;
/** Below this, the pool has arrived and the loop can stop. */
const SETTLED = 0.15;

export default function FluidSections() {
  useEffect(() => {
    // A coarse pointer never hovers, so the effect could only fire on tap —
    // where it reads as a rendering glitch rather than as a response.
    if (!window.matchMedia("(hover: hover)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let section: HTMLElement | null = null;
    let rect: DOMRect | null = null;

    // Target and eased positions, both as percentages of the section.
    let targetX = 50;
    let targetY = 50;
    let x = 50;
    let y = 50;
    let frame = 0;

    function step() {
      frame = 0;
      if (!section) return;

      x += (targetX - x) * EASING;
      y += (targetY - y) * EASING;

      section.style.setProperty("--fx", `${x.toFixed(2)}%`);
      section.style.setProperty("--fy", `${y.toFixed(2)}%`);

      if (Math.abs(targetX - x) > SETTLED || Math.abs(targetY - y) > SETTLED) {
        frame = requestAnimationFrame(step);
      }
    }

    function onMove(event: PointerEvent) {
      const target =
        (event.target as Element | null)?.closest<HTMLElement>(
          "[data-fluid]",
        ) ?? null;

      if (target !== section) {
        section = target;
        rect = target?.getBoundingClientRect() ?? null;
        // Start the pool where the pointer entered rather than easing it in
        // from wherever the last section left it.
        if (rect) {
          x = targetX = ((event.clientX - rect.left) / rect.width) * 100;
          y = targetY = ((event.clientY - rect.top) / rect.height) * 100;
        }
      }

      if (!rect || !section) return;
      targetX = ((event.clientX - rect.left) / rect.width) * 100;
      targetY = ((event.clientY - rect.top) / rect.height) * 100;
      if (!frame) frame = requestAnimationFrame(step);
    }

    // The cached rect is only wrong after the page moves under it.
    function invalidate() {
      rect = section?.getBoundingClientRect() ?? null;
    }

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
