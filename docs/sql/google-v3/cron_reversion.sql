-- ============================================================================
-- GOOGLE v3 · reversión (deja de programar la sincronización)
-- NO se ha ejecutado. Requiere autorización expresa.
-- Quita los 3 trabajos de pg_cron. No desinstala las extensiones (por si otros trabajos las usan).
-- Después de esto la agenda deja de sincronizarse sola: Home mostrará «desactualizada» a las 14 horas.
-- ============================================================================
select cron.unschedule('sincronizar-agenda-6am-bogota');
select cron.unschedule('sincronizar-agenda-12pm-bogota');
select cron.unschedule('sincronizar-agenda-5pm-bogota');
