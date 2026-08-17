-- The Editors — database schema
--
-- Processing happens entirely in the browser, so this database never sees a
-- user's files. It stores two things: who someone is, and anonymous facts about
-- which tools work well. Keep it that way — if a column would ever hold file
-- content or a filename, it does not belong here.

-- ---------------------------------------------------------------------------
-- Profiles: one row per auth user, created automatically on signup.
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  email       text,
  display_name text,
  plan        text not null default 'free' check (plan in ('free', 'pro')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are readable by their owner"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Profiles are updatable by their owner"
  on public.profiles for update
  using (auth.uid() = id);

-- Mirror new auth users into profiles. Runs as definer so it can write to a
-- table the anon role cannot touch.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Column-level write restriction.
--
-- The update policy above lets users edit their own row, and RLS cannot
-- restrict individual columns — so a user could otherwise rewrite any field in
-- their profile. Column grants do what RLS can't: display_name is the only
-- thing a user may change.
-- ---------------------------------------------------------------------------

revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Tool runs: anonymous telemetry driving what we build next.
--
-- Deliberately absent: filenames, file contents, IP addresses. Sizes and
-- durations are enough to answer "which tools are slow, which fail, and which
-- targets do people actually ask for".
-- ---------------------------------------------------------------------------

create table if not exists public.tool_runs (
  id             bigint generated always as identity primary key,
  user_id        uuid references auth.users on delete set null,
  tool_id        text not null,
  input_bytes    bigint,
  output_bytes   bigint,
  -- For compress: what the user asked for, so we can measure how often we hit it.
  target_bytes   bigint,
  duration_ms    integer,
  succeeded      boolean not null default true,
  error_code     text,
  created_at     timestamptz not null default now()
);

create index if not exists tool_runs_tool_id_created_at_idx
  on public.tool_runs (tool_id, created_at desc);

create index if not exists tool_runs_user_id_idx
  on public.tool_runs (user_id)
  where user_id is not null;

alter table public.tool_runs enable row level security;

-- Anyone may contribute a data point, signed in or not. Nobody may read the
-- table back through the API; analysis happens with the service role.
create policy "Anyone can record a tool run"
  on public.tool_runs for insert
  with check (
    user_id is null or auth.uid() = user_id
  );

create policy "Users can read their own runs"
  on public.tool_runs for select
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Operational view: the numbers to watch when traffic climbs.
-- ---------------------------------------------------------------------------

create or replace view public.tool_health as
select
  tool_id,
  date_trunc('hour', created_at) as hour,
  count(*)                                        as runs,
  count(*) filter (where not succeeded)           as failures,
  round(avg(duration_ms))                         as avg_duration_ms,
  percentile_cont(0.95) within group (order by duration_ms) as p95_duration_ms,
  round(avg(output_bytes::numeric / nullif(input_bytes, 0)), 3) as avg_size_ratio
from public.tool_runs
group by tool_id, date_trunc('hour', created_at);
