<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# The Editors — working notes

## The invariant

**File processing happens in the browser. Never add a server-side upload path
for something canvas or WebAssembly can do.**

This is not a stylistic preference — it is what makes the product viable. Static
pages on a CDN cost nothing per user and absorb traffic spikes without queues,
autoscaling or rate limits. The moment a tool uploads a file, it acquires
bandwidth cost, storage liability, a size ceiling (~4.5 MB on Vercel functions)
and a privacy story to defend.

The single planned exception is Office→PDF, which needs LibreOffice in a
container. Keep it isolated so the rest of the site stays free to run.

## Adding a tool

1. Register it in `src/lib/tools.ts` — this drives the nav, the landing grid and
   the telemetry `tool_id`. Nothing else needs touching for it to appear.
2. Add a page under `src/app/tools/<slug>/`.
3. Wrap the actual work in `trackRun()` from `src/lib/analytics.ts`.
4. Use `<FileDrop>` for input. Size limits are enforced inside it, so a tool
   cannot forget them.
5. Add an e2e test — see below for what counts as one.

Put reusable computation in `src/lib/image/` or `src/lib/pdf/`, not in the page.

## Testing

A passing type-check proves almost nothing here. Everything of value is canvas
and pdf-lib behaviour at runtime, which TypeScript cannot see.

**Tests must assert on real output**, not on UI text:

- Read the downloaded file off disk and measure it
- Parse PNG dimensions from the IHDR chunk
- Load merged PDFs back with pdf-lib and count pages

A test that only checks a success message appeared is theatre.

Fixtures are generated, never committed. `e2e/fixtures.ts` encodes images in the
browser under test with deterministic high-frequency noise — a flat colour would
compress to nothing and make every size assertion pass trivially.

## Conventions

- Supabase is optional everywhere. `createClient()` returns `null` when
  unconfigured and the whole site must still work. Never assume a client.
- Telemetry records sizes and timings only. Filenames and file contents must
  never reach the database.
- Colours live as tokens in `src/app/globals.css`. No component hard-codes one.
- Revoke object URLs. Leaking them in an image tool is a real memory problem.

## Before pushing

```bash
npm run lint && npm run build && npm run test:e2e
```

CI runs the same three on every push to `main`.
