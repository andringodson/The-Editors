# Conversion service

LibreOffice in a container, exposed as a single `POST /convert` endpoint.

This exists because Office formats are the one thing a browser genuinely cannot
convert. Everything else in The Editors runs client-side; this service is
deliberately the only server, and deliberately small.

## Why it is not on Vercel

Vercel functions cannot run it: no LibreOffice binary, a 250 MB unzipped bundle
ceiling, and execution limits far below what a large deck needs. It wants a
container.

Deploy it anywhere that **scales to zero** — Google Cloud Run, Fly.io, Render.
Idle cost then rounds to nothing, which keeps the project's economics intact.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/convert` | multipart `file` + `x-convert-token` header → PDF bytes |
| `GET` | `/health` | liveness, current load, supported formats |

Accepts `ppt pptx odp doc docx odt rtf xls xlsx ods csv`, up to 50 MB.

## Configuration

| Variable | Required | Purpose |
|---|---|---|
| `CONVERT_SIGNING_SECRET` | yes | Shared with the web app. Without it the service refuses every request. |
| `ALLOWED_ORIGINS` | yes | Comma-separated origins allowed by CORS. Empty means no browser can call it. |
| `PORT` | no | Defaults to 8080. |

Generate the secret once and set it in both places:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## Why tokens rather than login

An open conversion endpoint is free CPU for whoever finds it. Requiring an
account would be worse for users — most people converting one deck will not sign
up — so the web app mints an HMAC token that expires in five minutes and this
service verifies it.

It proves the request came from our front end recently. It is **not** an
identity check and was never meant to be. If abuse becomes a real problem, the
next step is per-IP rate limiting at the edge, not a login wall.

## Running locally

```bash
npm install
npm run build
CONVERT_SIGNING_SECRET=dev-secret ALLOWED_ORIGINS=http://localhost:3000 npm start
```

Then point the web app at it with `NEXT_PUBLIC_CONVERTER_URL=http://localhost:8080`
and the same `CONVERT_SIGNING_SECRET`.

With Docker:

```bash
docker build -t editors-converter .
docker run -p 8080:8080 \
  -e CONVERT_SIGNING_SECRET=dev-secret \
  -e ALLOWED_ORIGINS=http://localhost:3000 \
  editors-converter
```

## Deploying to Cloud Run

```bash
gcloud run deploy editors-converter \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --concurrency 4 \
  --min-instances 0 \
  --set-env-vars "CONVERT_SIGNING_SECRET=...,ALLOWED_ORIGINS=https://your-app.vercel.app"
```

`--min-instances 0` is the point: no traffic, no bill. The trade is a cold start
of a few seconds on the first request, which is why the Dockerfile pre-warms
LibreOffice's profile at build time.

`--concurrency 4` should match the container's CPU count. LibreOffice is
CPU-bound at roughly one core per conversion, so overcommitting makes every
request slower without raising throughput.

## Notes on LibreOffice

Two behaviours shaped `src/convert.ts`:

- **It will not run concurrently against one user profile.** A second
  invocation silently attaches to the first instance and returns having
  converted nothing. Every call therefore gets a throwaway profile via
  `-env:UserInstallation`.
- **It can hang forever on a malformed document,** and reports success on
  stdout even when it produced no file. So there is a hard timeout with
  `SIGKILL`, and the output file's existence — not the exit code — is what
  counts as success.
