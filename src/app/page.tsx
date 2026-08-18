import Link from "next/link";
import AdSlot from "@/components/AdSlot";
import { isConverterConfigured } from "@/lib/converter";
import {
  CATEGORY_LABELS,
  TOOLS,
  effectiveStatus,
  type ToolCategory,
} from "@/lib/tools";

const CATEGORY_ORDER: ToolCategory[] = ["image", "pdf", "convert"];

/**
 * Landing page.
 *
 * The window chrome around it stays period-grey, but the contents are the
 * violet field of the desktop behind it — so the frame reads as the OS and the
 * page reads as the app running inside it, rather than the two ignoring each
 * other.
 */
export default function Home() {
  return (
    <div className="surface-violet px-4 py-14 sm:px-8">
      <section className="mx-auto max-w-4xl">
        <h1 className="headline-glow text-4xl leading-tight text-balance sm:text-5xl">
          Image and document tools that never upload your files
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted text-pretty">
          Compress to an exact size, size a passport photo to the millimetre,
          merge PDFs. Everything runs inside your browser — nothing is sent to a
          server, so it works offline and finishes as fast as your machine can
          go.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/tools/compress"
            className="btn-violet inline-flex items-center px-6 py-3 font-bold no-underline"
          >
            Compress an image
          </Link>
          <Link
            href="/tools/pdf-merge"
            className="btn-violet-ghost inline-flex items-center px-6 py-3 font-medium no-underline"
          >
            Merge PDFs
          </Link>
        </div>

        <ul className="mt-8 flex flex-wrap gap-2 text-xs">
          {["Free", "No upload", "No account", "Works offline"].map((chip) => (
            <li
              key={chip}
              className="card-violet px-3 py-1.5 text-muted"
            >
              {chip}
            </li>
          ))}
        </ul>
      </section>

      {CATEGORY_ORDER.map((category) => {
        const tools = TOOLS.filter((tool) => tool.category === category);
        if (tools.length === 0) return null;

        return (
          <section key={category} className="mx-auto mt-14 max-w-4xl">
            <h2 className="text-xs font-semibold tracking-[0.2em] text-muted uppercase">
              {CATEGORY_LABELS[category]}
            </h2>

            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((tool) => {
                const status = effectiveStatus(tool, isConverterConfigured);
                const card = (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold">{tool.name}</h3>
                      {status === "soon" ? (
                        <span className="shrink-0 border border-white/15 px-2 py-0.5 text-[11px] text-muted">
                          Soon
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm text-muted text-pretty">
                      {tool.blurb}
                    </p>
                  </>
                );

                return (
                  <li key={tool.id}>
                    {status === "live" ? (
                      <Link
                        href={`/tools/${tool.slug}`}
                        className="card-violet block h-full p-4 no-underline"
                      >
                        {card}
                      </Link>
                    ) : (
                      /* Recessed, not faded: dimming with opacity drags the
                         muted text below 4.5:1 contrast. */
                      <div className="card-violet-inset h-full p-4">{card}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <div className="mx-auto max-w-4xl">
        <AdSlot
          name="landingInline"
          className="mt-14"
          label="Advertisement — keeps these tools free"
        />
      </div>
    </div>
  );
}
