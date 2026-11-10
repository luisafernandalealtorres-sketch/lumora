-- T-6: prioridad vigente al CIERRE del día de vencimiento (America/Bogota), reconstruida desde cambios_registro.
-- Los instantes de los eventos se fijan como propietario (cambios_registro es de solo lectura para el cliente).
\set ON_ERROR_STOP 0
delete from zz.res;

-- Ayudantes (solo en la base de prueba)
create or replace function zz.nuevo_pend(p_prio text) returns uuid language plpgsql as $$
declare v uuid;
begin
  perform zz.como(zz.u1());
  insert into public.pendientes (texto, frente, prioridad) values ('t6', 'tanku', p_prio) returning id into v;
  return v;
end $$;
-- Fija el instante del evento n-ésimo de prioridad (por seq) y el de la creación.
create or replace function zz.t_evento(p_reg uuid, p_n int, p_ts timestamptz) returns void language plpgsql as $$
begin
  perform zz.admin();
  update public.cambios_registro c set cambiado_en = p_ts
   where c.id = (select x.id from public.cambios_registro x where x.registro_id = p_reg and x.campo = 'prioridad' order by x.seq offset p_n - 1 limit 1);
end $$;
create or replace function zz.t_creado(p_reg uuid, p_ts timestamptz) returns void language plpgsql as $$
begin
  perform zz.admin();
  update public.cambios_registro set cambiado_en = p_ts where registro_id = p_reg and evento = 'creado';
end $$;
create or replace function zz.p6(p_tabla text, p_reg uuid, p_fecha date) returns text language plpgsql as $$
begin
  perform zz.como(zz.u1());
  return public.prioridad_en_cierre(p_tabla, p_reg, p_fecha);
end $$;
grant execute on all functions in schema zz to public;

-- T6-01 cambio ANTES del día de vencimiento
do $$ declare p uuid; d date := '2026-03-10'; r text; begin
  perform zz.limpiar(); p := zz.nuevo_pend('media');
  perform zz.admin(); perform zz.t_creado(p, '2026-03-01 12:00-05');
  perform zz.como(zz.u1()); update public.pendientes set prioridad = 'alta' where id = p;
  perform zz.t_evento(p, 1, '2026-03-07 10:00-05');
  r := zz.p6('pendientes', p, d);
  perform zz.reg('T6-01 cambio antes del vencimiento: cuenta (alta)', r = 'alta', r);
end $$;

-- T6-02 cambio DURANTE el día de vencimiento
do $$ declare p uuid; d date := '2026-03-10'; r text; begin
  perform zz.limpiar(); p := zz.nuevo_pend('media');
  perform zz.como(zz.u1()); update public.pendientes set prioridad = 'baja' where id = p;
  perform zz.t_evento(p, 1, '2026-03-10 10:00-05');
  r := zz.p6('pendientes', p, d);
  perform zz.reg('T6-02 cambio durante el día de vencimiento: cuenta (baja)', r = 'baja', r);
end $$;

-- T6-03 cambio a las 23:00 de Bogotá del día de vencimiento
do $$ declare p uuid; d date := '2026-03-10'; r text; begin
  perform zz.limpiar(); p := zz.nuevo_pend('alta');
  perform zz.como(zz.u1()); update public.pendientes set prioridad = 'baja' where id = p;
  perform zz.t_evento(p, 1, '2026-03-10 23:00-05');
  r := zz.p6('pendientes', p, d);
  perform zz.reg('T6-03 cambio a las 23:00 Bogotá del día de vencimiento: cuenta (baja)', r = 'baja', r);
end $$;

-- T6-04 cambio al día siguiente: NO altera el peso histórico
do $$ declare p uuid; d date := '2026-03-10'; r text; begin
  perform zz.limpiar(); p := zz.nuevo_pend('media');
  perform zz.t_creado(p, '2026-03-01 12:00-05');
  perform zz.como(zz.u1()); update public.pendientes set prioridad = 'baja' where id = p;
  perform zz.t_evento(p, 1, '2026-03-11 09:00-05');
  r := zz.p6('pendientes', p, d);
  perform zz.reg('T6-04 cambio al día siguiente: NO cuenta (media)', r = 'media', r);
end $$;

-- T6-05 límites UTC del corte (00:00 del día siguiente en Bogotá = 05:00 UTC)
do $$ declare p uuid; d date := '2026-03-10'; r1 text; r2 text; r3 text; begin
  perform zz.limpiar();
  p := zz.nuevo_pend('media'); perform zz.t_creado(p, '2026-03-01 12:00-05');
  perform zz.como(zz.u1()); update public.pendientes set prioridad = 'baja' where id = p;
  perform zz.t_evento(p, 1, '2026-03-11 04:59:59.999+00');
  r1 := zz.p6('pendientes', p, d);
  perform zz.reg('T6-05a cambio a las 04:59:59.999 UTC del día siguiente (23:59:59.999 Bogotá): cuenta', r1 = 'baja', r1);
  perform zz.limpiar();
  p := zz.nuevo_pend('media'); perform zz.t_creado(p, '2026-03-01 12:00-05');
  perform zz.como(zz.u1()); update public.pendientes set prioridad = 'baja' where id = p;
  perform zz.t_evento(p, 1, '2026-03-11 05:00:00+00');
  r2 := zz.p6('pendientes', p, d);
  perform zz.reg('T6-05b cambio a las 05:00:00 UTC (00:00 Bogotá, el corte): NO cuenta', r2 = 'media', r2);
  perform zz.limpiar();
  p := zz.nuevo_pend('media'); perform zz.t_creado(p, '2026-03-01 12:00-05');
  perform zz.como(zz.u1()); update public.pendientes set prioridad = 'baja' where id = p;
  perform zz.t_evento(p, 1, '2026-03-11 05:00:00.001+00');
  r3 := zz.p6('pendientes', p, d);
  perform zz.reg('T6-05c cambio a las 05:00:00.001 UTC: NO cuenta', r3 = 'media', r3);
end $$;

-- T6-06 varios cambios alrededor del cierre
do $$ declare p uuid; d date := '2026-03-10'; r text; begin
  perform zz.limpiar(); p := zz.nuevo_pend('alta');
  perform zz.t_creado(p, '2026-03-01 12:00-05');
  perform zz.como(zz.u1());
  update public.pendientes set prioridad = 'media' where id = p;
  update public.pendientes set prioridad = 'baja' where id = p;
  update public.pendientes set prioridad = 'alta' where id = p;
  perform zz.t_evento(p, 1, '2026-03-10 08:00-05');
  perform zz.t_evento(p, 2, '2026-03-10 23:30-05');
  perform zz.t_evento(p, 3, '2026-03-11 01:00-05');
  r := zz.p6('pendientes', p, d);
  perform zz.reg('T6-06 alta→media (08:00), media→baja (23:30), baja→alta (día siguiente 01:00): cuenta baja', r = 'baja', r);
end $$;

-- T6-07 varios cambios con el MISMO instante: manda el orden (seq)
do $$ declare p uuid; d date := '2026-03-10'; r text; actual text; begin
  perform zz.limpiar(); p := zz.nuevo_pend('media');
  perform zz.como(zz.u1());
  update public.pendientes set prioridad = 'alta' where id = p;
  update public.pendientes set prioridad = 'baja' where id = p;
  update public.pendientes set prioridad = 'alta' where id = p;
  perform zz.admin();
  update public.cambios_registro set cambiado_en = '2026-03-10 12:00-05' where registro_id = p and campo = 'prioridad';
  r := zz.p6('pendientes', p, d);
  select prioridad into actual from public.pendientes where id = p;
  perform zz.reg('T6-07 tres cambios en el mismo instante: gana el último por seq (alta)', r = 'alta' and r = actual, r || '/' || actual);
end $$;

-- T6-08 reproducibilidad: un cambio posterior al cierre no altera el resultado histórico
do $$ declare p uuid; d date := '2026-03-10'; a text; b text; c text; begin
  perform zz.limpiar(); p := zz.nuevo_pend('media');
  perform zz.t_creado(p, '2026-03-01 12:00-05');
  perform zz.como(zz.u1()); update public.pendientes set prioridad = 'baja' where id = p;
  perform zz.t_evento(p, 1, '2026-03-10 20:00-05');
  a := zz.p6('pendientes', p, d);
  b := zz.p6('pendientes', p, d);
  perform zz.como(zz.u1());
  update public.pendientes set prioridad = 'alta' where id = p;          -- cambio hoy, muy posterior al cierre
  update public.pendientes set prioridad = 'media' where id = p;
  c := zz.p6('pendientes', p, d);
  perform zz.reg('T6-08 reproducible: dos lecturas iguales y sin alteración por cambios posteriores (baja)', a = 'baja' and b = 'baja' and c = 'baja', a || '/' || b || '/' || c);
end $$;

-- T6-09 sin cambios: instantánea de creación; T6-10 sin historial: prioridad actual; T6-11 eliminado; T6-12 sin nada
do $$ declare p uuid; d date := '2026-03-10'; r text; begin
  perform zz.limpiar(); p := zz.nuevo_pend('alta');
  r := zz.p6('pendientes', p, d);
  perform zz.reg('T6-09 sin cambios de prioridad: la de la instantánea de creación (alta)', r = 'alta', r);
  perform zz.admin(); delete from public.cambios_registro where registro_id = p;
  r := zz.p6('pendientes', p, d);
  perform zz.reg('T6-10 sin historial: respaldo = prioridad actual de la fila (alta)', r = 'alta', r);
  perform zz.como(zz.u1()); delete from public.pendientes where id = p;
  perform zz.admin(); delete from public.cambios_registro where registro_id = p and evento = 'creado';
  r := zz.p6('pendientes', p, d);
  perform zz.reg('T6-11 compromiso eliminado: instantánea de eliminación (alta)', r = 'alta', r);
  perform zz.admin(); delete from public.cambios_registro where registro_id = p;
  r := zz.p6('pendientes', p, d);
  perform zz.reg('T6-12 sin historial ni fila: último recurso (media)', r = 'media', r);
end $$;

-- T6-13 hitos con prioridad propia
do $$ declare m uuid; h uuid; d date := '2026-03-10'; r text; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  insert into public.metas (titulo, frente) values ('m', 'tanku') returning id into m;
  insert into public.hitos (meta_id, titulo, prioridad) values (m, 'h', 'alta') returning id into h;
  update public.hitos set prioridad = 'baja' where id = h;
  perform zz.t_evento(h, 1, '2026-03-10 22:00-05');
  r := zz.p6('hitos', h, d);
  perform zz.reg('T6-13 hito: prioridad al cierre (baja)', r = 'baja', r);
end $$;

-- T6-14 aislamiento: otro usuario no obtiene información; T6-15 parámetros inválidos
do $$ declare p uuid; r text; begin
  perform zz.limpiar(); p := zz.nuevo_pend('alta');
  perform zz.como(zz.u2());
  r := public.prioridad_en_cierre('pendientes', p, '2026-03-10');
  perform zz.reg('T6-14 otro usuario no ve el historial ni la fila: media (sin fuga)', r = 'media', r);
  perform zz.como(zz.u1());
  begin perform public.prioridad_en_cierre('x', p, '2026-03-10'); perform zz.reg('T6-15a tabla inválida', false, 'no falló');
  exception when others then perform zz.reg('T6-15a tabla inválida -> parametro_invalido', sqlerrm = 'parametro_invalido', sqlerrm); end;
  begin perform public.prioridad_en_cierre('pendientes', p, null); perform zz.reg('T6-15b fecha nula', false, 'no falló');
  exception when others then perform zz.reg('T6-15b fecha nula -> parametro_invalido', sqlerrm = 'parametro_invalido', sqlerrm); end;
end $$;

-- T6-16 cierre en fin de mes bisiesto y de año (el corte usa la fecha local)
do $$ declare p uuid; r1 text; r2 text; begin
  perform zz.limpiar(); p := zz.nuevo_pend('media');
  perform zz.t_creado(p, '2028-02-01 12:00-05');
  perform zz.como(zz.u1()); update public.pendientes set prioridad = 'baja' where id = p;
  perform zz.t_evento(p, 1, '2028-03-01 04:59:59.999+00');       -- 23:59:59.999 del 29 feb 2028 en Bogotá
  r1 := zz.p6('pendientes', p, '2028-02-29');
  perform zz.limpiar(); p := zz.nuevo_pend('media');
  perform zz.t_creado(p, '2026-12-01 12:00-05');
  perform zz.como(zz.u1()); update public.pendientes set prioridad = 'baja' where id = p;
  perform zz.t_evento(p, 1, '2027-01-01 05:00:00+00');           -- 00:00 del 1 ene 2027 en Bogotá: ya es posterior
  r2 := zz.p6('pendientes', p, '2026-12-31');
  perform zz.reg('T6-16 bisiesto (29 feb 2028) y cambio de año (31 dic 2026): corte correcto', r1 = 'baja' and r2 = 'media', r1 || '/' || r2);
end $$;

-- T6-17 y T6-18: ejemplo numérico de §9.6 (A alta completado; B media incumplido)
create or replace function zz.t_peso(p text) returns int language sql immutable as $$ select case p when 'alta' then 3 when 'media' then 2 else 1 end $$;
grant execute on function zz.t_peso(text) to public;
do $$ declare a uuid; b uuid; d date := '2026-03-09'; pa text; pb text; t numeric; begin
  -- Caso 1: B baja a «baja» el lunes a las 23:00 → peso 1 → T = 3/(3+1) = 75 %
  perform zz.limpiar();
  a := zz.nuevo_pend('alta'); b := zz.nuevo_pend('media');
  perform zz.como(zz.u1()); update public.pendientes set hecho = true, hecho_en = now() where id = a;
  update public.pendientes set prioridad = 'baja' where id = b;
  perform zz.t_evento(b, 1, '2026-03-09 23:00-05');
  pa := zz.p6('pendientes', a, d); pb := zz.p6('pendientes', b, d);
  t := round(100.0 * zz.t_peso(pa) / (zz.t_peso(pa) + zz.t_peso(pb)));
  perform zz.reg('T6-17 ejemplo §9.6: B baja el lunes 23:00 → T = 75 %', t = 75, t::text);
  -- Caso 2: B baja el martes → su peso sigue siendo 2 → T = 3/(3+2) = 60 %
  perform zz.limpiar();
  a := zz.nuevo_pend('alta'); b := zz.nuevo_pend('media');
  perform zz.como(zz.u1()); update public.pendientes set hecho = true, hecho_en = now() where id = a;
  update public.pendientes set prioridad = 'baja' where id = b;
  perform zz.t_evento(b, 1, '2026-03-10 09:00-05');
  pa := zz.p6('pendientes', a, d); pb := zz.p6('pendientes', b, d);
  t := round(100.0 * zz.t_peso(pa) / (zz.t_peso(pa) + zz.t_peso(pb)));
  perform zz.reg('T6-18 ejemplo §9.6: B baja el martes → T = 60 %', t = 60, t::text);
end $$;

select caso, ok, detalle from zz.res order by id;
