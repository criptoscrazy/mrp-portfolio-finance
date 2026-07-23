-- Run once in Supabase SQL Editor.
-- This RPC creates real database activity without reading portfolio_data.

create or replace function public.keepalive()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'ok', true,
    'checked_at', now()
  );
$$;

revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon;
grant execute on function public.keepalive() to authenticated;
