-- ============================================================================
-- FASE 3 · v1.11 · Etapa 3 · reversion_dura
-- Extraído de docs/MIGRACIONES-FASE-3-v1.11.md (esa es la fuente).
-- NO se ha ejecutado en Supabase. Validado completo en dos PostgreSQL locales y desechables: 16.15 (404 PASS, 0 FAIL, 2 NOT RUN; docs/VALIDACION-LOCAL-FASE-3-v1.11.md) y 17.11 (497 PASS, 0 FAIL, 2 NOT RUN; docs/VALIDACION-LOCAL-FASE-3-v1.11-PG17.md).
-- Antes de cualquier ejecución: etapa 0 (verificación de roles y permisos) y autorización expresa por etapa.
-- ============================================================================
begin;

-- Bloqueos de temporizadores de hábito. temporizador_activo es de la etapa 2 y NO se elimina aquí; si se borran las tablas de hábitos
-- con un temporizador activo, su fila de bloqueo (tipo = 'habito') quedaría huérfana (ref_id apuntando a una tabla que ya no existe)
-- y bloquearía iniciar Focus de forma permanente. Se eliminan ANTES de borrar las tablas. Solo filas con tipo = 'habito': los bloqueos
-- de Focus y de descansos no se modifican.
-- PÉRDIDA DE DATOS (esta reversión es destructiva): se pierden todos los hábitos nuevos, sus programaciones, temporizadores, segmentos,
-- tiempos, historial y los objetivos semanales. El tramo que un temporizador de hábito llevaba abierto también se pierde (no se acredita).
-- Las filas de operaciones con tipos habito_* se conservan (diario de la etapa 2) y apuntan a objetos que ya no existen.
lock table public.temporizador_activo in share row exclusive mode;
delete from public.temporizador_activo where tipo = 'habito';

drop function if exists public.habito_registrar_manual(uuid, uuid, bigint, uuid, date, integer);
drop function if exists public.habito_timer_cancelar(uuid, uuid, bigint, uuid);
drop function if exists public.habito_timer_finalizar(uuid, uuid, bigint, uuid);
drop function if exists public.habito_timer_reanudar(uuid, uuid, bigint, uuid);
drop function if exists public.habito_timer_pausar(uuid, uuid, bigint, uuid);
drop function if exists public.habito_timer_iniciar(uuid, uuid, bigint, uuid);
drop function if exists public.habito_archivar(uuid, date);
drop function if exists public.habito_programar(uuid, text, smallint[], integer, date);
drop function if exists public.habito_crear(uuid, uuid, bigint, text, text, text, smallint[], integer, date);
drop function if exists public._cerrar_tramo(uuid, public.habito_temporizadores, timestamptz, uuid, uuid);
drop function if exists public._hay_ocurrencia(uuid, date);
drop table if exists public.habito_tiempo_historial;
drop table if exists public.habito_tiempo;
drop table if exists public.habito_segmentos;
drop table if exists public.habito_temporizadores;
drop table if exists public.habitos_config_versiones;
drop table if exists public.habitos_config;
drop table if exists public.objetivos_atencion;
drop function if exists public.objetivos_semana_cerrada();   -- después de la tabla: el disparador depende de la función
drop function if exists public.lunes_semana_bogota(timestamptz);
commit;
