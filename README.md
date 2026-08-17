# The Editors

Image and document tools that run entirely in the browser.

Compress an image to an exact file size, generate passport and stamp photos at
official millimetre dimensions, merge PDFs. No uploads, no queue, no waiting on
a server.

## The core architectural decision

**Processing happens on the user's device, not on ours.**

Canvas and WebAssembly can do almost everything this product needs — resizing,
re-encoding, cropping, PDF assembly. Choosing the browser over a server changes
the economics of the whole project:

| | Client-side | Server-side |
|---|---|---|
| Cost per operation | Zero | CPU + bandwidth + storage |
| Scaling under traffic spikes | Free — it's a static file on a CDN | Needs queues, autoscaling, rate limits |
| Privacy | Files never leave the device | Files transit and rest on our infra |
| Works offline | Yes | No |
| Upload size limit | None | Vercel functions cap at ~4.5 MB |

The one job a browser genuinely cannot do is convert Office documents
(PPT/DOC/XLS → PDF), which needs LibreOffice in a container. That is the only
planned server path, and it is deliberately isolated so the rest of the site
stays free to run.

## Status

Working today:

- **Compress to a size** — binary-searches quality, then dimensions, to land
  under a byte budget you specify
- **Passport & stamp photos** — 7 official presets with zoom/position controls,
  rendered at 200/300/600 DPI, optionally squeezed under portal upload limits
- **Merge PDFs** — any number of files, reorderable, with page counts

Scaffolded and next up: images→PDF, crop & straighten, 4K upscale, format
conversion. Office→PDF comes with the server path.

## Running locally

```bash
npm install
npm run dev
```

Supabase is optional. With no environment configured the site builds and every
tool works — auth and telemetry simply switch off. To enable them:

```bash
cp .env.example .env.local   # then fill in from Supabase → Project Settings → API
```

Apply the schema by pasting `supabase/schema.sql` into the Supabase SQL editor.
It creates:

- `profiles` — one row per user, auto-created on signup
- `tool_runs` — anonymous telemetry (sizes, durations, success), never filenames
  or contents
- `tool_health` — a view giving per-tool p95 latency and failure rate

Row-level security is on for both tables.

## Deploying

Push to GitHub and import the repo at [vercel.com/new](https://vercel.com/new).
Add the two `NEXT_PUBLIC_SUPABASE_*` variables in the Vercel project settings.
Everything except the two auth routes prerenders to static, so the CDN absorbs
traffic without invoking a function.

## Layout

```
src/
  app/            routes — landing, /tools/*, auth
  components/     shared UI
  lib/
    image/        canvas helpers, target-size compressor, photo presets
    pdf/          merge, split, rotate, images→PDF
    supabase/     browser + server clients (null when unconfigured)
    analytics.ts  fire-and-forget telemetry
    tools.ts      tool registry — drives nav, landing grid, telemetry IDs
supabase/
  schema.sql      tables, RLS policies, health view
```

Adding a tool means adding an entry to `src/lib/tools.ts` and a page under
`src/app/tools/`.

## Design

Colours, radii and fonts are tokens in `src/app/globals.css`. Restyling the
whole site means editing that one block — no component holds a hard-coded
colour.
