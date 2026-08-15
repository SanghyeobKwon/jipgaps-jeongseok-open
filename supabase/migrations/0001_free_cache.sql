-- 집값의 정석 Free-plan cache. The browser must not access these tables directly.
create table if not exists public.api_cache_entries (
  namespace text not null check (namespace ~ '^[a-z0-9][a-z0-9._:-]{0,79}$'),
  cache_key text not null check (char_length(cache_key) between 1 and 240),
  payload jsonb not null,
  data_status text not null default 'ok' check (data_status in ('ok', 'partial', 'empty')),
  captured_at timestamptz not null,
  fresh_until timestamptz not null,
  stale_until timestamptz not null,
  size_bytes integer not null check (size_bytes between 0 and 5242880),
  updated_at timestamptz not null default now(),
  primary key (namespace, cache_key),
  check (fresh_until >= captured_at),
  check (stale_until >= fresh_until)
);

create index if not exists api_cache_entries_stale_until_idx
  on public.api_cache_entries (stale_until);
create index if not exists api_cache_entries_namespace_fresh_idx
  on public.api_cache_entries (namespace, fresh_until desc);

create table if not exists public.sync_runs (
  id bigint generated always as identity primary key,
  namespace text not null check (namespace ~ '^[a-z0-9][a-z0-9._:-]{0,79}$'),
  cache_key text,
  status text not null check (status in ('running', 'success', 'partial', 'error')),
  requested_count integer not null default 0 check (requested_count >= 0),
  stored_count integer not null default 0 check (stored_count >= 0),
  rejected_count integer not null default 0 check (rejected_count >= 0),
  error_code text,
  details jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  check (finished_at is null or finished_at >= started_at)
);

create index if not exists sync_runs_namespace_started_idx
  on public.sync_runs (namespace, started_at desc);

alter table public.api_cache_entries enable row level security;
alter table public.sync_runs enable row level security;

-- No policies are intentionally created: anon/authenticated roles are denied.
revoke all on table public.api_cache_entries from anon, authenticated;
revoke all on table public.sync_runs from anon, authenticated;
revoke all on sequence public.sync_runs_id_seq from anon, authenticated;
grant all on table public.api_cache_entries to service_role;
grant all on table public.sync_runs to service_role;
grant usage, select on sequence public.sync_runs_id_seq to service_role;

create or replace function public.purge_expired_api_cache()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count bigint;
begin
  delete from public.api_cache_entries where stale_until < now();
  get diagnostics deleted_count = row_count;
  delete from public.sync_runs where started_at < now() - interval '30 days';
  return deleted_count;
end;
$$;

revoke all on function public.purge_expired_api_cache() from public, anon, authenticated;
grant execute on function public.purge_expired_api_cache() to service_role;

-- Optional only after pg_cron availability is confirmed for the project:
-- select cron.schedule('purge-expired-jipgaps-cache', '17 3 * * *',
--   $$select public.purge_expired_api_cache();$$);
