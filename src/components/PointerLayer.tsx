"use client";

import { useEffect, useRef } from "react";

/**
 * Everything driven by the pointer, on one listener.
 *
 * Two effects share a single `pointermove` stream and a single animation frame,
 * because they are the same information asked twice:
 *
 * 1. **The section pool** — a pool of a section's own colour trailing the
 *    cursor through it. Sections opt in with `data-fluid`; this only publishes
 *    `--fx`/`--fy` and one CSS gradient does the painting.
 * 2. **The cursor** — a square dot that inverts against whatever is behind it,
 *    and a ring that lags behind it and takes the colour of the tool or section
 *    it is over.
 *
 * Four things keep it off the budget the image encoders need:
 *
 * - **One delegated listener for the whole document**, resolved with
 *   `closest()`, rather than a set per section.
 * - **Rects and computed styles are read on change, not per frame.** Both force
 *   layout or style resolution, and this runs on every pointer move.
 * - **Only `transform` is written**, so the cursor stays on the compositor and
 *   never triggers layout or paint.
 * - **The loop cancels itself** once everything has caught up, so a still
 *   cursor costs no frames at all. `e2e/fluid.spec.ts` asserts that.
 */

/** Per-frame easing. The pool lags further than the ring; the ring further than
 *  the dot, which does not lag at all. That ordering is what reads as fluid. */
const POOL_EASING = 0.12;
const RING_EASING = 0.18;

/** Below this, everything has arrived and the loop can stop. */
const SETTLED_PERCENT = 0.15;
const SETTLED_PX = 0.2;

/** Elements the ring should open up over. */
const INTERACTIVE =
  "a, button, [role='button'], input, select, textarea, label, summary, [tabindex]";

export default function PointerLayer() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    // A coarse pointer never hovers: the pool would appear on tap and stick
    // there, and a drawn cursor has nothing to track.
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches)
      return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Reduced motion keeps the cursor but drops the lag: the trailing is the
    // motion, not the cursor itself.
    const ringEasing = still ? 1 : RING_EASING;

    /*
     * The native cursor is hidden here rather than in the stylesheet, and that
     * matters: if this component never runs — a chunk fails, JS is off — the
     * page keeps a working cursor instead of none at all. The safe state is the
     * one that survives the code not running.
     */
    document.documentElement.classList.add("has-cursor");

    // --- the pool ---------------------------------------------------------
    let section: HTMLElement | null = null;
    let rect: DOMRect | null = null;
    let poolTargetX = 50;
    let poolTargetY = 50;
    let poolX = 50;
    let poolY = 50;

    // --- the cursor -------------------------------------------------------
    let tinted: Element | null = null;
    let pointerX = -100;
    let pointerY = -100;
    let ringX = -100;
    let ringY = -100;

    let frame = 0;

    /*
     * These are function expressions rather than declarations on purpose.
     * Declarations are hoisted, so TypeScript analyses their bodies as though
     * they were created before the `dot`/`ring` guard above and loses the
     * narrowing; an expression is created where it is written and keeps it.
     */
    const step = () => {
      frame = 0;

      dot.style.transform = `translate3d(${pointerX}px, ${pointerY}px, 0)`;

      ringX += (pointerX - ringX) * ringEasing;
      ringY += (pointerY - ringY) * ringEasing;
      ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;

      let busy =
        Math.abs(pointerX - ringX) > SETTLED_PX ||
        Math.abs(pointerY - ringY) > SETTLED_PX;

      if (section && !still) {
        poolX += (poolTargetX - poolX) * POOL_EASING;
        poolY += (poolTargetY - poolY) * POOL_EASING;
        section.style.setProperty("--fx", `${poolX.toFixed(2)}%`);
        section.style.setProperty("--fy", `${poolY.toFixed(2)}%`);
        busy ||=
          Math.abs(poolTargetX - poolX) > SETTLED_PERCENT ||
          Math.abs(poolTargetY - poolY) > SETTLED_PERCENT;
      }

      if (busy) frame = requestAnimationFrame(step);
    };

    const onMove = (event: PointerEvent) => {
      pointerX = event.clientX;
      pointerY = event.clientY;

      const target = event.target as Element | null;

      // The ring takes the colour of the nearest tinted ancestor — the tool's
      // hue inside a tool, the primary everywhere else. Read once per change:
      // getComputedStyle forces style resolution.
      const owner = target?.closest(".tint") ?? null;
      if (owner !== tinted) {
        tinted = owner;
        ring.style.setProperty(
          "--cursor-accent",
          getComputedStyle(owner ?? document.documentElement)
            .getPropertyValue("--accent")
            .trim(),
        );
      }

      ring.classList.toggle("is-open", Boolean(target?.closest(INTERACTIVE)));

      const next = target?.closest<HTMLElement>("[data-fluid]") ?? null;
      if (next !== section) {
        section = next;
        // Measured once when the pointer enters, not once per frame.
        rect = next?.getBoundingClientRect() ?? null;
        if (rect) {
          poolX = poolTargetX = ((pointerX - rect.left) / rect.width) * 100;
          poolY = poolTargetY = ((pointerY - rect.top) / rect.height) * 100;
        }
      }
      if (rect) {
        poolTargetX = ((pointerX - rect.left) / rect.width) * 100;
        poolTargetY = ((pointerY - rect.top) / rect.height) * 100;
      }

      ring.classList.remove("is-gone");
      dot.classList.remove("is-gone");
      if (!frame) frame = requestAnimationFrame(step);
    };

    const onLeave = (event: PointerEvent) => {
      // relatedTarget is null only when the pointer has left the window, not
      // when it crosses between elements inside it.
      if (event.relatedTarget) return;
      ring.classList.add("is-gone");
      dot.classList.add("is-gone");
    };

    const press = (down: boolean) => () =>
      ring.classList.toggle("is-pressed", down);
    const onDown = press(true);
    const onUp = press(false);

    // The cached rect is only wrong once the page moves under it.
    const invalidate = () => {
      rect = section?.getBoundingClientRect() ?? null;
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerout", onLeave, { passive: true });
    document.addEventListener("pointerdown", onDown, { passive: true });
    document.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("scroll", invalidate, { passive: true });
    window.addEventListener("resize", invalidate);

    return () => {
      document.documentElement.classList.remove("has-cursor");
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerout", onLeave);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointerup", onUp);
      window.removeEventListener("scroll", invalidate);
      window.removeEventListener("resize", invalidate);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      <div ref={ringRef} className="cursor-ring is-gone" aria-hidden="true" />
      <div ref={dotRef} className="cursor-dot is-gone" aria-hidden="true" />
    </>
  );
}
