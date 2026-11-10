-- ============================================================================
-- FASE 3 · v1.10 · Etapa 2 · verificacion_solo_lectura
-- NO EJECUTADO. Extraído de docs/MIGRACIONES-FASE-3-v1.10.md (esa es la fuente).
-- No se ha ejecutado en Supabase. La v1.8 se validó solo en PostgreSQL local; T-7 y T-8b (v1.9) no se han revalidado; la etapa 0 se rediseñó en la v1.10 y no se ejecutó.
-- Antes de cualquier ejecución: etapa 0 (verificación de roles y permisos) y autorización expresa por etapa.
-- ============================================================================
select proname, prosecdef from pg_proc where pronamespace = 'public'::regnamespace order by 1;
select tablename, policyname, cmd from pg_policies where schemaname = 'public'
  and tablename in ('temporizador_activo', 'focus_sesiones', 'descansos', 'operaciones', 'preferencias_usuario');
select count(*) from public.temporizador_activo;
