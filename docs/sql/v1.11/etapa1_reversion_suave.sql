-- ============================================================================
-- FASE 3 · v1.11 · Etapa 1 · reversion_suave
-- Extraído de docs/MIGRACIONES-FASE-3-v1.11.md (esa es la fuente).
-- NO se ha ejecutado en Supabase. Validado completo (404 PASS, 0 FAIL, 2 NOT RUN) solo en un PostgreSQL 16 local y desechable: docs/VALIDACION-LOCAL-FASE-3-v1.11.md.
-- Antes de cualquier ejecución: etapa 0 (verificación de roles y permisos) y autorización expresa por etapa.
-- ============================================================================
begin;
alter table public.pendientes disable trigger pendientes_registrar_cambios;
alter table public.hitos      disable trigger hitos_registrar_cambios;
alter table public.hitos      disable trigger hitos_sellar_hecho_en;
commit;
