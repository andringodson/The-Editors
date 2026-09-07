"use client";

import { useId } from "react";

interface CompareSliderProps {
  beforeUrl: string;
  afterUrl: string;
  /** Drives the box's aspect ratio so the two images cannot disagree. */
  width: number;
  height: number;
  position: number;
  onPosition: (value: number) => void;
}

/**
 * Before/after wipe.
 *
 * An upscaler that only reports a pixel count is asking to be taken on trust.
 * The result is a judgement — whether the detail it invented is detail you
 * wanted — and that judgement needs the two images in the same place at the
 * same scale.
 *
 * Both are painted at the box size and the top one is clipped, rather than
 * resizing anything: a wipe that changed the zoom would compare the wrong
 * thing. The control is a real range input, so it works from the keyboard and
 * announces itself, with the handle drawn on top of it.
 */
export default function CompareSlider({
  beforeUrl,
  afterUrl,
  width,
  height,
  position,
  onPosition,
}: CompareSliderProps) {
  const id = useId();

  return (
    <div>
      {/* The ratio sizes the box to the result, but an 8K portrait would other-
          wise push the download button off the screen, so it is capped and the
          images letterbox inside it. */}
      <div
        className="relative isolate max-h-[70vh] overflow-hidden border border-line bg-panel"
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={afterUrl}
          alt="Upscaled result"
          className="absolute inset-0 h-full w-full object-contain"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={beforeUrl}
          alt="Original, for comparison"
          className="absolute inset-0 h-full w-full object-contain"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        />

        <div
          aria-hidden="true"
          className="absolute inset-y-0 w-px bg-accent"
          style={{ left: `${position}%` }}
        />

        <span
          aria-hidden="true"
          className="label-tight absolute top-2 left-2 bg-panel/90 px-1.5 py-0.5"
        >
          Original
        </span>
        <span
          aria-hidden="true"
          className="label-tight absolute top-2 right-2 bg-panel/90 px-1.5 py-0.5"
        >
          Upscaled
        </span>
      </div>

      <label htmlFor={id} className="label mt-[var(--space-2xs)] block">
        Comparison wipe
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        value={position}
        onChange={(event) => onPosition(Number(event.target.value))}
        className="mt-1.5 w-full accent-[var(--accent)]"
      />
    </div>
  );
}
