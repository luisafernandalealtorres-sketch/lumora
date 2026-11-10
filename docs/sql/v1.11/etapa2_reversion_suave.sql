-- ============================================================================
-- FASE 3 · v1.11 · Etapa 2 · reversion_suave
-- Extraído de docs/MIGRACIONES-FASE-3-v1.11.md (esa es la fuente).
-- NO se ha ejecutado en Supabase. Validado completo (404 PASS, 0 FAIL, 2 NOT RUN) solo en un PostgreSQL 16 local y desechable: docs/VALIDACION-LOCAL-FASE-3-v1.11.md.
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
