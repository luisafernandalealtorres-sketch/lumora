-- ============================================================================
-- FASE 3 · v1.11 · Etapa 3 · reversion_suave
-- Extraído de docs/MIGRACIONES-FASE-3-v1.11.md (esa es la fuente).
-- NO se ha ejecutado en Supabase. Validado completo en dos PostgreSQL locales y desechables: 16.15 (404 PASS, 0 FAIL, 2 NOT RUN; docs/VALIDACION-LOCAL-FASE-3-v1.11.md) y 17.11 (497 PASS, 0 FAIL, 2 NOT RUN; docs/VALIDACION-LOCAL-FASE-3-v1.11-PG17.md).
-- Antes de cualquier ejecución: etapa 0 (verificación de roles y permisos) y autorización expresa por etapa.
-- ============================================================================
begin;
revoke execute on function public.habito_crear(uuid, uuid, bigint, text, text, text, smallint[], integer, date) from authenticated;
revoke execute on function public.habito_programar(uuid, text, smallint[], integer, date)   from authenticated;
revoke execute on function public.habito_archivar(uuid, date)                               from authenticated;
revoke execute on function public.habito_timer_iniciar(uuid, uuid, bigint, uuid)            from authenticated;
revoke execute on function public.habito_timer_pausar(uuid, uuid, bigint, uuid)             from authenticated;
revoke execute on function public.habito_timer_reanudar(uuid, uuid, bigint, uuid)           from authenticated;
revoke execute on function public.habito_timer_finalizar(uuid, uuid, bigint, uuid)          from authenticated;
revoke execute on function public.habito_timer_cancelar(uuid, uuid, bigint, uuid)           from authenticated;
revoke execute on function public.habito_registrar_manual(uuid, uuid, bigint, uuid, date, integer) from authenticated;
commit;
