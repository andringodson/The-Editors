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

Seven tools working, all client-side:

| Tool | What it does |
|---|---|
| **Compress to a size** | Binary-searches quality, then dimensions, to land under a byte budget you name |
| **Passport & stamp photos** | 7 official presets, 200/300/600 DPI, optional squeeze under portal limits |
| **Crop & straighten** | Drag-select with ratio locks, plus tilt correction and 90° rotation |
| **Upscale to 4K** | Resample the longest edge to HD/2K/4K/8K |
| **Change format** | JPEG ⇄ PNG ⇄ WebP, with AVIF and HEIC accepted as input |
| **Merge PDFs** | Any number of files, reorderable, with live page counts |
| **Images to PDF** | Photos or scans into one A4 or fit-to-image document |

Plus one that is not:

| Tool | What it does |
|---|---|
| **Office to PDF** | PPT/DOC/XLS → PDF via LibreOffice in a container |

Office→PDF needs a server, so it is optional and self-announcing: with no
`NEXT_PUBLIC_CONVERTER_URL` set it reports itself unavailable on its own page
and shows as "Soon" on the landing grid, while every other tool is unaffected.
See [`services/converter/`](services/converter/) for the service and its
deployment notes.

The file goes straight from the browser to that service — never through Vercel,
which caps request bodies at about 4.5 MB. Access is gated by a five-minute HMAC
token minted at `/api/convert-token`, so the endpoint is not free CPU for
whoever finds it, without putting a login in front of a first-time user.

## Mobile and tablet

The app is an installable PWA and works **fully offline**.

That falls out of the architecture rather than being bolted on: since the seven
browser tools are pure client-side computation, the only thing between them and
offline use was having the HTML and JS on disk. The service worker puts it
there. Install it from a phone or tablet and cropping, compressing and merging
all work in aeroplane mode — only Office→PDF needs a connection, and the offline
page says so.

This is also the right first step toward store apps. A wrapped or native shell
later gets a codebase that already assumes no network.

**The icons are placeholders.** `public/icon.svg` and `public/icon-maskable.svg`
are a plain geometric mark. Replace them when the real set arrives — PNG at 192
and 512 px is the safest cross-platform pair, and keep a `maskable` variant with
the artwork inside the inner 80% so Android does not clip it.

## Tests

```bash
npm run test:e2e
```

14 end-to-end tests drive headless Chromium against a production build. They
assert on **real output bytes**, not UI text — compressed files are read off
disk and measured against the target, PNG dimensions are parsed out of the IHDR
chunk, and merged PDFs are loaded back with pdf-lib to count pages. A green
type-check tells you nothing about whether canvas actually encoded anything;
these tests do.

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
