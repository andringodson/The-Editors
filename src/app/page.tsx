import Link from "next/link";
import { isConverterConfigured } from "@/lib/converter";
import {
  CATEGORY_LABELS,
  TOOLS,
  effectiveStatus,
  type ToolCategory,
} from "@/lib/tools";

const CATEGORY_ORDER: ToolCategory[] = ["image", "pdf", "convert"];

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-14">
      <section className="max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Image and document tools that never upload your files
        </h1>
        <p className="mt-4 text-lg text-muted text-pretty">
          Compress to an exact size, size a passport photo to the millimetre,
          merge PDFs. Everything runs inside your browser — nothing is sent to a
          server, so it works offline and finishes as fast as your machine can
          go.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/tools/compress"
            className="rounded-[var(--radius-base)] bg-accent px-5 py-2.5 font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            Compress an image
          </Link>
          <Link
            href="/tools/pdf-merge"
            className="rounded-[var(--radius-base)] border border-border-strong px-5 py-2.5 font-medium transition-colors hover:border-accent"
          >
            Merge PDFs
          </Link>
        </div>
      </section>

      {CATEGORY_ORDER.map((category) => {
        const tools = TOOLS.filter((tool) => tool.category === category);
        if (tools.length === 0) return null;

        return (
          <section key={category} className="mt-14">
            <h2 className="text-sm font-medium tracking-wide text-muted uppercase">
              {CATEGORY_LABELS[category]}
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((tool) => {
                const status = effectiveStatus(tool, isConverterConfigured);
                const card = (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium">{tool.name}</h3>
                      {status === "soon" ? (
                        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted">
                          Soon
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1.5 text-sm text-muted text-pretty">
                      {tool.blurb}
                    </p>
                  </>
                );

                return (
                  <li key={tool.id}>
                    {status === "live" ? (
                      <Link
                        href={`/tools/${tool.slug}`}
                        className="block h-full rounded-[var(--radius-base)] border border-border bg-surface p-4 transition-colors hover:border-accent"
                      >
                        {card}
                      </Link>
                    ) : (
                      <div className="h-full rounded-[var(--radius-base)] border border-border bg-surface p-4 opacity-65">
                        {card}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
