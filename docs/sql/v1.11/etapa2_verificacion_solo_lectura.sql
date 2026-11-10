-- ============================================================================
-- FASE 3 · v1.11 · Etapa 2 · verificacion_solo_lectura
-- Extraído de docs/MIGRACIONES-FASE-3-v1.11.md (esa es la fuente).
-- NO se ha ejecutado en Supabase. Validado completo (404 PASS, 0 FAIL, 2 NOT RUN) solo en un PostgreSQL 16 local y desechable: docs/VALIDACION-LOCAL-FASE-3-v1.11.md.
-- Antes de cualquier ejecución: etapa 0 (verificación de roles y permisos) y autorización expresa por etapa.
-- ============================================================================
select proname, prosecdef from pg_proc where pronamespace = 'public'::regnamespace order by 1;
select tablename, policyname, cmd from pg_policies where schemaname = 'public'
  and tablename in ('temporizador_activo', 'focus_sesiones', 'descansos', 'operaciones', 'preferencias_usuario');
select count(*) from public.temporizador_activo;
