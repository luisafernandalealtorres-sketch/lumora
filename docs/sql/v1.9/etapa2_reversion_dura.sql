-- ============================================================================
-- FASE 3 · v1.9 · Etapa 2 · reversion_dura
-- NO EJECUTADO. Extraído de docs/MIGRACIONES-FASE-3-v1.9.md (esa es la fuente).
-- No se ha ejecutado en Supabase. La v1.8 se validó solo en PostgreSQL local; T-7 y T-8b (v1.9) no se han revalidado.
-- Antes de cualquier ejecución: etapa 0 (verificación de roles y permisos) y autorización expresa por etapa.
-- ============================================================================
begin;
drop function if exists public.focus_iniciar(uuid, uuid, bigint, text, text, text, text, uuid);
drop function if exists public.focus_pausar(uuid, uuid, bigint, uuid);
drop function if exists public.focus_reanudar(uuid, uuid, bigint, uuid);
drop function if exists public.focus_completar(uuid, uuid, bigint, uuid);
drop function if exists public.focus_cancelar(uuid, uuid, bigint, uuid);
drop function if exists public.descanso_iniciar(uuid, uuid, bigint, text, uuid);
drop function if exists public.descanso_pausar(uuid, uuid, bigint, uuid);
drop function if exists public.descanso_reanudar(uuid, uuid, bigint, uuid);
drop function if exists public.descanso_completar(uuid, uuid, bigint, uuid);
drop function if exists public.descanso_omitir(uuid, uuid, bigint, text, uuid);
drop function if exists public.descanso_cancelar(uuid, uuid, bigint, uuid);
drop function if exists public._ciclos_desde_ultimo_largo(uuid);
drop function if exists public._journal(uuid, uuid, uuid, bigint, text, text, uuid, jsonb, text, text);
drop function if exists public._op_existente(uuid, uuid);
drop function if exists public._prefs(uuid);
drop function if exists public._uid();
drop table if exists public.descansos;
drop table if exists public.focus_sesiones;
drop table if exists public.operaciones;
drop table if exists public.temporizador_activo;
drop table if exists public.preferencias_usuario;
drop function if exists public._tocar_actualizado_en();
commit;
