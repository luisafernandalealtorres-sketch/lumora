-- ============================================================================
-- FASE 3 · v1.10 · Etapa 1 · reversion_suave
-- NO EJECUTADO. Extraído de docs/MIGRACIONES-FASE-3-v1.10.md (esa es la fuente).
-- No se ha ejecutado en Supabase. La v1.8 se validó solo en PostgreSQL local; T-7 y T-8b (v1.9) no se han revalidado; la etapa 0 se rediseñó en la v1.10 y no se ejecutó.
-- Antes de cualquier ejecución: etapa 0 (verificación de roles y permisos) y autorización expresa por etapa.
-- ============================================================================
begin;
alter table public.pendientes disable trigger pendientes_registrar_cambios;
alter table public.hitos      disable trigger hitos_registrar_cambios;
alter table public.hitos      disable trigger hitos_sellar_hecho_en;
commit;
