-- ============================================================================
-- FASE 3 · v1.9 · Etapa 3 · verificacion_solo_lectura
-- NO EJECUTADO. Extraído de docs/MIGRACIONES-FASE-3-v1.9.md (esa es la fuente).
-- No se ha ejecutado en Supabase. La v1.8 se validó solo en PostgreSQL local; T-7 y T-8b (v1.9) no se han revalidado.
-- Antes de cualquier ejecución: etapa 0 (verificación de roles y permisos) y autorización expresa por etapa.
-- ============================================================================
select table_name from information_schema.tables
where table_schema = 'public' and table_name like 'habito%' order by 1;
select count(*) from public.habitos;            -- debe seguir intacta (heredada)
select count(*) from public.habito_registros;   -- debe seguir intacta (heredada)
