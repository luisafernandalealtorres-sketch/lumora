-- ============================================================================
-- ASISTENTE v1 · reversión
-- NO se ha ejecutado en Supabase. Requiere autorización expresa.
-- PÉRDIDA DE DATOS: se pierden la memoria del asistente y el historial de uso (tokens y costo).
-- ============================================================================
begin;

drop function if exists public.asistente_gasto_mes();
drop table if exists public.asistente_uso;
drop table if exists public.asistente_memoria;
drop function if exists public.asistente_memoria_limite();

commit;
