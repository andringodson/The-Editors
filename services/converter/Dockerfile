# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Build stage — compile TypeScript, then prune to production dependencies.
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ---------------------------------------------------------------------------
# Runtime stage — Node plus a minimal LibreOffice.
#
# Only the filter packages actually needed are installed. A full `libreoffice`
# install pulls in Base, Draw, Math and a JRE for roughly triple the image size,
# which directly slows cold starts on a scale-to-zero platform.
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
      libreoffice-core \
      libreoffice-writer \
      libreoffice-calc \
      libreoffice-impress \
      fonts-liberation \
      fonts-dejavu-core \
      fonts-noto-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

# Run unprivileged. `node` (uid 1000) ships with the base image.
RUN mkdir -p /tmp/convert && chown -R node:node /tmp/convert /app
USER node

ENV NODE_ENV=production \
    PORT=8080 \
    HOME=/tmp

EXPOSE 8080

# Warm LibreOffice's first-run profile creation at build time rather than
# making the first user pay for it — it costs several seconds otherwise.
RUN soffice --headless --terminate_after_init >/dev/null 2>&1 || true

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:8080/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
