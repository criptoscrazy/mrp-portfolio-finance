-- Run once in Supabase SQL Editor immediately before publishing V3.
-- V2 remains untouched as a rollback source. Old app versions cannot write here.

begin;

create table if not exists public.portfolio_data_v3 (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  constraint portfolio_data_v3_schema_check
    check (data ->> 'schemaVersion' = 'position-v3')
);

alter table public.portfolio_data_v3 enable row level security;

revoke all on table public.portfolio_data_v3 from anon;
grant select, insert, update, delete on table public.portfolio_data_v3 to authenticated;

drop policy if exists "Users manage only their own portfolio V3" on public.portfolio_data_v3;
create policy "Users manage only their own portfolio V3"
  on public.portfolio_data_v3
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

commit;
