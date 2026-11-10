-- Roles locales que imitan a Supabase (solo para esta instancia desechable).
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role sb_owner login bypassrls createrole createdb;   -- imita a `postgres` de Supabase: no es superusuario, omite RLS
create database fixture owner sb_owner;
