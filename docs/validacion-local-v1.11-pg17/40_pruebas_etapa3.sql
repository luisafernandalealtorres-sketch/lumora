-- Pruebas de la etapa 3 (hábitos, segmentos, registro manual, seguridad). Las fechas se calculan respecto a hoy.
\set ON_ERROR_STOP 0
delete from zz.res;

create or replace function zz.hoy() returns date language sql stable as $$ select (now() at time zone 'America/Bogota')::date $$;
-- Último viernes entre 7 y 13 días atrás (así el sábado siguiente también es pasado).
create or replace function zz.f() returns date language sql stable as $$
  select zz.hoy() - 7 - ((extract(isodow from zz.hoy())::int + 2) % 7) $$;
create or replace function zz.ts(p_fecha date, p_hhmm text) returns timestamptz language sql stable as $$
  select ((p_fecha::text || ' ' || p_hhmm)::timestamp) at time zone 'America/Bogota' $$;
create or replace function zz.hab(p_user uuid, p_modo text, p_frec text, p_dias smallint[], p_desde date) returns uuid language plpgsql as $$
declare v uuid;
begin
  insert into public.habitos_config (user_id, nombre, modo_registro) values (p_user, 'h', p_modo) returning id into v;
  insert into public.habitos_config_versiones (habito_id, user_id, vigente_desde, frecuencia, dias_semana, objetivo_s)
  values (v, p_user, p_desde, p_frec, p_dias, 2700);
  return v;
end $$;
create or replace function zz.tmr(p_user uuid, p_hab uuid, p_inicio timestamptz) returns public.habito_temporizadores language plpgsql as $$
declare t public.habito_temporizadores;
begin
  insert into public.habito_temporizadores (user_id, habito_id, tramo_inicio) values (p_user, p_hab, p_inicio) returning * into t;
  return t;
end $$;
grant execute on all functions in schema zz to public;

-- W-01 / W-02 ocurrencias por calendario
do $$ declare f date := zz.f(); h1 uuid; h2 uuid; r text := ''; begin
  perform zz.limpiar(); perform zz.admin();
  h1 := zz.hab(zz.u1(), 'manual', 'dias', array[0, 2, 4]::smallint[], f - 60);   -- lun, mié, vie
  h2 := zz.hab(zz.u1(), 'manual', 'diaria', '{}'::smallint[], f - 60);
  r := r || public._hay_ocurrencia(h1, f)::int;       -- viernes: sí
  r := r || public._hay_ocurrencia(h1, f + 1)::int;   -- sábado: no
  r := r || public._hay_ocurrencia(h1, f + 3)::int;   -- lunes: sí
  r := r || public._hay_ocurrencia(h1, f + 4)::int;   -- martes: no
  r := r || public._hay_ocurrencia(h1, f + 5)::int;   -- miércoles: sí
  r := r || public._hay_ocurrencia(h1, f - 70)::int;  -- antes de la vigencia: no
  r := r || public._hay_ocurrencia(h2, f + 1)::int || public._hay_ocurrencia(h2, f + 2)::int;
  perform zz.reg('W-01/02 ocurrencias lun/mié/vie y diaria; ninguna antes de la vigencia', r = '10101011', r);
end $$;

-- W-03 ejemplo D3-23: viernes programado, sábado no
do $$ declare f date := zz.f(); h uuid; t public.habito_temporizadores; a int; b int; c int; d int; sat int; begin
  perform zz.limpiar(); perform zz.admin();
  h := zz.hab(zz.u1(), 'temporizador', 'dias', array[4]::smallint[], f - 60);
  t := zz.tmr(zz.u1(), h, zz.ts(f, '23:30'));
  perform public._cerrar_tramo(zz.u1(), t, zz.ts(f + 1, '00:30'), gen_random_uuid(), zz.d1());
  select segundos into a from public.habito_segmentos where habito_id = h and fecha = f and acreditado;
  select segundos into b from public.habito_segmentos where habito_id = h and fecha = f + 1 and not acreditado;
  select temporizador_s into c from public.habito_tiempo where habito_id = h and fecha = f;
  select count(*) into sat from public.habito_tiempo where habito_id = h and fecha = f + 1;
  perform zz.reg('W-03 viernes 1800 s acreditado; sábado 1800 s conservado sin acreditar; sin habito_tiempo del sábado', a = 1800 and b = 1800 and c = 1800 and sat = 0, a || '/' || b || '/' || c || '/' || sat);
end $$;

-- W-04 ambos días programados; W-05 dos medianoches
do $$ declare f date := zz.f(); h uuid; t public.habito_temporizadores; r text; begin
  perform zz.limpiar(); perform zz.admin();
  h := zz.hab(zz.u1(), 'temporizador', 'dias', array[4, 5]::smallint[], f - 60);
  t := zz.tmr(zz.u1(), h, zz.ts(f, '23:30'));
  perform public._cerrar_tramo(zz.u1(), t, zz.ts(f + 1, '00:30'), gen_random_uuid(), zz.d1());
  select string_agg(fecha - f || ':' || temporizador_s, ',' order by fecha) into r from public.habito_tiempo where habito_id = h;
  perform zz.reg('W-04 dos días programados: ambos acreditan 1800', r = '0:1800,1:1800', r);
  perform zz.limpiar(); perform zz.admin();
  h := zz.hab(zz.u1(), 'temporizador', 'diaria', '{}'::smallint[], f - 60);
  t := zz.tmr(zz.u1(), h, zz.ts(f, '22:00'));
  perform public._cerrar_tramo(zz.u1(), t, zz.ts(f + 2, '01:00'), gen_random_uuid(), zz.d1());
  select string_agg(fecha - f || ':' || segundos, ',' order by fecha) into r from public.habito_segmentos where habito_id = h;
  perform zz.reg('W-05 dos medianoches: 7200, 86400 y 3600 s', r = '0:7200,1:86400,2:3600', r);
end $$;

-- W-06 manual reemplaza; W-07 temporizador tras manual acumula; I-08 idempotencia del manual
do $$ declare f date := zz.f(); h uuid; t public.habito_temporizadores; o uuid := gen_random_uuid();
              ht public.habito_tiempo; n int; rep int; ant int; nuevo int; begin
  perform zz.limpiar(); perform zz.admin();
  h := zz.hab(zz.u1(), 'temporizador', 'diaria', '{}'::smallint[], f - 60);
  t := zz.tmr(zz.u1(), h, zz.ts(f, '10:00'));
  perform public._cerrar_tramo(zz.u1(), t, zz.ts(f, '10:10'), gen_random_uuid(), zz.d1());   -- 600 s
  update public.habito_temporizadores set estado = 'finalizado', tramo_inicio = null, finalizado_en = now() where id = t.id;
  perform zz.como(zz.u1());
  ht := public.habito_registrar_manual(o, zz.d1(), zz.sq(), h, f, 1200);
  perform zz.reg('W-06a manual reemplaza: manual 1200, temporizador 0, fuente manual', ht.manual_s = 1200 and ht.temporizador_s = 0 and ht.fuente = 'manual', ht.manual_s || '/' || ht.temporizador_s);
  select count(*) into rep from public.habito_segmentos where habito_id = h and fecha = f and reemplazado_en is not null;
  select valor_anterior_s, valor_nuevo_s into ant, nuevo from public.habito_tiempo_historial where habito_id = h and fecha = f and fuente = 'manual';
  perform zz.reg('W-06b segmentos marcados reemplazados; historial 600 -> 1200', rep = 1 and ant = 600 and nuevo = 1200, rep || '/' || ant || '/' || nuevo);
  perform public.habito_registrar_manual(o, zz.d1(), zz.sq(), h, f, 1200);
  select count(*) into n from public.habito_tiempo_historial where habito_id = h and fecha = f and fuente = 'manual';
  perform zz.reg('I-08 manual repetido con el mismo op_id: 1 fila de historial', n = 1, n::text);
  perform zz.admin();
  t := zz.tmr(zz.u1(), h, zz.ts(f, '11:00'));
  perform public._cerrar_tramo(zz.u1(), t, zz.ts(f, '11:10'), gen_random_uuid(), zz.d1());   -- +600 s
  select * into ht from public.habito_tiempo where habito_id = h and fecha = f;
  select valor_anterior_s, valor_nuevo_s into ant, nuevo from public.habito_tiempo_historial where habito_id = h and fecha = f and fuente = 'temporizador' and valor_nuevo_s = 1800;
  perform zz.reg('W-07 temporizador tras manual acumula: 1200 + 600 = 1800', ht.manual_s = 1200 and ht.temporizador_s = 600 and ht.fuente = 'temporizador' and nuevo = 1800 and ant = 1200, ht.manual_s || '/' || ht.temporizador_s || '/' || ant || '/' || nuevo);
end $$;

-- W-08 / W-09 / W-16 / X-03 validaciones del registro manual
do $$ declare f date := zz.f(); h uuid; hu1 uuid; begin
  perform zz.limpiar(); perform zz.admin();
  h := zz.hab(zz.u1(), 'manual', 'dias', array[4]::smallint[], f - 60);
  perform zz.como(zz.u1());
  begin perform public.habito_registrar_manual(gen_random_uuid(), zz.d1(), zz.sq(), h, f + 1, 600); perform zz.reg('W-08 manual sin ocurrencia', false, 'no falló');
  exception when others then perform zz.reg('W-08 manual en fecha sin ocurrencia -> sin_ocurrencia', sqlerrm = 'sin_ocurrencia', sqlerrm); end;
  begin perform public.habito_registrar_manual(gen_random_uuid(), zz.d1(), zz.sq(), h, zz.hoy() + 1, 600); perform zz.reg('W-09 manual futuro', false, 'no falló');
  exception when others then perform zz.reg('W-09 manual en fecha futura -> fecha_no_permitida', sqlerrm = 'fecha_no_permitida', sqlerrm); end;
  begin perform public.habito_registrar_manual(gen_random_uuid(), zz.d1(), zz.sq(), h, f, -5); perform zz.reg('W-09b segundos negativos', false, 'no falló');
  exception when others then perform zz.reg('W-09b segundos negativos -> parametro_invalido', sqlerrm = 'parametro_invalido', sqlerrm); end;
  perform zz.como(zz.u2());
  begin perform public.habito_registrar_manual(gen_random_uuid(), zz.d2(), zz.sq(), h, f, 600); perform zz.reg('X-03a hábito ajeno', false, 'no falló');
  exception when others then perform zz.reg('X-03a hábito ajeno -> habito_invalido', sqlerrm = 'habito_invalido', sqlerrm); end;
end $$;

-- W-10 / W-11 / W-12 programación hacia delante
do $$ declare h uuid; v public.habitos_config_versiones; hoy date := zz.hoy(); r text := ''; begin
  perform zz.limpiar(); perform zz.admin();
  h := zz.hab(zz.u1(), 'manual', 'diaria', '{}'::smallint[], hoy - 30);
  perform zz.como(zz.u1());
  begin perform public.habito_programar(h, 'diaria', '{}'::smallint[], 1800, hoy - 1); perform zz.reg('W-10 programar con vigencia pasada', false, 'no falló');
  exception when others then perform zz.reg('W-10 vigencia pasada -> fecha_no_permitida', sqlerrm = 'fecha_no_permitida', sqlerrm); end;
  v := public.habito_programar(h, 'dias', array[(extract(isodow from hoy + 1)::int - 1)::smallint, 9, ((extract(isodow from hoy + 1)::int) % 7)::smallint, (extract(isodow from hoy + 1)::int - 1)::smallint]::smallint[], 1800, hoy + 1);
  perform zz.reg('W-11a nueva versión desde mañana: dias normalizados (sin 9 ni duplicados)', v.vigente_desde = hoy + 1 and cardinality(v.dias_semana) = 2, v.dias_semana::text);
  perform zz.admin();
  r := r || public._hay_ocurrencia(h, hoy)::int || public._hay_ocurrencia(h, hoy + 1)::int;
  perform zz.reg('W-11b las ocurrencias anteriores no cambian', r = '11', r);
  perform zz.como(zz.u1());
  begin perform public.habito_programar(h, 'diaria', '{}'::smallint[], 1800, hoy + 1); perform zz.reg('W-12 misma vigencia', false, 'no falló');
  exception when others then perform zz.reg('W-12 misma vigencia -> version_existente', sqlerrm = 'version_existente', sqlerrm); end;
  begin perform public.habito_programar(h, 'dias', '{}'::smallint[], 1800, hoy + 2); perform zz.reg('W-12b dias vacío con frecuencia dias', false, 'no falló');
  exception when others then perform zz.reg('W-12b frecuencia dias sin días -> parametro_invalido', sqlerrm = 'parametro_invalido', sqlerrm); end;
end $$;

-- W-13 archivado
do $$ declare f date := zz.f(); h uuid; r text := ''; begin
  perform zz.limpiar(); perform zz.admin();
  h := zz.hab(zz.u1(), 'manual', 'diaria', '{}'::smallint[], f - 60);
  update public.habitos_config set archivado_desde = f + 3 where id = h;
  r := r || public._hay_ocurrencia(h, f + 2)::int || public._hay_ocurrencia(h, f + 3)::int;
  perform zz.reg('W-13 archivado: ocurrencia hasta el día anterior', r = '10', r);
end $$;

-- W-14 cancelar conserva tramos cerrados; W-15 modo manual; W-16 ajeno; W-17/T-04 exclusividad con Focus
do $$ declare f date := zz.f(); h uuid; hm uuid; t public.habito_temporizadores; tot int; n int; s public.focus_sesiones; begin
  perform zz.limpiar(); perform zz.admin();
  h := zz.hab(zz.u1(), 'temporizador', 'diaria', '{}'::smallint[], f - 60);
  hm := zz.hab(zz.u1(), 'manual', 'diaria', '{}'::smallint[], f - 60);
  perform zz.como(zz.u1());
  t := public.habito_timer_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), h);
  perform zz.admin(); update public.habito_temporizadores set tramo_inicio = now() - interval '600 seconds' where id = t.id; perform zz.como(zz.u1());
  t := public.habito_timer_pausar(gen_random_uuid(), zz.d1(), zz.sq(), t.id);
  t := public.habito_timer_reanudar(gen_random_uuid(), zz.d1(), zz.sq(), t.id);
  perform zz.admin(); update public.habito_temporizadores set tramo_inicio = now() - interval '300 seconds' where id = t.id; perform zz.como(zz.u1());
  t := public.habito_timer_cancelar(gen_random_uuid(), zz.d1(), zz.sq(), t.id);
  select sum(temporizador_s) into tot from public.habito_tiempo where habito_id = h;
  select count(*) into n from public.temporizador_activo;
  perform zz.reg('W-14 cancelar descarta el tramo en curso (300 s) y conserva el cerrado (600 s); bloqueo libre', tot = 600 and n = 0 and t.estado = 'cancelado', tot || '/' || n || '/' || t.estado);
  begin perform public.habito_timer_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), hm); perform zz.reg('W-15 timer en hábito manual', false, 'no falló');
  exception when others then perform zz.reg('W-15 hábito en modo manual -> modo_no_temporizador', sqlerrm = 'modo_no_temporizador', sqlerrm); end;
  s := public.focus_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'productivity', 'tanku');
  begin perform public.habito_timer_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), h); perform zz.reg('W-17 Focus activo bloquea hábito', false, 'no falló');
  exception when others then perform zz.reg('W-17 Focus activo bloquea el timer de hábito', sqlerrm = 'temporizador_ocupado', sqlerrm); end;
  s := public.focus_pausar(gen_random_uuid(), zz.d1(), zz.sq(), s.id);
  begin perform public.habito_timer_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), h); perform zz.reg('T-04 Focus pausado bloquea hábito', false, 'no falló');
  exception when others then perform zz.reg('T-04 Focus pausado bloquea el timer de hábito', sqlerrm = 'temporizador_ocupado', sqlerrm); end;
  s := public.focus_cancelar(gen_random_uuid(), zz.d1(), zz.sq(), s.id);
  t := public.habito_timer_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), h);
  begin perform public.focus_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'productivity', 'tanku'); perform zz.reg('T-04b hábito bloquea Focus', false, 'no falló');
  exception when others then perform zz.reg('T-04b timer de hábito bloquea Focus', sqlerrm = 'temporizador_ocupado', sqlerrm); end;
  perform zz.como(zz.u2());
  begin perform public.habito_timer_pausar(gen_random_uuid(), zz.d2(), zz.sq(), t.id); perform zz.reg('X-03b temporizador ajeno', false, 'no falló');
  exception when others then perform zz.reg('X-03b temporizador ajeno -> temporizador_no_encontrado', sqlerrm = 'temporizador_no_encontrado', sqlerrm); end;
  begin perform public.habito_timer_iniciar(gen_random_uuid(), zz.d2(), zz.sq(), h); perform zz.reg('W-16 hábito ajeno', false, 'no falló');
  exception when others then perform zz.reg('W-16 hábito ajeno -> habito_invalido', sqlerrm = 'habito_invalido', sqlerrm); end;
end $$;

-- C-12 iniciar un hábito con descanso largo pendiente no cuenta como omitir
do $$ declare f date := zz.f(); h uuid; n int; begin
  perform zz.limpiar(); perform zz.admin(); perform zz.sembrar(4);
  h := zz.hab(zz.u1(), 'temporizador', 'diaria', '{}'::smallint[], f - 60);
  perform zz.como(zz.u1());
  perform public.habito_timer_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), h);
  select count(*) into n from public.descansos;
  perform zz.reg('C-12 iniciar un hábito no omite el descanso largo', n = 0, n::text);
end $$;

-- X-09 columnas de habitos_config
do $$ declare f date := zz.f(); h uuid; st text; n int; begin
  perform zz.limpiar(); perform zz.admin();
  h := zz.hab(zz.u1(), 'manual', 'diaria', '{}'::smallint[], f - 60);
  perform zz.como(zz.u1());
  update public.habitos_config set nombre = 'nuevo nombre' where id = h;
  get diagnostics n = row_count;
  perform zz.reg('X-09a renombrar un hábito permitido', n = 1, n::text);
  begin update public.habitos_config set archivado_desde = zz.hoy() where id = h; perform zz.reg('X-09b archivado_desde directo denegado', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('X-09b archivado_desde directo denegado', st = '42501', st); end;
  begin insert into public.habitos_config (nombre, modo_registro) values ('x', 'manual'); perform zz.reg('X-09c insert directo denegado', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('X-09c insert directo denegado', st = '42501', st); end;
end $$;

-- Objetivos semanales (restricciones de la tabla; semanas relativas a hoy porque T-7 rechaza las pasadas)
do $$ declare st text; l date := public.lunes_semana_bogota(now()); begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  insert into public.objetivos_atencion (semana_inicio, frente_id, puntos) values (l, 'tanku', 5);
  perform zz.reg('O-01 objetivo en lunes (semana actual) aceptado', true, null);
  begin insert into public.objetivos_atencion (semana_inicio, frente_id, puntos) values (l + 8, 'tanku', 5); perform zz.reg('O-02 martes', false, 'no falló');
  exception when check_violation then perform zz.reg('O-02 semana_inicio que no es lunes rechazada', true, sqlerrm); end;
  begin insert into public.objetivos_atencion (semana_inicio, frente_id, puntos) values (l, 'x', 5); perform zz.reg('O-03 frente inválido', false, 'no falló');
  exception when check_violation then perform zz.reg('O-03 frente inválido rechazado', true, sqlerrm); end;
  begin insert into public.objetivos_atencion (semana_inicio, frente_id, puntos) values (l, 'salud', -1); perform zz.reg('O-04 puntos negativos', false, 'no falló');
  exception when check_violation then perform zz.reg('O-04 puntos negativos rechazados', true, sqlerrm); end;
end $$;
-- habito_crear (firma vigente del documento)
do $$ declare h public.habitos_config; n int; arr text; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  begin perform public.habito_crear(gen_random_uuid(), zz.d1(), zz.sq(), '  ', 'manual', 'diaria', '{}'::smallint[], 1800); perform zz.reg('K-01 nombre vacío', false, 'no falló');
  exception when others then perform zz.reg('K-01 nombre vacío -> parametro_invalido', sqlerrm = 'parametro_invalido', sqlerrm); end;
  begin perform public.habito_crear(gen_random_uuid(), zz.d1(), zz.sq(), 'x', 'manual', 'diaria', '{}'::smallint[], 1800, zz.hoy() - 1); perform zz.reg('K-02 vigencia pasada', false, 'no falló');
  exception when others then perform zz.reg('K-02 vigencia pasada -> fecha_no_permitida', sqlerrm = 'fecha_no_permitida', sqlerrm); end;
  h := public.habito_crear(gen_random_uuid(), zz.d1(), zz.sq(), 'Correr', 'temporizador', 'dias', array[0, 2, 4, 4]::smallint[], 2700);
  select dias_semana::text into arr from public.habitos_config_versiones where habito_id = h.id;
  perform zz.reg('K-03 habito_crear con días duplicados se normaliza', arr = '{0,2,4}', arr);
  declare o uuid := gen_random_uuid(); h1 public.habitos_config; h2 public.habitos_config; sq bigint := zz.sq(); nn int; nv int;
  begin
    h1 := public.habito_crear(o, zz.d1(), sq, 'Leer', 'manual', 'diaria', '{}'::smallint[], 3600);
    h2 := public.habito_crear(o, zz.d1(), sq, 'Leer', 'manual', 'diaria', '{}'::smallint[], 3600);
    select count(*) into nn from public.habitos_config where nombre = 'Leer';
    select count(*) into nv from public.habitos_config_versiones where habito_id = h1.id;
    perform zz.reg('K-04 habito_crear con el mismo op_id no duplica (idempotente)', h1.id = h2.id and nn = 1 and nv = 1, h1.id || '/' || h2.id || '/' || nn || '/' || nv);
  end;
end $$;

select caso, ok, detalle from zz.res order by id;
