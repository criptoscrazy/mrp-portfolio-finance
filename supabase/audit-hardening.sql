-- H08/H09. No portfolio rows are changed. Apply atomically after the synthetic tests.
begin;
revoke all on table public.portfolio_data, public.portfolio_data_v3 from anon, authenticated;
grant select, insert, update, delete on table public.portfolio_data, public.portfolio_data_v3 to authenticated;
-- New application tables must receive explicit grants together with their RLS policies.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter table public.portfolio_data_v3 drop constraint if exists portfolio_data_v3_schema_check;
alter table public.portfolio_data_v3 add constraint portfolio_data_v3_schema_check
  check ((jsonb_typeof(data) = 'object' and data ->> 'schemaVersion' = 'position-v3') is true) not valid;
-- Validate on the server without downloading or rewriting any financial record.
-- An invalid historical payload aborts this transaction; never repair it silently.
alter table public.portfolio_data_v3 validate constraint portfolio_data_v3_schema_check;
commit;
