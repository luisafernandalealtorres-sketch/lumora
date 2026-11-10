-- ============================================================================
-- FASE 3 · v1.9 · Etapa 3 · reversion_dura
-- NO EJECUTADO. Extraído de docs/MIGRACIONES-FASE-3-v1.9.md (esa es la fuente).
-- No se ha ejecutado en Supabase. La v1.8 se validó solo en PostgreSQL local; T-7 y T-8b (v1.9) no se han revalidado.
-- Antes de cualquier ejecución: etapa 0 (verificación de roles y permisos) y autorización expresa por etapa.
-- ============================================================================
begin;
drop function if exists public.habito_registrar_manual(uuid, uuid, bigint, uuid, date, integer);
drop function if exists public.habito_timer_cancelar(uuid, uuid, bigint, uuid);
drop function if exists public.habito_timer_finalizar(uuid, uuid, bigint, uuid);
drop function if exists public.habito_timer_reanudar(uuid, uuid, bigint, uuid);
drop function if exists public.habito_timer_pausar(uuid, uuid, bigint, uuid);
drop function if exists public.habito_timer_iniciar(uuid, uuid, bigint, uuid);
drop function if exists public.habito_archivar(uuid, date);
drop function if exists public.habito_programar(uuid, text, smallint[], integer, date);
drop function if exists public.habito_crear(uuid, uuid, bigint, text, text, text, smallint[], integer, date);
drop function if exists public._cerrar_tramo(uuid, public.habito_temporizadores, timestamptz, uuid, uuid);
drop function if exists public._hay_ocurrencia(uuid, date);
drop table if exists public.habito_tiempo_historial;
drop table if exists public.habito_tiempo;
drop table if exists public.habito_segmentos;
drop table if exists public.habito_temporizadores;
drop table if exists public.habitos_config_versiones;
drop table if exists public.habitos_config;
drop function if exists public.objetivos_semana_cerrada();   -- el disparador se elimina con la tabla
drop table if exists public.objetivos_atencion;
commit;
