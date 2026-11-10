-- Esquema `auth`, extensiones y privilegios por defecto como en el entorno REAL (etapa 0). Se ejecuta como supabase_admin en la base `fixture`,
-- ANTES de 01_fixture.sql (que corre como postgres).
--
-- Observado en la etapa 0: el esquema auth es de supabase_admin; auth.uid() es de supabase_auth_admin, STABLE, no SECURITY DEFINER, con la definición
-- de abajo (el claim suelto `request.jwt.claim.sub` se lee con nullif ANTES que `request.jwt.claims`).
-- Extensiones reales: pg_stat_statements, pgcrypto, plpgsql, supabase_vault, uuid-ossp. supabase_vault NO se reproduce (no es una extensión de contrib).
create schema auth authorization supabase_admin;
grant usage on schema auth to anon, authenticated, service_role;
-- Las claves foráneas hacia auth.users (user_id references auth.users) las comprueba el PROPIETARIO de auth.users (supabase_auth_admin):
-- necesita USAGE en el esquema auth. Sin esto toda inserción en las tablas de la Fase 3 falla con «permiso denegado al esquema auth».
grant usage, create on schema auth to supabase_auth_admin;

create schema extensions authorization supabase_admin;
grant usage on schema extensions to anon, authenticated, service_role;
create extension pgcrypto schema extensions;
create extension "uuid-ossp" schema extensions;
create extension pg_stat_statements schema extensions;

create table auth.users (id uuid primary key default gen_random_uuid(), email text);
alter table auth.users owner to supabase_auth_admin;
grant all on auth.users to postgres;               -- el propietario de public referencia auth.users (claves foráneas)
grant select on auth.users to authenticated;

create or replace function auth.uid() returns uuid language sql stable as $function$
  select
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$function$;
alter function auth.uid() owner to supabase_auth_admin;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Privilegios por defecto observados (consulta 0.4): los objetos nuevos en public reciben todo para postgres, anon, authenticated y service_role.
alter default privileges for role supabase_admin in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges for role supabase_admin in schema public grant all on sequences to postgres, anon, authenticated, service_role;
alter default privileges for role supabase_admin in schema public grant all on functions to postgres, anon, authenticated, service_role;
