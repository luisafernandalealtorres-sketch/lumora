-- ============================================================================
-- GOOGLE v1 · verificación (solo lectura)
-- Para correr ANTES (esperado: false/0) y DESPUÉS de aplicar (esperado: los valores indicados).
-- ============================================================================
select
  to_regclass('public.google_cuentas') is not null                                                    as cuentas,           -- true
  to_regclass('public.google_secretos') is not null                                                   as secretos,          -- true
  to_regclass('public.google_oauth_estados') is not null                                              as estados,           -- true
  (select count(*) from pg_class where oid in (to_regclass('public.google_cuentas'), to_regclass('public.google_secretos'),
        to_regclass('public.google_oauth_estados')) and relrowsecurity)                               as con_rls,           -- 3
  (select count(*) from pg_policies where schemaname = 'public' and tablename like 'google\_%')       as politicas_google,  -- 1 (solo lectura en google_cuentas)
  (select count(*) from information_schema.columns where table_schema = 'public'
     and table_name = 'calendarios_fuente' and column_name = 'cuenta_id')                              as col_cuenta_id,     -- 1
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in ('google_iniciar_conexion', 'google_consumir_nonce',
           'google_guardar_cuenta', 'google_leer_token', 'google_desconectar'))                       as funciones,         -- 5
  (select count(*) from pg_tables where schemaname = 'public')                                        as tablas_public,     -- baseline + 3
  (select count(*) from pg_policies where schemaname = 'public')                                      as politicas_public,  -- baseline + 1
  (select count(*) from vault.secrets)                                                                as secretos_vault;    -- sin cambios

-- Permisos de las tablas para anon y authenticated. Esperado: solo authenticated / SELECT en google_cuentas.
select table_name, grantee, privilege_type from information_schema.role_table_grants
 where table_schema = 'public' and table_name like 'google\_%' and grantee in ('anon', 'authenticated')
 order by 1, 2, 3;

-- Quién puede ejecutar cada función. Esperado:
--   google_iniciar_conexion y google_desconectar: authenticated; google_consumir_nonce, google_guardar_cuenta y google_leer_token: solo service_role.
select p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE')          as anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
       has_function_privilege('service_role', p.oid, 'EXECUTE')  as service_role
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname like 'google\_%'
 order by 1;
