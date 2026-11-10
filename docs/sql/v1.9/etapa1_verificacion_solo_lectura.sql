-- ============================================================================
-- FASE 3 · v1.9 · Etapa 1 · verificacion_solo_lectura
-- NO EJECUTADO. Extraído de docs/MIGRACIONES-FASE-3-v1.9.md (esa es la fuente).
-- No se ha ejecutado en Supabase. La v1.8 se validó solo en PostgreSQL local; T-7 y T-8b (v1.9) no se han revalidado.
-- Antes de cualquier ejecución: etapa 0 (verificación de roles y permisos) y autorización expresa por etapa.
-- ============================================================================
select column_name, data_type, column_default, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name in ('pendientes', 'hitos')
  and column_name in ('prioridad', 'orden', 'fijado_dia', 'hecho_en');
select tgname, tgenabled from pg_trigger
where tgrelid in ('public.pendientes'::regclass, 'public.hitos'::regclass) and not tgisinternal;
select count(*) from public.cambios_registro;
