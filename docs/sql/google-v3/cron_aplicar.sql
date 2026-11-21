-- ============================================================================
-- GOOGLE v3 · programar la sincronización (pg_net + pg_cron)
-- APLICADA en Supabase el 2026-11-20, con autorización expresa. Probada de punta a punta: una corrida de prueba de pg_cron llegó
-- a la función sincronizar-agenda (HTTP 200) y dejó las 4 fuentes sincronizadas sin errores; la prueba se quitó y quedaron 3 trabajos.
-- El secreto NO está en el texto de los trabajos: cada corrida lo lee del Vault (sync_agenda_secret).
-- Horas de Bogotá (UTC-5): 6:00 = 11:00 UTC, 12:00 = 17:00 UTC, 17:00 = 22:00 UTC.
-- Requiere google-v1 y google-v2 aplicadas, y los secretos GOOGLE_SYNC_CLIENT_ID / GOOGLE_SYNC_CLIENT_SECRET en las Edge Functions.
-- ============================================================================
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

select cron.schedule('sincronizar-agenda-6am-bogota', '0 11 * * *', $cmd$select net.http_post(
    url := 'https://kztoazvjfwzndeubghey.supabase.co/functions/v1/sincronizar-agenda',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'sync_agenda_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 55000)$cmd$);
select cron.schedule('sincronizar-agenda-12pm-bogota', '0 17 * * *', $cmd$select net.http_post(
    url := 'https://kztoazvjfwzndeubghey.supabase.co/functions/v1/sincronizar-agenda',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'sync_agenda_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 55000)$cmd$);
select cron.schedule('sincronizar-agenda-5pm-bogota', '0 22 * * *', $cmd$select net.http_post(
    url := 'https://kztoazvjfwzndeubghey.supabase.co/functions/v1/sincronizar-agenda',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'sync_agenda_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 55000)$cmd$);

-- Verificación (solo lectura): deben verse exactamente 3 trabajos activos que leen el secreto del Vault.
-- select jobname, schedule, active from cron.job order by jobname;
-- Revisar corridas:  select * from cron.job_run_details order by runid desc limit 10;
--                    select id, status_code, left(content::text, 300) from net._http_response order by id desc limit 10;
