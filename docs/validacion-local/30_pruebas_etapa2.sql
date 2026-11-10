-- Pruebas de la etapa 2 (exclusividad, estados, puntos, ciclos, idempotencia, seguridad).
\set ON_ERROR_STOP 0
delete from zz.res;

-- T-01 iniciar sin nada activo
do $$ declare s public.focus_sesiones; n int; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  s := public.focus_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'productivity', 'tanku', 'act', 'int');
  select count(*) into n from public.temporizador_activo where user_id = zz.u1() and tipo = 'focus' and ref_id = s.id and estado = 'corriendo';
  perform zz.reg('T-01 iniciar: sesión en_curso, bloqueo corriendo, 1800 s por defecto', s.estado = 'en_curso' and n = 1 and s.duracion_objetivo_s = 1800, s.estado || '/' || n || '/' || s.duracion_objetivo_s);
end $$;

-- T-02 segundo Focus
do $$ begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  perform public.focus_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'productivity', 'tanku');
  begin
    perform public.focus_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'enjoyment', 'salud');
    perform zz.reg('T-02 segundo Focus rechazado', false, 'no falló');
  exception when others then
    perform zz.reg('T-02 segundo Focus rechazado', sqlerrm = 'temporizador_ocupado', sqlerrm);
  end;
end $$;

-- T-03 pausar conserva el bloqueo
do $$ declare s public.focus_sesiones; e text; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  s := public.focus_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'productivity', 'tanku');
  s := public.focus_pausar(gen_random_uuid(), zz.d1(), zz.sq(), s.id);
  select estado into e from public.temporizador_activo;
  begin
    perform public.focus_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'productivity', 'tanku');
    perform zz.reg('T-03 pausado sigue ocupando', false, 'no falló');
  exception when others then
    perform zz.reg('T-03 pausado sigue ocupando', sqlerrm = 'temporizador_ocupado' and e = 'pausado', sqlerrm || '/' || e);
  end;
end $$;

-- T-05 descanso ocupa el bloqueo; T-12 omitir no lo toca; C-10 descanso pausado ocupa
do $$ declare d public.descansos; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  d := public.descanso_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'corto');
  begin
    perform public.focus_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'productivity', 'tanku');
    perform zz.reg('T-05 descanso bloquea Focus', false, 'no falló');
  exception when others then
    perform zz.reg('T-05 descanso bloquea Focus', sqlerrm = 'temporizador_ocupado', sqlerrm);
  end;
  d := public.descanso_pausar(gen_random_uuid(), zz.d1(), zz.sq(), d.id);
  begin
    perform public.focus_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'productivity', 'tanku');
    perform zz.reg('C-10 descanso pausado sigue ocupando', false, 'no falló');
  exception when others then
    perform zz.reg('C-10 descanso pausado sigue ocupando', sqlerrm = 'temporizador_ocupado', sqlerrm);
  end;
  perform public.descanso_omitir(gen_random_uuid(), zz.d1(), zz.sq(), 'largo');
  perform zz.reg('T-12 omitir no toca el bloqueo', (select estado from public.temporizador_activo) = 'pausado', null);
end $$;

-- T-06 completar libera; T-08 cancelar libera
do $$ declare s public.focus_sesiones; n int; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  s := public.focus_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'productivity', 'tanku');
  s := public.focus_completar(gen_random_uuid(), zz.d1(), zz.sq(), s.id);
  select count(*) into n from public.temporizador_activo;
  perform zz.reg('T-06 completar libera el bloqueo', n = 0, n::text);
  s := public.focus_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'productivity', 'tanku');
  s := public.focus_cancelar(gen_random_uuid(), zz.d1(), zz.sq(), s.id);
  select count(*) into n from public.temporizador_activo;
  perform zz.reg('T-08 cancelar libera el bloqueo y permite iniciar otro', n = 0 and (public.focus_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'productivity', 'tanku')).estado = 'en_curso', n::text);
end $$;

-- T-09 / T-10 escrituras directas denegadas
do $$ declare st text; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  begin delete from public.temporizador_activo; perform zz.reg('T-09 delete directo del bloqueo denegado', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('T-09 delete directo del bloqueo denegado', st = '42501', st); end;
  begin insert into public.focus_sesiones (modalidad, frente_id, duracion_objetivo_s, tramo_inicio) values ('productivity', 'tanku', 1800, now());
    perform zz.reg('T-10a insert directo en focus_sesiones denegado', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('T-10a insert directo en focus_sesiones denegado', st = '42501', st); end;
  begin update public.focus_sesiones set puntos = 1; perform zz.reg('T-10b update directo en focus_sesiones denegado', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('T-10b update directo en focus_sesiones denegado', st = '42501', st); end;
  begin insert into public.operaciones (op_id, dispositivo_id, seq, tipo, objetivo_tipo, ocurrido_en_dispositivo, resultado)
        values (gen_random_uuid(), zz.d1(), 1, 'focus_iniciar', 'focus', now(), 'aplicada');
    perform zz.reg('T-10c insert directo en operaciones denegado', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('T-10c insert directo en operaciones denegado', st = '42501', st); end;
end $$;

-- T-11 índice único parcial (como propietario)
do $$ declare st text; msg text; begin
  perform zz.limpiar(); perform zz.admin();
  insert into public.focus_sesiones (user_id, modalidad, frente_id, duracion_objetivo_s, tramo_inicio) values (zz.u1(), 'productivity', 'tanku', 1800, now());
  begin
    insert into public.focus_sesiones (user_id, modalidad, frente_id, duracion_objetivo_s, tramo_inicio) values (zz.u1(), 'productivity', 'tanku', 1800, now());
    perform zz.reg('T-11 índice único parcial de sesión activa', false, 'no falló');
  exception when unique_violation then
    get stacked diagnostics msg = constraint_name;
    perform zz.reg('T-11 índice único parcial de sesión activa', msg = 'focus_sesiones_una_activa', msg);
  end;
end $$;

-- S-01 / S-02 completada vs parcial
do $$ declare s public.focus_sesiones; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  s := public.focus_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'productivity', 'tanku');
  perform zz.admin(); update public.focus_sesiones set acumulado_s = 1800 where id = s.id; perform zz.como(zz.u1());
  s := public.focus_completar(gen_random_uuid(), zz.d1(), zz.sq(), s.id);
  perform zz.reg('S-01 1800 s = completada con 1 punto', s.estado = 'completada' and s.puntos = 1 and s.tiempo_efectivo_s = 1800, s.estado || '/' || s.puntos);
  s := public.focus_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'productivity', 'tanku');
  perform zz.admin(); update public.focus_sesiones set acumulado_s = 600 where id = s.id; perform zz.como(zz.u1());
  s := public.focus_completar(gen_random_uuid(), zz.d1(), zz.sq(), s.id);
  perform zz.reg('S-02 600 s = parcial sin punto', s.estado = 'parcial' and s.puntos = 0, s.estado || '/' || s.puntos);
end $$;

-- S-03 frontera de tolerancia
do $$ declare s public.focus_sesiones; x int; r text := ''; begin
  foreach x in array array[1797, 1798, 1799, 1800] loop
    perform zz.limpiar(); perform zz.como(zz.u1());
    s := public.focus_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'productivity', 'tanku');
    perform zz.admin(); update public.focus_sesiones set acumulado_s = x where id = s.id; perform zz.como(zz.u1());
    s := public.focus_completar(gen_random_uuid(), zz.d1(), zz.sq(), s.id);
    r := r || x || '=' || s.estado || ' ';
  end loop;
  perform zz.reg('S-03 frontera: 1797 parcial; 1798, 1799, 1800 completada', r = '1797=parcial 1798=completada 1799=completada 1800=completada ', r);
end $$;

-- S-04 cancelar conserva la fila
do $$ declare s public.focus_sesiones; n int; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  s := public.focus_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'productivity', 'tanku');
  s := public.focus_cancelar(gen_random_uuid(), zz.d1(), zz.sq(), s.id);
  select count(*) into n from public.focus_sesiones where id = s.id;
  perform zz.reg('S-04 cancelada se conserva, 0 puntos', s.estado = 'cancelada' and s.puntos = 0 and n = 1 and s.tiempo_efectivo_s is not null, s.estado);
end $$;

-- S-05 pausa conserva el tiempo; S-06 completar desde pausada
do $$ declare s public.focus_sesiones; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  s := public.focus_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'productivity', 'tanku');
  perform zz.admin(); update public.focus_sesiones set tramo_inicio = now() - interval '600 seconds' where id = s.id; perform zz.como(zz.u1());
  s := public.focus_pausar(gen_random_uuid(), zz.d1(), zz.sq(), s.id);
  perform zz.reg('S-05a pausa acumula 600 s', s.acumulado_s = 600 and s.estado = 'pausada' and s.tramo_inicio is null, s.acumulado_s::text);
  s := public.focus_reanudar(gen_random_uuid(), zz.d1(), zz.sq(), s.id);
  perform zz.admin(); update public.focus_sesiones set tramo_inicio = now() - interval '300 seconds' where id = s.id; perform zz.como(zz.u1());
  s := public.focus_completar(gen_random_uuid(), zz.d1(), zz.sq(), s.id);
  perform zz.reg('S-05b tiempo efectivo 900 s (la pausa no cuenta)', s.tiempo_efectivo_s = 900 and s.estado = 'parcial', s.tiempo_efectivo_s::text);
  s := public.focus_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'productivity', 'tanku');
  s := public.focus_pausar(gen_random_uuid(), zz.d1(), zz.sq(), s.id);
  s := public.focus_completar(gen_random_uuid(), zz.d1(), zz.sq(), s.id);
  perform zz.reg('S-06 completar desde pausada permitido', s.estado in ('parcial', 'completada'), s.estado);
end $$;

-- S-07 estado final definitivo; S-08 / S-09 conflictos
do $$ declare s public.focus_sesiones; s2 public.focus_sesiones; n int; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  s := public.focus_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'productivity', 'tanku');
  s := public.focus_completar(gen_random_uuid(), zz.d1(), zz.sq(), s.id);
  begin perform public.focus_pausar(gen_random_uuid(), zz.d1(), zz.sq(), s.id); perform zz.reg('S-07 pausar tras completar', false, 'no falló');
  exception when others then perform zz.reg('S-07 pausar tras completar -> transicion_invalida', sqlerrm = 'transicion_invalida', sqlerrm); end;
  s2 := public.focus_cancelar(gen_random_uuid(), zz.d1(), zz.sq(), s.id);
  select count(*) into n from public.operaciones where tipo = 'focus_cancelar' and resultado = 'conflicto';
  perform zz.reg('S-09 cancelar tras completar: sesión intacta y conflicto registrado', s2.estado <> 'cancelada' and n = 1, s2.estado || '/' || n);
  s := public.focus_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'productivity', 'tanku');
  s := public.focus_cancelar(gen_random_uuid(), zz.d1(), zz.sq(), s.id);
  s2 := public.focus_completar(gen_random_uuid(), zz.d1(), zz.sq(), s.id);
  select count(*) into n from public.operaciones where tipo = 'focus_completar' and resultado = 'conflicto';
  perform zz.reg('S-08 completar tras cancelar: sigue cancelada y conflicto registrado', s2.estado = 'cancelada' and n = 1, s2.estado || '/' || n);
end $$;

-- S-10 restricción de puntos (propietario)
do $$ declare s public.focus_sesiones; st text; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  s := public.focus_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'productivity', 'tanku');
  s := public.focus_completar(gen_random_uuid(), zz.d1(), zz.sq(), s.id);  -- parcial
  perform zz.admin();
  begin update public.focus_sesiones set puntos = 1 where id = s.id; perform zz.reg('S-10 puntos incoherentes rechazados', false, 'no falló');
  exception when check_violation then perform zz.reg('S-10 puntos incoherentes rechazados', true, sqlerrm); end;
end $$;

-- S-11 preferencias; S-12 frente inválido; S-13/14 pendiente
do $$ declare s public.focus_sesiones; p uuid; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  insert into public.preferencias_usuario (focus_min) values (25);
  s := public.focus_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'productivity', 'tanku');
  perform zz.reg('S-11 preferencias: 25 min = 1500 s', s.duracion_objetivo_s = 1500, s.duracion_objetivo_s::text);
  s := public.focus_completar(gen_random_uuid(), zz.d1(), zz.sq(), s.id);
  begin perform public.focus_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'productivity', 'x'); perform zz.reg('S-12 frente inválido', false, 'no falló');
  exception when others then perform zz.reg('S-12 frente inválido -> parametro_invalido', sqlerrm = 'parametro_invalido', sqlerrm); end;
  insert into public.pendientes (texto, frente) values ('mio', 'tanku') returning id into p;
  s := public.focus_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'productivity', 'tanku', null, null, p);
  perform zz.reg('S-13 sesión asociada a un pendiente propio', s.pendiente_id = p, null);
  s := public.focus_completar(gen_random_uuid(), zz.d1(), zz.sq(), s.id);
  perform zz.como(zz.u2());
  begin perform public.focus_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'productivity', 'tanku', null, null, p); perform zz.reg('S-14 pendiente ajeno', false, 'no falló');
  exception when others then perform zz.reg('S-14 pendiente ajeno -> pendiente_invalido', sqlerrm = 'pendiente_invalido', sqlerrm); end;
end $$;

-- Ciclos: helper para sembrar sesiones completadas (como propietario)
create or replace function zz.sembrar(n int, tipo text default 'completada') returns void language plpgsql as $$
declare i int;
begin
  for i in 1..n loop
    insert into public.focus_sesiones (user_id, modalidad, frente_id, duracion_objetivo_s, estado, puntos, iniciado_en, finalizado_en, tiempo_efectivo_s)
    values (zz.u1(), 'productivity', 'tanku', 1800, tipo, case when tipo = 'completada' then 1 else 0 end,
            now() - (interval '10 hours') + i * interval '1 hour' - interval '30 minutes', now() - (interval '10 hours') + i * interval '1 hour', 1800);
  end loop;
end $$;
grant execute on function zz.sembrar(int, text) to public;

-- C-01 / C-02 / C-03 / C-04 / C-07
do $$ declare c int; r text := ''; begin
  perform zz.limpiar(); perform zz.admin();
  perform zz.sembrar(4);
  r := r || public._ciclos_desde_ultimo_largo(zz.u1());
  perform zz.sembrar(1, 'parcial'); perform zz.sembrar(1, 'cancelada');
  r := r || ',' || public._ciclos_desde_ultimo_largo(zz.u1());
  perform zz.reg('C-01/C-02 4 completadas = 4; parciales y canceladas no cuentan', r = '4,4', r);
  perform zz.como(zz.u1());
  perform public.descanso_omitir(gen_random_uuid(), zz.d1(), zz.sq(), 'corto');
  perform zz.admin();
  perform zz.reg('C-07 omitir descanso corto no reinicia', public._ciclos_desde_ultimo_largo(zz.u1()) = 4, null);
  perform zz.como(zz.u1());
  perform public.descanso_omitir(gen_random_uuid(), zz.d1(), zz.sq(), 'largo');
  perform zz.admin();
  perform zz.reg('C-04 omitir descanso largo reinicia a 0', public._ciclos_desde_ultimo_largo(zz.u1()) = 0, null);
end $$;

-- C-03 descanso largo completado reinicia; C-09 cancelar largo en curso; C-11 completar antes de tiempo
do $$ declare d public.descansos; begin
  perform zz.limpiar(); perform zz.admin(); perform zz.sembrar(4); perform zz.como(zz.u1());
  d := public.descanso_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'largo');
  d := public.descanso_completar(gen_random_uuid(), zz.d1(), zz.sq(), d.id);
  perform zz.admin();
  perform zz.reg('C-03/C-11 largo completado (antes de tiempo) reinicia el contador', d.estado = 'completado' and public._ciclos_desde_ultimo_largo(zz.u1()) = 0, d.estado);
  perform zz.limpiar(); perform zz.admin(); perform zz.sembrar(4); perform zz.como(zz.u1());
  d := public.descanso_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'largo');
  d := public.descanso_cancelar(gen_random_uuid(), zz.d1(), zz.sq(), d.id);
  perform zz.admin();
  perform zz.reg('C-09 cancelar largo en curso = omitido(cancelado), contador 0, bloqueo libre',
    d.estado = 'omitido' and d.motivo_omision = 'cancelado' and public._ciclos_desde_ultimo_largo(zz.u1()) = 0 and (select count(*) from public.temporizador_activo) = 0, d.estado);
end $$;

-- C-05 iniciar Focus con 4 ciclos = omisión implícita; C-08 con 3 no; C-06 distintos días
do $$ declare s public.focus_sesiones; n int; m int; begin
  perform zz.limpiar(); perform zz.admin(); perform zz.sembrar(4); perform zz.como(zz.u1());
  s := public.focus_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'productivity', 'tanku');
  select count(*) into n from public.descansos where tipo = 'largo' and estado = 'omitido' and motivo_omision = 'inicio_focus';
  perform zz.admin();
  perform zz.reg('C-05 iniciar Focus con 4 ciclos registra omisión implícita y reinicia', n = 1 and public._ciclos_desde_ultimo_largo(zz.u1()) = 0, n::text);
  perform zz.limpiar(); perform zz.admin(); perform zz.sembrar(3); perform zz.como(zz.u1());
  s := public.focus_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'productivity', 'tanku');
  select count(*) into m from public.descansos;
  perform zz.reg('C-08 con 3 ciclos no hay omisión', m = 0, m::text);
  perform zz.limpiar(); perform zz.admin();
  insert into public.focus_sesiones (user_id, modalidad, frente_id, duracion_objetivo_s, estado, puntos, iniciado_en, finalizado_en, tiempo_efectivo_s)
  select zz.u1(), 'productivity', 'tanku', 1800, 'completada', 1, now() - (i * interval '1 day'), now() - (i * interval '1 day') + interval '30 minutes', 1800 from generate_series(0, 3) i;
  perform zz.reg('C-06 sesiones en 4 días distintos siguen sumando 4', public._ciclos_desde_ultimo_largo(zz.u1()) = 4, null);
end $$;

-- I-01 .. I-06 idempotencia
do $$ declare o uuid := gen_random_uuid(); s1 public.focus_sesiones; s2 public.focus_sesiones; n int; pts int; st text; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  s1 := public.focus_iniciar(o, zz.d1(), 10, 'productivity', 'tanku');
  s2 := public.focus_iniciar(o, zz.d1(), 10, 'productivity', 'tanku');
  select count(*) into n from public.focus_sesiones;
  perform zz.reg('I-01 mismo op_id dos veces: misma sesión, 1 fila', s1.id = s2.id and n = 1, n::text);
  perform zz.admin(); update public.focus_sesiones set acumulado_s = 1800 where id = s1.id; perform zz.como(zz.u1());
  o := gen_random_uuid();
  s1 := public.focus_completar(o, zz.d1(), 11, s1.id);
  s2 := public.focus_completar(o, zz.d1(), 11, s1.id);
  select sum(puntos) into pts from public.focus_sesiones;
  perform zz.reg('I-02 completar con el mismo op_id dos veces: 1 punto', pts = 1, pts::text);
  s2 := public.focus_completar(gen_random_uuid(), zz.d1(), zz.sq(), s1.id);
  select sum(puntos) into pts from public.focus_sesiones;
  select count(*) into n from public.operaciones where tipo = 'focus_completar' and resultado = 'duplicada';
  perform zz.reg('I-04 completar con otro op_id: duplicada y sigue 1 punto', pts = 1 and n = 1, pts || '/' || n);
  begin
    perform public.focus_iniciar(gen_random_uuid(), zz.d1(), 10, 'productivity', 'tanku');
    perform zz.reg('I-03 mismo (dispositivo, seq) con otro op_id', false, 'no falló');
  exception when unique_violation then perform zz.reg('I-03 mismo (dispositivo, seq) con otro op_id rechazado', true, sqlerrm);
  when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('I-03 mismo (dispositivo, seq) con otro op_id rechazado', st = '23505', sqlerrm);
  end;
end $$;

do $$ declare s public.focus_sesiones; n int; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  s := public.focus_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'productivity', 'tanku');
  s := public.focus_pausar(gen_random_uuid(), zz.d1(), zz.sq(), s.id);
  s := public.focus_pausar(gen_random_uuid(), zz.d1(), zz.sq(), s.id);
  select count(*) into n from public.operaciones where tipo = 'focus_pausar' and resultado = 'fusionada';
  perform zz.reg('I-05 pausar dos veces: segunda fusionada', n = 1, n::text);
  s := public.focus_reanudar(gen_random_uuid(), zz.d1(), zz.sq(), s.id);
  s := public.focus_reanudar(gen_random_uuid(), zz.d1(), zz.sq(), s.id);
  select count(*) into n from public.operaciones where tipo = 'focus_reanudar' and resultado = 'fusionada';
  perform zz.reg('I-06 reanudar en curso: fusionada', n = 1, n::text);
end $$;

-- I-09 notificada
do $$ declare n int; st text; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  perform public.focus_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'productivity', 'tanku');
  update public.operaciones set notificada = true;
  get diagnostics n = row_count;
  perform zz.reg('I-09a marcar notificada permitido', n = 1, n::text);
  begin update public.operaciones set motivo = 'x'; perform zz.reg('I-09b otras columnas denegadas', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('I-09b otras columnas denegadas', st = '42501', st); end;
end $$;

-- X: seguridad y aislamiento
do $$ declare s public.focus_sesiones; n int; st text; t text; r text := ''; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  s := public.focus_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'productivity', 'tanku');
  perform zz.como(zz.u2());
  foreach t in array array['focus_sesiones', 'descansos', 'operaciones', 'temporizador_activo', 'preferencias_usuario', 'cambios_registro'] loop
    execute format('select count(*) from public.%I', t) into n;
    r := r || t || '=' || n || ' ';
  end loop;
  perform zz.reg('X-01 U2 no ve filas de U1 en las tablas nuevas', r !~ '=[1-9]', r);
  begin perform public.focus_pausar(gen_random_uuid(), zz.d2(), zz.sq(), s.id); perform zz.reg('X-02 sesión ajena', false, 'no falló');
  exception when others then perform zz.reg('X-02 sesión ajena -> sesion_no_encontrada', sqlerrm = 'sesion_no_encontrada', sqlerrm); end;
  begin insert into public.preferencias_usuario (user_id, focus_min) values (zz.u1(), 10); perform zz.reg('X-11 insertar para otro usuario', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('X-11 insertar para otro usuario denegado', st = '42501', st); end;
end $$;

do $$ declare st text; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  set local role anon;
  begin perform public.focus_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'productivity', 'tanku'); perform zz.reg('X-05 anon no ejecuta RPC', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('X-05 anon no ejecuta RPC', st = '42501', st); end;
  perform zz.como(zz.u1());
  begin perform public._uid(); perform zz.reg('X-06a authenticated no ejecuta _uid', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('X-06a authenticated no ejecuta _uid', st = '42501', st); end;
  begin perform public._journal(zz.u1(), gen_random_uuid(), zz.d1(), 1, 'focus_iniciar', 'focus', null, '{}'::jsonb, 'aplicada', null); perform zz.reg('X-06b authenticated no ejecuta _journal', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('X-06b authenticated no ejecuta _journal', st = '42501', st); end;
  perform zz.como(zz.u1());
  perform set_config('request.jwt.claims', '', true);
  begin perform public.focus_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'productivity', 'tanku'); perform zz.reg('X-07 sin sesión', false, 'no falló');
  exception when others then perform zz.reg('X-07 sin sesión -> no_autenticado', sqlerrm = 'no_autenticado', sqlerrm); end;
end $$;

do $$ declare r text; n int; begin
  perform zz.admin();
  select string_agg(p.proname, ',') into r from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.prosecdef
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c in ('search_path=""', 'search_path=') );
  perform zz.reg('X-08 toda función SECURITY DEFINER fija search_path vacío', r is null, r);
  select string_agg(c.relname, ',') into r from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and not c.relrowsecurity;
  perform zz.reg('X-10 todas las tablas públicas tienen RLS', r is null, r);
  select count(*) into n from information_schema.routine_privileges where routine_schema = 'public' and grantee = 'anon' and privilege_type = 'EXECUTE' and routine_name not like 'zz%';
  perform zz.reg('X-05b anon sin EXECUTE explícito en funciones públicas', n = 0, n::text);
end $$;

select caso, ok, detalle from zz.res order by id;
