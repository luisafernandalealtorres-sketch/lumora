-- ============================================================================
-- GOOGLE v2 · reversión
-- NO se ha ejecutado en Supabase. Requiere autorización expresa.
-- Borra el secreto compartido del Vault y las funciones de apoyo. No toca agenda_hoy, calendarios_fuente ni google-v1.
-- Si ya existen tareas de pg_cron que usen el secreto, deben desprogramarse ANTES (cron.unschedule).
-- ============================================================================
begin;

drop function if exists public.google_vincular_calendarios(uuid, uuid, text);
drop function if exists public.google_marcar_cuenta(uuid, text, text);
drop function if exists public.agenda_error_fuente(uuid, text, text);
drop function if exists public.agenda_reemplazar(uuid, text, date, date, jsonb);
drop function if exists public.google_validar_sync(text);
delete from vault.secrets where name = 'sync_agenda_secret';

commit;
