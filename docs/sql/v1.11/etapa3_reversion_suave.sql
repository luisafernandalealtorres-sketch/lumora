-- ============================================================================
-- FASE 3 · v1.11 · Etapa 3 · reversion_suave
-- Extraído de docs/MIGRACIONES-FASE-3-v1.11.md (esa es la fuente).
-- NO se ha ejecutado en Supabase. Validado completo en dos PostgreSQL locales y desechables: 16.15 (404 PASS, 0 FAIL, 2 NOT RUN; docs/VALIDACION-LOCAL-FASE-3-v1.11.md) y 17.11 (497 PASS, 0 FAIL, 2 NOT RUN; docs/VALIDACION-LOCAL-FASE-3-v1.11-PG17.md).
-- Antes de cualquier ejecución: etapa 0 (verificación de roles y permisos) y autorización expresa por etapa.
-- ============================================================================
begin;

-- Temporizadores de hábito ACTIVOS (en curso o pausados). Esta reversión revoca habito_timer_pausar/finalizar/cancelar, así que un
-- temporizador activo no se podría cerrar después, y su bloqueo en temporizador_activo (una fila por usuario) impediría iniciar
-- Focus para siempre. Por eso se cierran aquí, ANTES de revocar los permisos:
--   * En curso: el tramo abierto se cierra con la misma función que usa habito_timer_finalizar (_cerrar_tramo): se parte por día local
--     (America/Bogota) y se acredita en habito_segmentos / habito_tiempo / habito_tiempo_historial solo en fechas con ocurrencia.
--     No se pierde el tiempo transcurrido.
--   * Pausado: no tiene tramo abierto; solo se finaliza.
--   * Cada temporizador pasa a 'finalizado' y se elimina su bloqueo. Solo se tocan filas con tipo = 'habito': los bloqueos de Focus
--     y de descansos no se modifican. Después no queda ninguna fila 'habito' en temporizador_activo.
-- No se registra fila en operaciones (no es una acción del usuario). Sin pérdida de datos.
lock table public.temporizador_activo, public.habito_temporizadores in share row exclusive mode;
do $$
declare
  t public.habito_temporizadores;
begin
  for t in select * from public.habito_temporizadores where estado in ('en_curso', 'pausado') order by iniciado_en for update loop
    if t.estado = 'en_curso' then
      perform public._cerrar_tramo(t.user_id, t, now(), null, null);
    end if;
    update public.habito_temporizadores
       set estado = 'finalizado', tramo_inicio = null, finalizado_en = now(), version = version + 1
     where id = t.id;
  end loop;
  delete from public.temporizador_activo where tipo = 'habito';   -- también cualquier bloqueo de hábito huérfano
end $$;

revoke execute on function public.habito_crear(uuid, uuid, bigint, text, text, text, smallint[], integer, date) from authenticated;
revoke execute on function public.habito_programar(uuid, text, smallint[], integer, date)   from authenticated;
revoke execute on function public.habito_archivar(uuid, date)                               from authenticated;
revoke execute on function public.habito_timer_iniciar(uuid, uuid, bigint, uuid)            from authenticated;
revoke execute on function public.habito_timer_pausar(uuid, uuid, bigint, uuid)             from authenticated;
revoke execute on function public.habito_timer_reanudar(uuid, uuid, bigint, uuid)           from authenticated;
revoke execute on function public.habito_timer_finalizar(uuid, uuid, bigint, uuid)          from authenticated;
revoke execute on function public.habito_timer_cancelar(uuid, uuid, bigint, uuid)           from authenticated;
revoke execute on function public.habito_registrar_manual(uuid, uuid, bigint, uuid, date, integer) from authenticated;

-- Edición directa de los datos nuevos. Sin las RPC, el cliente aún podría seguir CREANDO y EDITANDO objetivos semanales
-- (objetivos_atencion: CRUD) y RENOMBRAR hábitos o cambiar su modo (habitos_config: UPDATE por columna), con lo que la funcionalidad
-- quedaría a medias. Se revoca la edición y se CONSERVA la lectura (SELECT) y todos los datos; nada se borra.
--   * objetivos_atencion: se quitan INSERT, UPDATE y DELETE; queda SELECT.
--   * habitos_config: se quita UPDATE (incluye el privilegio por columna sobre nombre y modo_registro); queda SELECT.
-- No toca ninguna tabla ni función de Focus, descansos, preferencias ni operaciones: Focus sigue funcionando con sus mismos permisos.
-- lunes_semana_bogota sigue ejecutable por authenticated: es una función pura que no lee ni escribe datos.
revoke insert, update, delete on public.objetivos_atencion from authenticated;
revoke update on public.habitos_config from authenticated;
commit;
