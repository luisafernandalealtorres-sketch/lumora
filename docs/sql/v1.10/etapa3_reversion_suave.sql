-- ============================================================================
-- FASE 3 · v1.10 · Etapa 3 · reversion_suave
-- NO EJECUTADO. Extraído de docs/MIGRACIONES-FASE-3-v1.10.md (esa es la fuente).
-- No se ha ejecutado en Supabase. La v1.8 se validó solo en PostgreSQL local; T-7 y T-8b (v1.9) no se han revalidado; la etapa 0 se rediseñó en la v1.10 y no se ejecutó.
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
