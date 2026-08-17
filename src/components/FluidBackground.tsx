"use client";

import { useEffect } from "react";

/**
 * Pointer-reactive fluid backdrop.
 *
 * Deliberately *not* WebGL or canvas. This site's real work is canvas and WASM
 * image encoding — a shader background would compete for the exact GPU and CPU
 * the compressor needs, and a decorative layer must never make the tool slower.
 *
 * So the visuals are layered CSS radial gradients, which the compositor handles
 * on the GPU for free. All this component does is publish two custom properties
 * with the pointer position.
 *
 * Two efficiencies worth keeping if this is ever edited:
 *
 *   1. The rAF loop only runs while the cursor is actually catching up. Once it
 *      settles the loop cancels itself, so an idle tab costs nothing.
 *   2. The easing (6% per frame) is what makes it read as fluid — the glow lags
 *      the cursor rather than snapping to it. Raising it toward 1 removes the
 *      effect entirely.
 */
export default function FluidBackground() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;

    const root = document.documentElement;

    // Current and target position, normalised 0..1.
    let x = 0.5;
    let y = 0.35;
    let targetX = x;
    let targetY = y;
    let frame = 0;

    const tick = () => {
      x += (targetX - x) * 0.06;
      y += (targetY - y) * 0.06;

      root.style.setProperty("--mx", `${(x * 100).toFixed(2)}%`);
      root.style.setProperty("--my", `${(y * 100).toFixed(2)}%`);

      const settled =
        Math.abs(targetX - x) < 0.0015 && Math.abs(targetY - y) < 0.0015;
      frame = settled ? 0 : requestAnimationFrame(tick);
    };

    const onMove = (event: PointerEvent) => {
      targetX = event.clientX / window.innerWidth;
      targetY = event.clientY / window.innerHeight;
      if (!frame) frame = requestAnimationFrame(tick);
    };

    // passive: this never calls preventDefault, and saying so lets the browser
    // skip blocking scroll on it.
    window.addEventListener("pointermove", onMove, { passive: true });

    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return <div className="fluid-bg" aria-hidden="true" />;
}
