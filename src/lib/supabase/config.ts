/**
 * Shared configuration flag, importable from both server and client components.
 *
 * Lives apart from client.ts so Server Components can read it without pulling
 * in a "use client" module.
 */
export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
