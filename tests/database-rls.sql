begin;
create temporary table audit_portfolio_synthetic(user_id uuid primary key, data jsonb not null,
  constraint schema_check check ((jsonb_typeof(data)='object' and data->>'schemaVersion'='position-v3') is true));
alter table audit_portfolio_synthetic enable row level security;
create policy owner_only on audit_portfolio_synthetic for all to authenticated
  using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
revoke all on audit_portfolio_synthetic from anon, authenticated;
grant select,insert,update,delete on audit_portfolio_synthetic to authenticated;
do $$ declare candidate jsonb; begin
  foreach candidate in array array['{}'::jsonb,'null'::jsonb,'[]'::jsonb,'{"schemaVersion":null}'::jsonb,'{"schemaVersion":"other"}'::jsonb] loop
    begin
      insert into audit_portfolio_synthetic values('00000000-0000-0000-0000-000000000001',candidate);
      raise exception 'Invalid schema was accepted';
    exception when check_violation then null; end;
  end loop;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
insert into audit_portfolio_synthetic values('00000000-0000-0000-0000-000000000001','{"schemaVersion":"position-v3","stocks":[],"crypto":[]}');
do $$ begin
  begin
    insert into audit_portfolio_synthetic values('00000000-0000-0000-0000-000000000002','{"schemaVersion":"position-v3"}');
    raise exception 'Cross-owner insert was accepted';
  exception when insufficient_privilege then null; end;
  begin truncate audit_portfolio_synthetic;raise exception 'Truncate accepted';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
do $$ begin
  if exists(select 1 from audit_portfolio_synthetic) then raise exception 'Cross-owner select visible';end if;
  update audit_portfolio_synthetic set data='{"schemaVersion":"position-v3"}';
  if found then raise exception 'Cross-owner update accepted';end if;
  delete from audit_portfolio_synthetic;
  if found then raise exception 'Cross-owner delete accepted';end if;
end $$;
insert into audit_portfolio_synthetic values('00000000-0000-0000-0000-000000000002','{"schemaVersion":"position-v3"}');
do $$ begin
  if (select count(*) from audit_portfolio_synthetic)<>1 then raise exception 'Own select failed';end if;
  begin update audit_portfolio_synthetic set user_id='00000000-0000-0000-0000-000000000003';raise exception 'Reassignment accepted';exception when insufficient_privilege then null;end;
  update audit_portfolio_synthetic set data='{"schemaVersion":"position-v3","test":true}';
  if not found then raise exception 'Own update failed';end if;
  delete from audit_portfolio_synthetic;if not found then raise exception 'Own delete failed';end if;
end $$;
reset role;
set local role anon;
do $$ begin begin perform * from audit_portfolio_synthetic;raise exception 'Anon select accepted';exception when insufficient_privilege then null;end;end $$;
reset role;
rollback;
select 'PASS: schema, two synthetic identities, own CRUD, cross-owner denial, anon denial, truncate denial; all test objects rolled back' as result;
