-- Comprobaciones tras la REVERSIÓN DURA con temporizadores de hábito activos (semilla: 82_semilla_reversion_temporizadores.sql).
delete from zz.res;
do $$ declare u3 uuid := '33333333-3333-3333-3333-333333333333'; u4 uuid := '44444444-4444-4444-4444-444444444444'; n int; begin
  perform zz.admin();
  perform zz.reg('RT-D01 no queda ningún bloqueo tipo hábito en temporizador_activo (ni huérfano)', (select count(*) from public.temporizador_activo where tipo = 'habito') = 0, 'quedan=' || (select count(*) from public.temporizador_activo where tipo = 'habito'));
  select count(*) into n from unnest(array['habitos_config', 'habitos_config_versiones', 'habito_temporizadores', 'habito_segmentos', 'habito_tiempo', 'habito_tiempo_historial', 'objetivos_atencion']) x where to_regclass('public.' || x) is not null;
  perform zz.reg('RT-D02 las 7 tablas de la etapa 3 ya no existen', n = 0, 'existentes=' || n);
  select count(*) into n from pg_proc where pronamespace = 'public'::regnamespace and (proname like 'habito\_%' or proname in ('_hay_ocurrencia', '_cerrar_tramo', 'lunes_semana_bogota', 'objetivos_semana_cerrada'));
  perform zz.reg('RT-D03 las 13 funciones de la etapa 3 ya no existen', n = 0, 'existentes=' || n);
  perform zz.reg('RT-D04a bloqueo de Focus de u2 sin cambios', (select md5(x::text) from public.temporizador_activo x where x.user_id = zz.u2()) = (select valor from zz.antes where clave = 'lock_u2'), null);
  perform zz.reg('RT-D04b sesión de Focus de u2 sin cambios', (select md5(f::text) from public.focus_sesiones f where f.user_id = zz.u2()) = (select valor from zz.antes where clave = 'focus_u2'), null);
  perform zz.reg('RT-D04c bloqueo de descanso de u4 sin cambios', (select md5(x::text) from public.temporizador_activo x where x.user_id = u4) = (select valor from zz.antes where clave = 'lock_u4'), null);
  perform zz.reg('RT-D04d descanso de u4 sin cambios', (select md5(x::text) from public.descansos x where x.user_id = u4) = (select valor from zz.antes where clave = 'descanso_u4'), null);
  perform zz.reg('RT-D04e los bloqueos que no son de hábito siguen siendo los mismos', (select count(*)::text from public.temporizador_activo where tipo <> 'habito') = (select valor from zz.antes where clave = 'bloqueos_otros'), null);
  perform zz.reg('RT-D05 los privilegios de todo lo de Focus (tablas, columnas y funciones) no cambiaron', zz.privs_etapa2() = (select valor from zz.antes where clave = 'privs_etapa2'), null);
  perform zz.como(zz.u1());
  begin perform public.focus_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'productivity', 'tanku'); perform zz.reg('RT-D06a u1 (tenía un hábito en curso) puede iniciar Focus tras la reversión', true, 'ok');
  exception when others then perform zz.reg('RT-D06a u1 (tenía un hábito en curso) puede iniciar Focus tras la reversión', false, sqlerrm); end;
  perform zz.como(u3);
  begin perform public.focus_iniciar(gen_random_uuid(), zz.d2(), zz.sq(), 'enjoyment', 'salud'); perform zz.reg('RT-D06b u3 (tenía un hábito pausado) puede iniciar Focus', true, 'ok');
  exception when others then perform zz.reg('RT-D06b u3 (tenía un hábito pausado) puede iniciar Focus', false, sqlerrm); end;
  perform zz.admin();
  select count(*) into n from public.operaciones where tipo like 'habito\_%';
  perform zz.reg('RT-D07 (informativo) filas de operaciones con tipos habito_* que se conservan', true, 'filas=' || n);
end $$;
select caso, ok, detalle from zz.res order by id;
