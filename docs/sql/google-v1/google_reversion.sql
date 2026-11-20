-- ============================================================================
-- GOOGLE v1 · reversión
-- NO se ha ejecutado en Supabase. Requiere autorización expresa.
-- PÉRDIDA DE DATOS: se pierden las cuentas de Google conectadas y sus tokens (se borran del Vault).
-- Los eventos de agenda_hoy y las filas de calendarios_fuente se conservan (solo se quita la columna cuenta_id).
-- ============================================================================
begin;

-- Los secretos del Vault se borran ANTES de perder la tabla que los referencia.
delete from vault.secrets where id in (select secreto_id from public.google_secretos);

drop function if exists public.google_desconectar(uuid);
drop function if exists public.google_leer_token(uuid);
drop function if exists public.google_guardar_cuenta(uuid, text, text, text[]);
drop function if exists public.google_consumir_nonce(text);
drop function if exists public.google_iniciar_conexion();

alter table public.calendarios_fuente drop column if exists cuenta_id;
drop table if exists public.google_oauth_estados;
drop table if exists public.google_secretos;
drop table if exists public.google_cuentas;

commit;
