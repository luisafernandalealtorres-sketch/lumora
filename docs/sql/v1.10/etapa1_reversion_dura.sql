-- ============================================================================
-- FASE 3 · v1.10 · Etapa 1 · reversion_dura
-- NO EJECUTADO. Extraído de docs/MIGRACIONES-FASE-3-v1.10.md (esa es la fuente).
-- No se ha ejecutado en Supabase. La v1.8 se validó solo en PostgreSQL local; T-7 y T-8b (v1.9) no se han revalidado; la etapa 0 se rediseñó en la v1.10 y no se ejecutó.
-- Antes de cualquier ejecución: etapa 0 (verificación de roles y permisos) y autorización expresa por etapa.
-- ============================================================================
begin;
drop trigger if exists pendientes_registrar_cambios on public.pendientes;
drop trigger if exists hitos_registrar_cambios      on public.hitos;
drop trigger if exists hitos_sellar_hecho_en        on public.hitos;
drop function if exists public.registrar_cambios();
drop function if exists public.hitos_sellar_hecho_en();
drop table    if exists public.cambios_registro;
drop index    if exists public.pendientes_user_fecha_limite_idx;
drop index    if exists public.pendientes_user_fijado_dia_idx;
drop index    if exists public.hitos_user_fecha_idx;
alter table public.pendientes drop constraint if exists pendientes_prioridad_check;
alter table public.hitos      drop constraint if exists hitos_prioridad_check;
alter table public.pendientes drop column if exists prioridad, drop column if exists orden, drop column if exists fijado_dia;
alter table public.hitos      drop column if exists prioridad, drop column if exists hecho_en;
commit;
