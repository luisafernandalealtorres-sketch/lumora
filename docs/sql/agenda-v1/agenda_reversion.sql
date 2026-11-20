-- ============================================================================
-- AGENDA v1 · reversión
-- NO se ha ejecutado en Supabase. Requiere autorización expresa.
-- PÉRDIDA DE DATOS: se pierden las fuentes de calendario y el origen/frente de los eventos de agenda_hoy.
-- Los eventos (hora, título, detalle) se conservan.
-- ============================================================================
begin;

drop index if exists public.agenda_hoy_origen_uidx;
alter table public.agenda_hoy
  drop column if exists sincronizado_en,
  drop column if exists origen_id,
  drop column if exists frente_id,
  drop column if exists calendario_id;
drop table if exists public.calendarios_fuente;

commit;
