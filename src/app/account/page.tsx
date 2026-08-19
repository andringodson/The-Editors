import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { formatBytes } from "@/lib/image/compress";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  if (!isSupabaseConfigured) redirect("/");

  const supabase = await createClient();
  if (!supabase) redirect("/");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: runs } = await supabase
    .from("tool_runs")
    .select("tool_id, input_bytes, output_bytes, duration_ms, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="shell-prose bleed py-[var(--space-l)]">
      <div className="eyebrow">
        <span>
          Account <span className="sep">/</span> optional
        </span>
        <span>
          Telemetry <span className="sep">/</span> no filenames
        </span>
      </div>
      <h1 className="headline-sm">Account</h1>
      <p className="mt-2 text-muted">{user.email}</p>

      <h2 className="mt-10 text-sm font-medium tracking-wide text-muted uppercase">
        Recent activity
      </h2>

      {runs && runs.length > 0 ? (
        <ul className="mt-4 divide-y divide-border panel bg-panel">
          {runs.map((run, index) => (
            <li
              key={index}
              className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
            >
              <span className="font-medium">{run.tool_id}</span>
              <span className="text-muted tabular-nums">
                {run.input_bytes ? formatBytes(run.input_bytes) : "—"}
                {run.output_bytes ? ` → ${formatBytes(run.output_bytes)}` : ""}
                {run.duration_ms ? ` · ${run.duration_ms} ms` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-muted">
          Nothing yet. Runs appear here once you use a tool while signed in.
        </p>
      )}

      <form action="/auth/signout" method="post" className="mt-10">
        <button type="submit" className="btn text-sm hover:text-danger">
          Sign out
        </button>
      </form>
    </div>
  );
}
