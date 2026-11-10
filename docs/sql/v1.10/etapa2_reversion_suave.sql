-- ============================================================================
-- FASE 3 · v1.10 · Etapa 2 · reversion_suave
-- NO EJECUTADO. Extraído de docs/MIGRACIONES-FASE-3-v1.10.md (esa es la fuente).
-- No se ha ejecutado en Supabase. La v1.8 se validó solo en PostgreSQL local; T-7 y T-8b (v1.9) no se han revalidado; la etapa 0 se rediseñó en la v1.10 y no se ejecutó.
-- Antes de cualquier ejecución: etapa 0 (verificación de roles y permisos) y autorización expresa por etapa.
-- ============================================================================
begin;
revoke execute on function public.focus_iniciar(uuid, uuid, bigint, text, text, text, text, uuid) from authenticated;
revoke execute on function public.focus_pausar(uuid, uuid, bigint, uuid)       from authenticated;
revoke execute on function public.focus_reanudar(uuid, uuid, bigint, uuid)     from authenticated;
revoke execute on function public.focus_completar(uuid, uuid, bigint, uuid)    from authenticated;
revoke execute on function public.focus_cancelar(uuid, uuid, bigint, uuid)     from authenticated;
revoke execute on function public.descanso_iniciar(uuid, uuid, bigint, text, uuid) from authenticated;
revoke execute on function public.descanso_pausar(uuid, uuid, bigint, uuid)    from authenticated;
revoke execute on function public.descanso_reanudar(uuid, uuid, bigint, uuid)  from authenticated;
revoke execute on function public.descanso_completar(uuid, uuid, bigint, uuid) from authenticated;
revoke execute on function public.descanso_omitir(uuid, uuid, bigint, text, uuid) from authenticated;
revoke execute on function public.descanso_cancelar(uuid, uuid, bigint, uuid)  from authenticated;
commit;
