// An in-memory PostgreSQL engine: no Supabase credentials, records or network.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
(async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create schema auth;grant usage on schema auth to anon,authenticated;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table auth.users(id uuid primary key);
    create table public.portfolio_data(user_id uuid primary key references auth.users(id),data jsonb not null);
    alter table public.portfolio_data enable row level security;
    create policy owner_only on public.portfolio_data for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
    grant all on public.portfolio_data to anon,authenticated;
    alter default privileges for role postgres in schema public grant all on tables to anon,authenticated;`);
  await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/position-v3.sql'),'utf8'));
  await db.exec('grant all on public.portfolio_data_v3 to authenticated;');
  const migration=fs.readFileSync(path.join(__dirname,'../supabase/audit-hardening.sql'),'utf8');
  await db.exec(migration);await db.exec(migration); // Safe to retry.
  const {rows}=await db.query(`select c.relname,r.role,has_table_privilege(r.role,c.oid,'SELECT') as can_select,
    has_table_privilege(r.role,c.oid,'INSERT') as can_insert,has_table_privilege(r.role,c.oid,'UPDATE') as can_update,
    has_table_privilege(r.role,c.oid,'DELETE') as can_delete,has_table_privilege(r.role,c.oid,'TRUNCATE') as can_truncate,
    has_table_privilege(r.role,c.oid,'TRIGGER') as can_trigger,has_table_privilege(r.role,c.oid,'REFERENCES') as can_reference
    from pg_class c cross join(values('anon'),('authenticated')) r(role) where c.oid in ('public.portfolio_data'::regclass,'public.portfolio_data_v3'::regclass)`);
  for(const row of rows){assert.equal(row.can_select,row.role==='authenticated');assert.equal(row.can_insert,row.role==='authenticated');assert.equal(row.can_update,row.role==='authenticated');assert.equal(row.can_delete,row.role==='authenticated');assert.equal(row.can_truncate,false);assert.equal(row.can_trigger,false);assert.equal(row.can_reference,false);}
  const {rows:constraints}=await db.query("select convalidated from pg_constraint where conrelid='public.portfolio_data_v3'::regclass and conname='portfolio_data_v3_schema_check'");assert.equal(constraints[0].convalidated,true);
  await db.exec(fs.readFileSync(path.join(__dirname,'database-rls.sql'),'utf8'));
  console.log('OK Base de datos: migración idempotente, privilegios mínimos, cinco esquemas inválidos rechazados, dos identidades sintéticas y RLS; PostgreSQL local en memoria.');
 }finally{await db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
