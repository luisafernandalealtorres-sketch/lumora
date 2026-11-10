-- ============================================================================
-- FASE 3 · v1.11 · Etapa 3 · verificacion_solo_lectura
-- Extraído de docs/MIGRACIONES-FASE-3-v1.11.md (esa es la fuente).
-- NO se ha ejecutado en Supabase. Validado completo en dos PostgreSQL locales y desechables: 16.15 (404 PASS, 0 FAIL, 2 NOT RUN; docs/VALIDACION-LOCAL-FASE-3-v1.11.md) y 17.11 (497 PASS, 0 FAIL, 2 NOT RUN; docs/VALIDACION-LOCAL-FASE-3-v1.11-PG17.md).
-- Antes de cualquier ejecución: etapa 0 (verificación de roles y permisos) y autorización expresa por etapa.
-- ============================================================================
select table_name from information_schema.tables
where table_schema = 'public' and table_name like 'habito%' order by 1;
select count(*) from public.habitos;            -- debe seguir intacta (heredada)
select count(*) from public.habito_registros;   -- debe seguir intacta (heredada)
