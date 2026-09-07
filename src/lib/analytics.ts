"use client";

import { isSupabaseConfigured } from "./supabase/config";

/**
 * Anonymous usage telemetry.
 *
 * Records that a tool ran and how it performed — never what was processed.
 * Files are handled entirely on-device; only sizes and timings reach the
 * network, and only if Supabase is configured.
 *
 * Events are batched rather than sent individually. Telemetry is the one part
 * of this product whose cost scales with traffic, so a busy session produces a
 * handful of requests instead of one per action. Nothing here may ever block
 * the UI or surface an error: every failure is swallowed and the batch dropped.
 *
 * The Supabase client is imported **dynamically**, and that is the load-bearing
 * detail rather than a style choice. Every tool page calls `trackRun`, so a
 * static import put 245 KB of auth and Postgrest client into all of them — to
 * report byte counts, on a deployment where telemetry may not even be switched
 * on. Now nothing is fetched until the first batch actually flushes, and a
 * deployment without Supabase configured never fetches it at all. The
 * configuration flag comes from `config.ts` precisely because reading it must
 * not pull the client in.
 */

export interface ToolRunEvent {
  toolId: string;
  inputBytes?: number;
  outputBytes?: number;
  targetBytes?: number;
  durationMs?: number;
  succeeded?: boolean;
  errorCode?: string;
}

interface QueuedRow {
  tool_id: string;
  input_bytes: number | null;
  output_bytes: number | null;
  target_bytes: number | null;
  duration_ms: number | null;
  succeeded: boolean;
  error_code: string | null;
}

const FLUSH_AFTER_MS = 4000;
const FLUSH_AT_COUNT = 8;
/** Cap the buffer so a pathological session cannot grow it without bound. */
const MAX_QUEUE = 50;

let queue: QueuedRow[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let listenersAttached = false;

function toRow(event: ToolRunEvent): QueuedRow {
  return {
    tool_id: event.toolId,
    input_bytes: event.inputBytes ?? null,
    output_bytes: event.outputBytes ?? null,
    target_bytes: event.targetBytes ?? null,
    duration_ms: event.durationMs ?? null,
    succeeded: event.succeeded ?? true,
    error_code: event.errorCode ?? null,
  };
}

async function flush(): Promise<void> {
  if (queue.length === 0) return;

  const batch = queue;
  queue = [];

  try {
    const { createClient } = await import("./supabase/client");
    const supabase = createClient();
    if (!supabase) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase
      .from("tool_runs")
      .insert(batch.map((row) => ({ ...row, user_id: user?.id ?? null })));
  } catch {
    // Dropped deliberately — see the note above. Re-queuing risks an unbounded
    // retry loop against an endpoint that is already unhappy.
  }
}

/**
 * Last-chance flush when the page goes away.
 *
 * `pagehide` is the only event that fires reliably on mobile Safari, and the
 * request must outlive the document — hence `keepalive` against the REST
 * endpoint directly, since supabase-js does not expose that option.
 */
function flushOnExit(): void {
  if (queue.length === 0) return;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return;

  const batch = queue;
  queue = [];

  try {
    void fetch(`${url}/rest/v1/tool_runs`, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Prefer: "return=minimal",
      },
      // Anonymous on this path: the user's access token is not readable
      // synchronously, and an exit flush cannot await one.
      body: JSON.stringify(batch.map((row) => ({ ...row, user_id: null }))),
    });
  } catch {
    // Nothing useful to do while the page is unloading.
  }
}

function ensureListeners(): void {
  if (listenersAttached || typeof window === "undefined") return;
  listenersAttached = true;

  window.addEventListener("pagehide", flushOnExit);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushOnExit();
  });
}

function schedule(): void {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void flush();
  }, FLUSH_AFTER_MS);
}

export function recordToolRun(event: ToolRunEvent): void {
  if (!isSupabaseConfigured) return;

  ensureListeners();

  if (queue.length >= MAX_QUEUE) return;
  queue.push(toRow(event));

  if (queue.length >= FLUSH_AT_COUNT) {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    void flush();
    return;
  }

  schedule();
}

/** Wrap an async operation so its timing and outcome are recorded either way. */
export async function trackRun<T>(
  toolId: string,
  meta: Omit<ToolRunEvent, "toolId" | "durationMs" | "succeeded" | "errorCode">,
  run: () => Promise<T>,
): Promise<T> {
  const started = performance.now();
  try {
    const result = await run();
    recordToolRun({
      ...meta,
      toolId,
      durationMs: Math.round(performance.now() - started),
      succeeded: true,
    });
    return result;
  } catch (error) {
    recordToolRun({
      ...meta,
      toolId,
      durationMs: Math.round(performance.now() - started),
      succeeded: false,
      errorCode: error instanceof Error ? error.name : "UnknownError",
    });
    throw error;
  }
}
