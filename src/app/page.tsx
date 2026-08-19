import Link from "next/link";
import AdSlot from "@/components/AdSlot";
import TypeOn, { typeOnDuration } from "@/components/TypeOn";
import { isConverterConfigured } from "@/lib/converter";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  TOOLS,
  effectiveStatus,
  toolOrdinal,
  toolTint,
} from "@/lib/tools";

/*
 * One constant, two jobs: the string the headline types out, and the heading's
 * accessible name. They cannot drift apart.
 */
const HEADLINE = "Image and document tools that never upload your files";

/*
 * Everything below the headline arrives on the headline's own clock rather than
 * on hand-tuned numbers, so rewriting the copy re-times the hero for free.
 *
 * The body starts at just past halfway and the buttons land marginally early:
 * a strictly sequential stagger reads as waiting, whereas a slight overlap
 * reads as one movement. Nothing here gates interaction — the buttons are
 * clickable from the first frame; only their paint is delayed.
 */
const TYPED_MS = typeOnDuration(HEADLINE);
const BODY_DELAY = Math.round(TYPED_MS * 0.55);
const CTA_DELAY = TYPED_MS - 80;
const CHIP_DELAY = TYPED_MS + 120;

const CHIPS = ["Free", "No upload", "No account", "Works offline"];

/**
 * Landing page.
 *
 * Laid out on the hairline grid: a full-bleed hero over the dot matrix, then
 * one `.cells` grid per category. The grids take no breakpoints — the column
 * count falls out of the width available, so there is no viewport at which the
 * page looks half-built.
 */
export default function Home() {
  return (
    <div className="shell">
      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                               */}
      {/* ------------------------------------------------------------------ */}
      <section
        data-fluid
        className="matrix bleed border-b border-line pt-[var(--space-l)] pb-[var(--space-m)]"
      >
        <div className="eyebrow">
          <span>
            {TOOLS.length} tools <span className="sep">/</span> free + open
            source
          </span>
          <span>
            Canvas <span className="sep">/</span> WebAssembly
          </span>
        </div>

        {/* The characters are hidden from the accessibility tree and the name
            supplied here instead — screen readers announce text split across
            spans erratically. */}
        <h1 className="mt-[var(--space-l)] text-balance" aria-label={HEADLINE}>
          <TypeOn text={HEADLINE} />
        </h1>

        <div className="mt-[var(--space-l)] grid gap-[var(--space-s)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <p
            className="rise-in prose text-muted"
            style={{ animationDelay: `${BODY_DELAY}ms` }}
          >
            Compress to an exact size, size a passport photo to the millimetre,
            merge PDFs. Everything runs inside your browser — nothing is sent to
            a server, so it works offline and finishes as fast as your machine
            can go.
          </p>

          {/* Two equal actions, sharing a single hairline where they meet and
              stacking when the column cannot hold both. */}
          <div
            className="rise-in grid gap-px self-start bg-line sm:grid-cols-2"
            style={{ animationDelay: `${CTA_DELAY}ms` }}
          >
            <Link href="/tools/compress" className="btn btn-primary btn-block">
              Compress an image
              <span aria-hidden="true">→</span>
            </Link>
            <Link href="/tools/pdf-merge" className="btn btn-block">
              Merge PDFs
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

        <ul className="mt-[var(--space-s)] flex flex-wrap gap-x-[var(--space-s)] gap-y-1">
          {CHIPS.map((chip, i) => (
            <li
              key={chip}
              className="rise-in label-tight"
              style={{ animationDelay: `${CHIP_DELAY + i * 70}ms` }}
            >
              <span aria-hidden="true" className="text-accent">
                +{" "}
              </span>
              {chip}
            </li>
          ))}
        </ul>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Tool grids                                                         */}
      {/* ------------------------------------------------------------------ */}
      {CATEGORY_ORDER.map((category) => {
        const tools = TOOLS.filter((tool) => tool.category === category);
        if (tools.length === 0) return null;

        return (
          <section
            key={category}
            data-fluid
            className="bleed border-b border-line py-[var(--space-m)]"
          >
            <div className="eyebrow">
              <span>
                {tools.length} {tools.length === 1 ? "tool" : "tools"}{" "}
                <span className="sep">/</span>{" "}
                {category === "convert" ? "server assisted" : "on device"}
              </span>
              <span>
                No account <span className="sep">/</span> no upload
              </span>
            </div>

            <h2 className="headline headline-sm">
              {CATEGORY_LABELS[category]}.
            </h2>

            <ul className="cells mt-[var(--space-s)]">
              {tools.map((tool) => {
                const status = effectiveStatus(tool, isConverterConfigured);

                const body = (
                  <>
                    <div className="flex items-baseline justify-between gap-[var(--space-2xs)]">
                      <span className="cell-index">{toolOrdinal(tool)}</span>
                      <span className="label-tight">
                        {status === "live" ? "Ready" : "Soon"}
                      </span>
                    </div>
                    <h3>{tool.name}</h3>
                    <p className="text-muted text-pretty">{tool.blurb}</p>
                    <span className="label-tight mt-auto pt-[var(--space-2xs)]">
                      {status === "live" ? (
                        <>
                          Open <span className="text-accent">→</span>
                        </>
                      ) : (
                        "Not connected"
                      )}
                    </span>
                  </>
                );

                return status === "live" ? (
                  <li key={tool.id}>
                    <Link
                      href={`/tools/${tool.slug}`}
                      className={`cell h-full ${toolTint(tool)}`}
                    >
                      {body}
                    </Link>
                  </li>
                ) : (
                  /* Recessed, not faded: dimming with opacity drags the muted
                     text below 4.5:1 contrast. */
                  <li
                    key={tool.id}
                    className={`cell cell-muted ${toolTint(tool)}`}
                  >
                    {body}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <div className="bleed">
        <AdSlot
          name="landingInline"
          className="my-[var(--space-m)]"
          label="Advertisement — keeps these tools free"
        />
      </div>
    </div>
  );
}
