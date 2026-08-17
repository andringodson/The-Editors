import { cpus } from "node:os";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import {
  ConversionError,
  MAX_UPLOAD_BYTES,
  SUPPORTED_EXTENSIONS,
  convertToPdf,
} from "./convert.js";
import { verifyToken } from "./token.js";

const PORT = Number(process.env.PORT ?? 8080);
const SIGNING_SECRET = process.env.CONVERT_SIGNING_SECRET ?? "";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

/**
 * LibreOffice is CPU-bound and memory-hungry — roughly one core and a few
 * hundred MB per conversion. Running more at once than the box has cores makes
 * every request slower without increasing throughput, so admission is capped
 * and excess load is shed rather than queued indefinitely.
 */
const MAX_CONCURRENT = Math.max(1, Math.min(cpus().length, 4));
const MAX_QUEUE_WAIT_MS = 20_000;

let active = 0;
const waiting: Array<() => void> = [];

async function acquireSlot(): Promise<() => void> {
  if (active < MAX_CONCURRENT) {
    active++;
    return release;
  }

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      const index = waiting.indexOf(admit);
      if (index !== -1) waiting.splice(index, 1);
      reject(new ConversionError("Server is busy — try again shortly", 503));
    }, MAX_QUEUE_WAIT_MS);

    function admit() {
      clearTimeout(timer);
      resolve();
    }

    waiting.push(admit);
  });

  active++;
  return release;
}

function release(): void {
  active--;
  const next = waiting.shift();
  if (next) next();
}

const app = Fastify({
  logger: true,
  // Slightly above the conversion timeout so the handler, not the socket,
  // decides how a slow document ends.
  requestTimeout: 150_000,
});

await app.register(cors, {
  origin: ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : false,
  methods: ["POST", "OPTIONS"],
  allowedHeaders: ["content-type", "x-convert-token"],
});

await app.register(multipart, {
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

app.get("/health", async () => ({
  status: "ok",
  active,
  queued: waiting.length,
  capacity: MAX_CONCURRENT,
  formats: SUPPORTED_EXTENSIONS,
}));

app.post("/convert", async (request, reply) => {
  if (!SIGNING_SECRET) {
    request.log.error("CONVERT_SIGNING_SECRET is not set; refusing all requests");
    return reply.code(503).send({ error: "Converter is not configured" });
  }

  const token = request.headers["x-convert-token"];
  if (typeof token !== "string" || !verifyToken(token, SIGNING_SECRET)) {
    return reply.code(401).send({ error: "Missing or expired request token" });
  }

  const upload = await request.file();
  if (!upload) {
    return reply.code(400).send({ error: "No file supplied" });
  }

  let buffer: Buffer;
  try {
    buffer = await upload.toBuffer();
  } catch {
    return reply.code(413).send({ error: "File is larger than 50 MB" });
  }

  let releaseSlot: (() => void) | null = null;
  try {
    releaseSlot = await acquireSlot();
    const pdf = await convertToPdf(buffer, upload.filename);

    return reply
      .code(200)
      .header("content-type", "application/pdf")
      .header(
        "content-disposition",
        `attachment; filename="${upload.filename.replace(/\.[^.]+$/, "")}.pdf"`,
      )
      .send(pdf);
  } catch (cause) {
    if (cause instanceof ConversionError) {
      return reply.code(cause.statusCode).send({ error: cause.message });
    }
    request.log.error({ err: cause }, "Unexpected conversion failure");
    return reply.code(500).send({ error: "Conversion failed" });
  } finally {
    releaseSlot?.();
  }
});

// Cloud Run and Fly both send SIGTERM before reclaiming an instance; draining
// lets in-flight conversions finish instead of returning a truncated PDF.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    app.log.info(`${signal} received, draining`);
    void app.close().then(() => process.exit(0));
  });
}

await app.listen({ port: PORT, host: "0.0.0.0" });
