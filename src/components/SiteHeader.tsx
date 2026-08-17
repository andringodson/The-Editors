import Link from "next/link";
import { getCurrentUser } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function SiteHeader() {
  const user = isSupabaseConfigured ? await getCurrentUser() : null;

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3.5">
        <Link href="/" className="font-semibold tracking-tight">
          The Editors
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/tools/compress"
            className="rounded-md px-2.5 py-1.5 text-muted transition-colors hover:bg-accent-subtle hover:text-foreground"
          >
            Compress
          </Link>
          <Link
            href="/tools/passport"
            className="rounded-md px-2.5 py-1.5 text-muted transition-colors hover:bg-accent-subtle hover:text-foreground"
          >
            Passport
          </Link>
          <Link
            href="/tools/pdf-merge"
            className="rounded-md px-2.5 py-1.5 text-muted transition-colors hover:bg-accent-subtle hover:text-foreground"
          >
            PDF
          </Link>

          {isSupabaseConfigured ? (
            user ? (
              <Link
                href="/account"
                className="ml-2 rounded-md border border-border px-3 py-1.5 transition-colors hover:border-accent"
              >
                Account
              </Link>
            ) : (
              <Link
                href="/login"
                className="ml-2 rounded-md bg-accent px-3 py-1.5 font-medium text-accent-foreground transition-opacity hover:opacity-90"
              >
                Sign in
              </Link>
            )
          ) : null}
        </nav>
      </div>
    </header>
  );
}
