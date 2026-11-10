-- ============================================================================
-- FASE 3 · v1.11 · Etapa 3 · reversion_dura
-- Extraído de docs/MIGRACIONES-FASE-3-v1.11.md (esa es la fuente).
-- NO se ha ejecutado en Supabase. Validado completo en dos PostgreSQL locales y desechables: 16.15 (404 PASS, 0 FAIL, 2 NOT RUN; docs/VALIDACION-LOCAL-FASE-3-v1.11.md) y 17.11 (497 PASS, 0 FAIL, 2 NOT RUN; docs/VALIDACION-LOCAL-FASE-3-v1.11-PG17.md).
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
drop table if exists public.objetivos_atencion;
drop function if exists public.objetivos_semana_cerrada();   -- después de la tabla: el disparador depende de la función
drop function if exists public.lunes_semana_bogota(timestamptz);
commit;
