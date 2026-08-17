"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser-side Supabase client.
 *
 * Returns null when the environment is not configured rather than throwing.
 * The tools are pure client-side computation and work perfectly well without a
 * backend — auth and telemetry are enhancements, not prerequisites, and a
 * missing key should never take the site down.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

let cached: SupabaseClient | null = null;

export function createClient(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  if (!cached) cached = createBrowserClient(url, anonKey);
  return cached;
}
