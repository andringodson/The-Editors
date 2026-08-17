"use client";

import { createClient } from "./supabase/client";

/**
 * Anonymous usage telemetry.
 *
 * Records that a tool ran and how it performed — never what was processed.
 * Files are handled entirely on-device; only sizes and timings reach the
 * network, and only if Supabase is configured.
 *
 * Every failure here is swallowed. Telemetry must never break a user's actual
 * work, and it must never block the UI, so calls are fire-and-forget.
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

export function recordToolRun(event: ToolRunEvent): void {
  const supabase = createClient();
  if (!supabase) return;

  void (async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      await supabase.from("tool_runs").insert({
        user_id: user?.id ?? null,
        tool_id: event.toolId,
        input_bytes: event.inputBytes ?? null,
        output_bytes: event.outputBytes ?? null,
        target_bytes: event.targetBytes ?? null,
        duration_ms: event.durationMs ?? null,
        succeeded: event.succeeded ?? true,
        error_code: event.errorCode ?? null,
      });
    } catch {
      // Intentionally silent — see the note above.
    }
  })();
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
