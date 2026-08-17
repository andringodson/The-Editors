import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * LibreOffice-backed document conversion.
 *
 * Two things about `soffice` drive this design:
 *
 * 1. It keeps a per-user profile directory and *refuses to run concurrently*
 *    against the same one — the second invocation silently attaches to the
 *    first instance and returns without converting. Every call therefore gets
 *    its own throwaway profile via `-env:UserInstallation`.
 *
 * 2. It can hang indefinitely on a malformed document. Without a hard timeout
 *    and kill, one bad upload occupies a worker forever.
 */

export const SUPPORTED_EXTENSIONS = [
  "ppt", "pptx", "odp",
  "doc", "docx", "odt", "rtf",
  "xls", "xlsx", "ods", "csv",
] as const;

export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const CONVERSION_TIMEOUT_MS = 120_000;

export class ConversionError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "ConversionError";
  }
}

export function extensionOf(filename: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(filename);
  return match ? match[1].toLowerCase() : "";
}

export function isSupported(filename: string): boolean {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(
    extensionOf(filename),
  );
}

/**
 * Convert a document to PDF and return the bytes.
 *
 * The input never touches a shared location: it is written into a private temp
 * directory that is removed in `finally`, whatever happens.
 */
export async function convertToPdf(
  input: Buffer,
  filename: string,
): Promise<Buffer> {
  const extension = extensionOf(filename);

  if (!isSupported(filename)) {
    throw new ConversionError(
      `Cannot convert .${extension || "unknown"} files`,
      415,
    );
  }

  if (input.byteLength > MAX_UPLOAD_BYTES) {
    throw new ConversionError("File is larger than 50 MB", 413);
  }

  const workDir = await mkdtemp(join(tmpdir(), "convert-"));
  const profileDir = join(workDir, `profile-${randomUUID()}`);
  const sourcePath = join(workDir, `source.${extension}`);

  try {
    await writeFile(sourcePath, input);

    await run(
      "soffice",
      [
        `-env:UserInstallation=file://${profileDir}`,
        "--headless",
        "--norestore",
        "--invisible",
        "--nolockcheck",
        "--nodefault",
        "--convert-to",
        "pdf",
        "--outdir",
        workDir,
        sourcePath,
      ],
      {
        timeout: CONVERSION_TIMEOUT_MS,
        killSignal: "SIGKILL",
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    // soffice reports success on stdout even when it produced nothing, so the
    // output file's existence is the only trustworthy signal.
    const produced = (await readdir(workDir)).find((name) =>
      name.endsWith(".pdf"),
    );

    if (!produced) {
      throw new ConversionError(
        "The document could not be converted — it may be corrupt or password-protected",
        422,
      );
    }

    return await readFile(join(workDir, produced));
  } catch (cause) {
    if (cause instanceof ConversionError) throw cause;

    const message =
      cause instanceof Error && "killed" in cause && cause.killed
        ? "Conversion timed out"
        : "Conversion failed";
    throw new ConversionError(message, 422);
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {
      // Best effort; the container's temp space is ephemeral anyway.
    });
  }
}
