-- Family Finance: shared copy for sync.
-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Then edit the INSERT at the bottom so it lists the email addresses allowed to sync.

create table if not exists public.allowed_emails (
  email text primary key
);

create table if not exists public.family_snapshot (
  id          text primary key,
  data        jsonb not null,
  version     bigint not null default 1,
  updated_at  timestamptz not null default now(),
  updated_by  text
);

alter table public.allowed_emails enable row level security;   -- no policies: invisible to the app
alter table public.family_snapshot enable row level security;

-- True only for a signed-in person whose email is on the list.
create or replace function public.is_family()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.allowed_emails
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- Reading is allowed for listed people. There is no direct insert/update policy:
-- all writes go through push_snapshot below, which checks the version first.
drop policy if exists "family can read snapshot" on public.family_snapshot;
create policy "family can read snapshot"
  on public.family_snapshot for select
  to authenticated
  using (public.is_family());

-- Compare-and-set write. Returns the new version, or -1 if someone else saved first.
create or replace function public.push_snapshot(new_data jsonb, expected_version bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  result bigint;
begin
  if not public.is_family() then
    raise exception 'Not allowed';
  end if;
  if jsonb_typeof(new_data) <> 'object' or new_data ->> 'schemaVersion' <> '1' then
    raise exception 'Unexpected data format';
  end if;

  if expected_version = 0 then
    insert into public.family_snapshot (id, data, version, updated_by)
    values ('main', new_data, 1, auth.jwt() ->> 'email')
    on conflict (id) do nothing
    returning version into result;
    return coalesce(result, -1);
  end if;

  update public.family_snapshot
     set data = new_data,
         version = version + 1,
         updated_at = now(),
         updated_by = auth.jwt() ->> 'email'
   where id = 'main' and version = expected_version
  returning version into result;
  return coalesce(result, -1);
end;
$$;

revoke all on function public.push_snapshot(jsonb, bigint) from public, anon;
grant execute on function public.push_snapshot(jsonb, bigint) to authenticated;
revoke all on function public.is_family() from public, anon;
grant execute on function public.is_family() to authenticated;

-- EDIT THIS: the emails of the people who may sync (use the address they will sign in with).
insert into public.allowed_emails (email) values
  ('rekhanthms23@gmail.com')
on conflict do nothing;
