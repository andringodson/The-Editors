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

62 tests drive headless Chromium against a production build: functional, responsive,
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

A textmode grid, adapted from
[extension.textmode.art](https://extension.textmode.art/), floating on the
violet OLED field: a strict modular layout drawn in 1px hairlines, monospace
throughout, uppercase micro-labels in the corner of every panel.

Everything lives in `src/app/globals.css`. No component holds a hard-coded
colour or size.

### The layout is fluid, not stepped

This is the part that matters, and the part a screenshot cannot show. There is
no width at which the page switches to a different design — type, spacing and
column counts all interpolate.

| Device | How |
|---|---|
| Type | Seven `clamp()` steps, `--step--2` through `--step-4` |
| Spacing | Seven `clamp()` steps, applied through `gap`, never per-child margins |
| Columns | `repeat(auto-fit, minmax(min(100%, 17rem), 1fr))` — the count falls out of the width |
| Overflow guard | The inner `min(100%, …)`, without which a bare `minmax` overflows any container narrower than the track |

The whole stylesheet contains **two** media queries, and neither is a width:
`prefers-reduced-motion` and `hover: none`. Both ask about the person rather
than the screen, which is the only question a media query answers well.

Every fluid step mixes a `rem` term with the `vw` term. A pure-`vw` size ignores
browser zoom and the reader's font-size setting, which fails WCAG 1.4.4 — the
kind of bug that never surfaces until someone who needs larger text arrives.

`e2e/responsive.spec.ts` sweeps 320px to 1600px in 40px increments rather than
spot-checking three device presets, because a broken in-between width is exactly
what a preset-based check steps over. It asserts no horizontal overflow on any
page, that the headline never shrinks as the viewport grows, and that no single
40px step changes it by more than 3px — that last one is what fails if a
media-query font size is ever reintroduced.

### Colour

Every tool carries its own hue, and it is the same hue everywhere that tool
appears: its cell on the landing grid, and its whole page — hairlines, panel
headers, drop guide, buttons, focus ring and caret. Colour is a way to know
where you are rather than decoration.

The mechanism is one custom property. `--line`, `--line-strong` and
`--accent-dim` are **mixed from `--accent`** rather than written out:

```css
--line: color-mix(in oklab, var(--accent) 34%, transparent);
```

So a subtree recolours its entire grid by redeclaring a single property.
`.tint-01` … `.tint-10` set that property; `toolTint()` in the registry hands
out the class, keyed off the ordinal so adding a tool picks up a colour without
anyone choosing one.

One trap worth knowing about, because it looks like a bug in the browser: a
custom property that references another is substituted **on the element that
declares it**. `:root`'s `--line` keeps `:root`'s violet no matter what a
descendant sets `--accent` to. That is why `.tint` redeclares all three
derivatives rather than relying on inheritance.

Violet is the primary — the header, status rail, landing hero, footer and every
page that is not a tool take it — and it is also `.tint-01`, so the primary is a
member of the set rather than an exception to it. The other nine sweep the wheel
from there: magenta, red, orange, yellow, green, teal, cyan, blue, indigo.

**Lightness and chroma are identical across all ten and only the hue angle
moves.** That is the whole trick, and it is why the palette is written in OKLCH
rather than hex:

```css
.tint-01 { --accent: oklch(0.723 0.155 296.5); } /* violet */
.tint-05 { --accent: oklch(0.723 0.155 90); }    /* yellow */
```

Pick a rainbow by eye and amber leaps off the screen while indigo sinks into it,
so the set reads as noise. Holding L and C fixed makes ten colours read as one
system, and means every one clears contrast *by construction* rather than by
luck — measured, they land in a 7.4:1 to 8.8:1 band on the panel fill, against a
4.5:1 requirement.

The consequence worth expecting: yellow at this lightness is gold, not lemon.
Yellow is intrinsically light, so holding it to violet's lightness darkens it.
That is the palette being correct rather than the value being wrong.

OKLCH needs no fallback here — `color-mix()` is already load-bearing above, and
its browser support is narrower.

### The hairline grid

`.cells` is the core device, and it does one thing worth knowing about: the
rules between cells are **shared, not doubled**. Giving each child a border
produces 2px rules wherever two children meet. Instead the grid's own background
shows through a 1px gap:

```css
.cells { display: grid; gap: 1px; background: var(--line); }
.cells > * { background: var(--panel); }
```

Every rule is exactly one pixel however the tracks wrap, which is what makes the
grid read as drawn rather than assembled.

Panels are translucent violet rather than opaque, so the drifting backdrop reads
through them and a panel on a panel is depth instead of a flat block.

### The backdrop

Violet light pooling on true `#000000`. True black rather than near-black
because OLED panels switch those pixels off entirely — deeper look, less
battery.

**It is CSS gradients, not WebGL or canvas, and that is a deliberate
constraint.** The real work here is canvas and WASM image encoding; a shader
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

### Type

Two faces. JetBrains Mono carries everything — interface, body copy, labels,
numbers — because a grid drawn in hairlines wants type that sits on the same
grid, and a tool reporting dimensions and byte counts is better served by
figures of equal width. It is chosen over the obvious terminal faces for one
reason: it was drawn for long reading at small sizes, and the tool pages carry
real instructional copy.

Pixelify Sans does the display work, confined to `h1` and `.headline`.
**Ligatures are disabled on it**, and not for taste: its `fi` ligature renders
as a glyph that reads as a capital A, so "files" came out as "Ales" in the
headline until it was switched off.

### The typed headline

The hero headline types itself on, and `TypeOn` is a **server** component — the
whole effect is one CSS rule plus an `animation-delay` stamped on each character
at render. Three properties are worth keeping if it is ever rewritten, because
the obvious client-side version loses all three:

- **The sentence ships in the HTML.** A component that starts empty and appends
  characters serves an empty `<h1>` to crawlers, on a site whose only revenue
  channel is organic search.
- **Characters reveal with opacity, never by growing a box.** The final layout
  is settled from the first frame, so `text-wrap: balance` does not resettle and
  the hero contributes no layout shift.
- **The base state is the visible one.** The animation's `from` is the hidden
  state, held by `backwards` fill, so if the animation never runs the headline is
  simply there. Starting at `opacity: 0` would mean any failure hides the
  headline permanently.

The cadence is the part worth reading the code for. A fixed interval per
character does not read as typing — it reads as a progress bar made of letters.
So the schedule gives every keystroke a jittered gap, a beat at the end of each
word and a longer one at punctuation, all derived from a hash of the stroke
index rather than `Math.random`, because a server render must produce identical
markup every time.

The caret follows from that. Each character lights its own for exactly the gap
until the next arrives — `--caret-lit`, stamped inline beside the delay — so the
caret holds through the between-word beats instead of blinking out in them. It
waits, blinking, before the first keystroke, and it **stays** at the end of the
line: a prompt does not tidy itself away, and the line looks unfinished without
one. `steps(1, end)` means two style changes a second and no interpolation, so
leaving it running costs nothing worth measuring.

Its width is a single token, `--caret-w`, shared by all three carets — the
travelling one and the two blinking ones — so they cannot drift apart, and the
negative margin that cancels the caret's advance width is derived from it rather
than written out beside it. Width only: the height stays a full `0.72em` so the
caret spans the line the way a text cursor does, and the width is set to roughly
the stroke width of Pixelify Sans at headline size, which is what makes it read
as part of the type rather than a block beside it.

Characters are hidden from the accessibility tree and the `<h1>` is labelled
with the same constant it types, since screen readers announce text split across
spans erratically. `e2e/hero.spec.ts` asserts on the accessible name, on the raw
HTML, and on the caret windows tiling the run with no gaps — never on the
animation itself.

Largest Contentful Paint is unaffected: the `<h1>` is the LCP element and Chrome
times it from the block's paint, not from the per-character opacity, so it still
lands at ~270ms.

### Where it deliberately breaks with the reference

| Reference | Here | Why |
|---|---|---|
| Monochrome near-black | Violet OLED field | The backdrop predates the reskin and is the product's own identity |
| Compact hit targets | 44px minimum | Anything smaller is unusable with a thumb, and this is used on phones |
| Ten sections of one page | One page per tool | A section index would be inventing navigation that does not exist |
| Prose set to full width | `52rem` page measure | Monospace runs wider per character; unbounded lines are unreadable |
| Full-width working area | `64rem` on tool pages | A three-field form stretched across 1400px is a worse form, however well it fills the grid |

There are three page measures, and which one a page takes is a content
decision rather than a layout one: `.shell` (90rem) for the landing grid, where
more cells per row is strictly better; `.shell-narrow` (64rem) for tool pages;
and `.shell-prose` (52rem) for the pages that are mostly text. The measure sits
on the container rather than on individual paragraphs — a page where some
paragraphs wrap at 62ch and others run the full width reads as broken, not as
varied.

Disabled controls change colour rather than fading. Opacity drags the muted text
below 4.5:1 wherever it is applied, and that is the exact threshold the colour
was picked to clear — a contrast failure that appears only in the one state
nobody screenshots.
