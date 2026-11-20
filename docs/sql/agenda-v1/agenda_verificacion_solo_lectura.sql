-- ============================================================================
-- AGENDA v1 · verificación (solo lectura)
-- Para correr ANTES (esperado: todo en false/0) y DESPUÉS de aplicar (esperado: todo en true).
-- ============================================================================
select
  to_regclass('public.calendarios_fuente') is not null                                                    as tabla_fuentes,
  (select relrowsecurity from pg_class where oid = to_regclass('public.calendarios_fuente'))              as fuentes_con_rls,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'calendarios_fuente')      as politicas_fuentes,   -- esperado 1
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'agenda_hoy'
       and column_name in ('calendario_id', 'frente_id', 'origen_id', 'sincronizado_en'))                  as columnas_nuevas,     -- esperado 4
  to_regclass('public.agenda_hoy_origen_uidx') is not null                                                 as indice_unico,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'agenda_hoy')              as politicas_agenda,    -- esperado 1 (sin cambios)
  (select count(*) from public.agenda_hoy)                                                                 as filas_agenda;
select grantee, privilege_type from information_schema.role_table_grants
 where table_schema = 'public' and table_name = 'calendarios_fuente' and grantee in ('anon', 'authenticated')
 order by 1, 2;                                                                                              -- esperado: solo authenticated / SELECT
