-- ============================================================================
-- GOOGLE v2 · verificación (solo lectura)
-- Para correr ANTES (esperado: 0/false) y DESPUÉS de aplicar (esperado: los valores indicados).
-- ============================================================================
select
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in ('google_validar_sync', 'agenda_reemplazar', 'agenda_error_fuente',
           'google_marcar_cuenta', 'google_vincular_calendarios'))                  as funciones,        -- 5
  (select count(*) from vault.secrets where name = 'sync_agenda_secret')           as secreto_sync,     -- 1
  (select count(*) from pg_tables where schemaname = 'public')                     as tablas_public,    -- sin cambios
  (select count(*) from pg_policies where schemaname = 'public')                   as politicas_public; -- sin cambios

-- Quién puede ejecutar cada función. Esperado: solo service_role.
select p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE')          as anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
       has_function_privilege('service_role', p.oid, 'EXECUTE')  as service_role
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('google_validar_sync', 'agenda_reemplazar', 'agenda_error_fuente', 'google_marcar_cuenta', 'google_vincular_calendarios')
 order by 1;
