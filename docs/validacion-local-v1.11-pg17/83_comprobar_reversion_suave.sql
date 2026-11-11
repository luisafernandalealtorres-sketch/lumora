-- Comprobaciones tras la REVERSIÓN SUAVE con temporizadores de hábito activos (semilla: 82_semilla_reversion_temporizadores.sql).
delete from zz.res;
do $$ declare u3 uuid := '33333333-3333-3333-3333-333333333333'; u4 uuid := '44444444-4444-4444-4444-444444444444'; hoy date := (now() at time zone 'America/Bogota')::date; n int; begin
  perform zz.admin();
  -- Temporizadores y bloqueos de hábito
  perform zz.reg('RT-S01 no queda ningún bloqueo tipo hábito en temporizador_activo', (select count(*) from public.temporizador_activo where tipo = 'habito') = 0, 'quedan=' || (select count(*) from public.temporizador_activo where tipo = 'habito'));
  perform zz.reg('RT-S02 los 2 temporizadores de hábito quedaron finalizados y ninguno activo',
    (select count(*) from public.habito_temporizadores where estado = 'finalizado') = 2 and (select count(*) from public.habito_temporizadores where estado in ('en_curso', 'pausado')) = 0, null);
  -- Conservación del tiempo
  perform zz.reg('RT-S03 el tramo abierto de u1 (600 s) se acreditó en los segmentos', (select coalesce(sum(segundos), 0) from public.habito_segmentos where user_id = zz.u1()) between 600 and 700,
    'segundos=' || (select coalesce(sum(segundos), 0) from public.habito_segmentos where user_id = zz.u1()));
  perform zz.reg('RT-S04 habito_tiempo de u1 hoy refleja ese tiempo (fuente temporizador)', (select temporizador_s from public.habito_tiempo where user_id = zz.u1() and fecha = hoy) between 600 and 700
    and (select fuente from public.habito_tiempo where user_id = zz.u1() and fecha = hoy) = 'temporizador',
    'temporizador_s=' || coalesce((select temporizador_s::text from public.habito_tiempo where user_id = zz.u1() and fecha = hoy), 'null'));
  perform zz.reg('RT-S05 el historial de tiempo de u1 registra el cierre (null -> segundos)', exists (select 1 from public.habito_tiempo_historial where user_id = zz.u1() and fecha = hoy and valor_anterior_s is null and valor_nuevo_s between 600 and 700), null);
  perform zz.reg('RT-S06 u3 (pausado): el tiempo ya cerrado se conserva y no se añade nada', (select coalesce(sum(segundos), 0)::text from public.habito_segmentos where user_id = u3) = (select valor from zz.antes where clave = 'seg_u3'),
    'antes=' || (select valor from zz.antes where clave = 'seg_u3') || ' ahora=' || (select coalesce(sum(segundos), 0) from public.habito_segmentos where user_id = u3));
  -- Todos los datos se conservan
  perform zz.reg('RT-S07 se conservan todos los hábitos, versiones, objetivos y temporizadores',
    (select count(*)::text from public.habitos_config) = (select valor from zz.antes where clave = 'n_habitos')
    and (select count(*)::text from public.habitos_config_versiones) = (select valor from zz.antes where clave = 'n_versiones')
    and (select count(*)::text from public.objetivos_atencion) = (select valor from zz.antes where clave = 'n_objetivos')
    and (select count(*)::text from public.habito_temporizadores) = (select valor from zz.antes where clave = 'n_temporizadores'), null);
  -- Focus y descansos intactos
  perform zz.reg('RT-S08a bloqueo de Focus de u2 sin cambios', (select md5(x::text) from public.temporizador_activo x where x.user_id = zz.u2()) = (select valor from zz.antes where clave = 'lock_u2'), null);
  perform zz.reg('RT-S08b sesión de Focus de u2 sin cambios', (select md5(f::text) from public.focus_sesiones f where f.user_id = zz.u2()) = (select valor from zz.antes where clave = 'focus_u2'), null);
  perform zz.reg('RT-S08c bloqueo de descanso de u4 sin cambios', (select md5(x::text) from public.temporizador_activo x where x.user_id = u4) = (select valor from zz.antes where clave = 'lock_u4'), null);
  perform zz.reg('RT-S08d descanso de u4 sin cambios', (select md5(x::text) from public.descansos x where x.user_id = u4) = (select valor from zz.antes where clave = 'descanso_u4'), null);
  perform zz.reg('RT-S08e los bloqueos que no son de hábito siguen siendo los mismos', (select count(*)::text from public.temporizador_activo where tipo <> 'habito') = (select valor from zz.antes where clave = 'bloqueos_otros'), null);
  -- Focus sigue funcionando con los mismos permisos
  perform zz.reg('RT-S09 los privilegios de todo lo de Focus (tablas, columnas y funciones) no cambiaron', zz.privs_etapa2() = (select valor from zz.antes where clave = 'privs_etapa2'), null);
  select count(*) into n from pg_proc p where p.pronamespace = 'public'::regnamespace and (p.proname like 'focus\_%' or p.proname like 'descanso\_%') and p.proname !~ '^_' and has_function_privilege('authenticated', p.oid, 'EXECUTE');
  perform zz.reg('RT-S10 authenticated conserva EXECUTE en las 11 RPC de Focus y descansos', n = 11, 'rpc=' || n);
  perform zz.como(zz.u1());
  begin perform public.focus_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'productivity', 'tanku'); perform zz.reg('RT-S11a u1 puede iniciar Focus tras la reversión', true, 'ok');
  exception when others then perform zz.reg('RT-S11a u1 puede iniciar Focus tras la reversión', false, sqlerrm); end;
  perform zz.como(u3);
  begin perform public.focus_iniciar(gen_random_uuid(), zz.d2(), zz.sq(), 'enjoyment', 'salud'); perform zz.reg('RT-S11b u3 (tenía un hábito pausado) puede iniciar Focus', true, 'ok');
  exception when others then perform zz.reg('RT-S11b u3 (tenía un hábito pausado) puede iniciar Focus', false, sqlerrm); end;
  perform zz.como(zz.u1());
  begin insert into public.preferencias_usuario (focus_min) values (25); perform zz.reg('RT-S11c preferencias de Focus siguen editables por el cliente', true, 'ok');
  exception when others then perform zz.reg('RT-S11c preferencias de Focus siguen editables por el cliente', false, sqlerrm); end;
  -- Se acabó la edición de los datos nuevos; la lectura se conserva
  perform zz.admin();
  perform zz.reg('RT-S12a objetivos_atencion: authenticated conserva SELECT y pierde INSERT, UPDATE y DELETE',
    has_table_privilege('authenticated', 'public.objetivos_atencion', 'SELECT') and not has_table_privilege('authenticated', 'public.objetivos_atencion', 'INSERT')
    and not has_table_privilege('authenticated', 'public.objetivos_atencion', 'UPDATE') and not has_table_privilege('authenticated', 'public.objetivos_atencion', 'DELETE'), null);
  perform zz.reg('RT-S12b habitos_config: authenticated conserva SELECT y pierde el UPDATE (tabla y columnas nombre y modo_registro)',
    has_table_privilege('authenticated', 'public.habitos_config', 'SELECT') and not has_table_privilege('authenticated', 'public.habitos_config', 'UPDATE')
    and not has_column_privilege('authenticated', 'public.habitos_config', 'nombre', 'UPDATE') and not has_column_privilege('authenticated', 'public.habitos_config', 'modo_registro', 'UPDATE'), null);
  perform zz.como(zz.u1());
  begin insert into public.objetivos_atencion (semana_inicio, frente_id, puntos) values (public.lunes_semana_bogota(now()) + 7, 'salud', 5); perform zz.reg('RT-S13a insertar un objetivo queda denegado', false, 'se pudo');
  exception when others then perform zz.reg('RT-S13a insertar un objetivo queda denegado', sqlerrm like 'permission denied%', sqlerrm); end;
  begin update public.objetivos_atencion set puntos = 99; perform zz.reg('RT-S13b actualizar un objetivo queda denegado', false, 'se pudo');
  exception when others then perform zz.reg('RT-S13b actualizar un objetivo queda denegado', sqlerrm like 'permission denied%', sqlerrm); end;
  begin delete from public.objetivos_atencion; perform zz.reg('RT-S13c borrar un objetivo queda denegado', false, 'se pudo');
  exception when others then perform zz.reg('RT-S13c borrar un objetivo queda denegado', sqlerrm like 'permission denied%', sqlerrm); end;
  begin update public.habitos_config set nombre = 'otro'; perform zz.reg('RT-S13d renombrar un hábito queda denegado', false, 'se pudo');
  exception when others then perform zz.reg('RT-S13d renombrar un hábito queda denegado', sqlerrm like 'permission denied%', sqlerrm); end;
  begin perform public.habito_timer_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), gen_random_uuid()); perform zz.reg('RT-S13e las RPC de hábito quedan denegadas', false, 'se pudo');
  exception when others then perform zz.reg('RT-S13e las RPC de hábito quedan denegadas', sqlerrm like 'permission denied%', sqlerrm); end;
  perform zz.reg('RT-S14 u1 sigue pudiendo LEER su objetivo y su hábito (RLS propio)', (select count(*) from public.objetivos_atencion) = 1 and (select count(*) from public.habitos_config) = 1,
    'objetivos=' || (select count(*) from public.objetivos_atencion) || ' habitos=' || (select count(*) from public.habitos_config));
  perform zz.admin();
end $$;
select caso, ok, detalle from zz.res order by id;
