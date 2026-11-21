-- ============================================================================
-- ASISTENTE v1 · verificación (solo lectura)
-- Para correr ANTES (esperado: false/0) y DESPUÉS de aplicar (esperado: los valores indicados).
-- ============================================================================
select
  to_regclass('public.asistente_memoria') is not null                                              as memoria,           -- true
  to_regclass('public.asistente_uso') is not null                                                  as uso,               -- true
  (select count(*) from pg_class where oid in (to_regclass('public.asistente_memoria'), to_regclass('public.asistente_uso')) and relrowsecurity) as con_rls, -- 2
  (select count(*) from pg_policies where schemaname = 'public' and tablename like 'asistente\_%') as politicas,         -- 3
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in ('asistente_gasto_mes', 'asistente_memoria_limite')) as funciones,      -- 2
  (select count(*) from pg_trigger where tgname = 'asistente_memoria_limite')                      as disparador,        -- 1
  (select count(*) from pg_tables where schemaname = 'public')                                     as tablas_public,     -- baseline + 2
  (select count(*) from pg_policies where schemaname = 'public')                                   as politicas_public;  -- baseline + 3

-- Permisos de tablas para anon y authenticated. Esperado: authenticated con SELECT/INSERT/DELETE (+ UPDATE de la columna texto) en memoria;
-- SELECT/INSERT en uso; anon sin nada.
select table_name, grantee, privilege_type from information_schema.role_table_grants
 where table_schema = 'public' and table_name like 'asistente\_%' and grantee in ('anon', 'authenticated') order by 1, 2, 3;

-- Quién ejecuta asistente_gasto_mes: authenticated sí, anon no.
select p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') as anon, has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'asistente_gasto_mes';
