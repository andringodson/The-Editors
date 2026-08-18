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

## How it's funded

Advertising. There are no paid tiers and no accounts required for anything that
runs in your browser — every tool is available to everyone.

Two limits survive, and neither is a sales tactic:

| Limit | Why it exists |
|---|---|
| 100 files per batch | pdf-lib holds whole documents in memory; past this the tab dies |
| 10 Office→PDF a day, per account | The only tool on hardware we pay for |

The Office quota is enforced server-side at `/api/convert-token` — the one
chokepoint that cannot be skipped, since the converter rejects any request
without a token. The batch cap is a client-side affordance by contrast, and the
code says so rather than pretending otherwise.

### The honest version of the privacy claim

"Your files never leave your device" stays true — ads don't touch them. But
AdSense profiles visitors and sets cookies, so the site must not imply it
collects nothing. `/privacy` states both plainly rather than letting the
marketing copy overstate.

Three deliberate choices:

- **Non-personalised by default.** Ads render untargeted unless a visitor opts
  in. It earns less; it is also the only default that is lawful in the EEA/UK
  without a consent flow, and the only one consistent with the rest of the
  product.
- **The CSP widens only when ads are switched on.** `next.config.ts` adds the
  Google origins conditionally, so a deployment with no publisher id keeps the
  strict `'self'` policy. The tight version isn't quietly lost for everyone.
- **No unit sits inside a tool's working area.** Slots go below the tool, never
  between a user and the thing they came to do.

### Before you switch ads on

- **AdSense approval is not automatic.** New sites with thin content are
  routinely rejected. The seven tool pages plus `/privacy` are a reasonable
  starting position, but expect to iterate.
- **EEA/UK traffic needs a Google-certified CMP.** `ConsentBanner` is an honest
  prompt, not a certified one — Google requires a CMP from its approved list
  before serving European traffic. Wire one in before launching there.
- **Fill in `public/ads.txt`.** Without your publisher id served at the site
  root, most programmatic demand won't bid.
- **Expect heavy ad blocking.** A privacy-conscious audience is exactly the
  audience that blocks ads, so model revenue pessimistically.

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

Icons are pixel art matching the interface: a Win95 window holding a picture,
drawn on a 16×16 grid and scaled by `viewBox` rather than designed large and
shrunk, so every edge lands on a whole pixel at any size. `shape-rendering:
crispEdges` stops the browser antialiasing the blocks into mush in a favicon.

`icon-maskable.svg` centres the same art in the inner 80% so Android's circular
crop never clips it — only the teal bleeds off.

If you later want raster fallbacks for older platforms, export these at 192 and
512 px; SVG covers everything current.

## Tests

```bash
npm run test:e2e
```

48 tests drive headless Chromium against a production build: functional,
accessibility (axe, WCAG 2.1 A/AA), SEO, PWA and touch.

The functional ones assert on **real output bytes**, not UI text — compressed files are read off
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

A Windows 95 interface language, adapted from
[robbyyeager.com](https://robbyyeager.com/), floating on a modern fluid
backdrop. The chrome is the genuine article — `#c0c0c0` face, white highlight,
`#808080` shadow, black dark-shadow — and the whole look is four `box-shadow`
rings (`.bevel-out`, `.bevel-in`, `.bevel-field`) rather than images.

### The backdrop

Violet light pooling on true `#000000`. True black rather than near-black
because OLED panels switch those pixels off entirely — deeper look, less
battery.

**It is CSS gradients, not WebGL or canvas, and that is a deliberate
constraint.** This site's real work is canvas and WASM image encoding; a shader
background would compete for the exact GPU and CPU the compressor needs, and a
decorative layer must never make the tool slower. So the visuals are layered
radial gradients that the compositor handles for free, and the only JavaScript
publishes two custom properties with the pointer position.

Two things to preserve if `FluidBackground.tsx` is ever edited:

- The rAF loop **cancels itself once the glow catches up**, so an idle tab costs
  nothing. It is not a permanent animation frame.
- The 6%-per-frame easing is what makes it read as fluid — the glow lags the
  cursor rather than snapping to it.

Under `prefers-reduced-motion` the pointer tracking never starts and the drift
animation is disabled, leaving a static violet field.

### The app surface

The window chrome stays period-grey, but every page's *contents* are the
same violet field as the desktop behind it — so the frame reads as the OS and
the page reads as the app running inside it, rather than the two ignoring each
other.

Its bevels are rebuilt from violet and black rather than reusing `.bevel-out`:
the grey highlight/shadow pair is invisible against a dark field, so the same
geometry needs different pigment. Secondary text is lightened to `#b9b1d6`,
chosen to clear 4.5:1 against the *darkest* band of the gradient rather than the
lightest — and the unavailable card is recessed rather than faded, because
opacity drags text below contrast wherever it is applied.

The surface lives on `<main>`, so a new page inherits it automatically. Win95
controls pigmented for a grey face get dark counterparts scoped under
`.surface-violet` — white highlights vanish on dark, and the period green and
red fall below contrast. Specificity is handled with compound selectors rather
than `!important`: `.surface-violet .bg-surface` beats Tailwind's `.bg-surface`
without starting an escalation war.

Everything lives in `src/app/globals.css`. No component holds a hard-coded
colour.

**Where it deliberately breaks with the era**, because authenticity stops being
a virtue the moment it costs someone the task they came for:

| Authentic | Here | Why |
|---|---|---|
| 13px base type | 15px | Below the modern legibility floor, and this is used on phones |
| `user-select: none` | Selectable | People copy dimensions and file sizes out of the UI |
| 16px buttons | 44px min | Authentic hit targets are unusable with a thumb |
| Dotted focus outline | 2px solid ring | The 90s outline all but vanishes on a grey face |
| `#808080` secondary text | `#4a4a4a` | The original fails 4.5:1 contrast on `#c0c0c0` |
| No dark mode | Invented "night" skin | The app already had one; dropping it would regress users |

Pixel type (Pixelify Sans) is confined to `h1` — characterful at 30px, punishing
at 15px. **Ligatures are disabled on it**, and not for taste: its `fi` ligature
renders as a glyph that reads as a capital A, so "files" came out as "Ales" in
the headline until it was switched off.
