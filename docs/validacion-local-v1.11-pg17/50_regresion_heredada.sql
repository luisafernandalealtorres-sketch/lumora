-- Regresión de módulos heredados: las mismas sentencias que ejecutan Pendientes.js, Metas.js, Salud.js y Panel.
\set ON_ERROR_STOP 0
delete from zz.res;

-- L-01/L-02 Mi día: crear, marcar, desmarcar y borrar un pendiente (con y sin meta)
do $$ declare m uuid; p uuid; q uuid; n int; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  insert into public.metas (titulo, descripcion, frente, fecha_meta) values ('meta', null, 'tanku', null) returning id into m;
  insert into public.pendientes (texto, frente, meta_id) values ('a', 'tanku', null) returning id into p;
  insert into public.pendientes (texto, frente, meta_id) values ('b', 'tanku', m) returning id into q;
  update public.pendientes set hecho = true, hecho_en = now() where id = p;
  update public.pendientes set hecho = false, hecho_en = null where id = p;
  delete from public.pendientes where id = q;
  select count(*) into n from public.pendientes;
  perform zz.reg('L-01/02 crear, marcar, desmarcar y borrar pendientes (con y sin meta)', n = 1, n::text);
end $$;

-- L-03 Panel y Home leen pendientes
do $$ declare n int; r record; begin
  perform zz.como(zz.u1());
  select count(*) into n from (select frente, hecho, hecho_en from public.pendientes) x;
  select * into r from public.pendientes limit 1;
  perform zz.reg('L-03/10 select de columnas y select * funcionan (columnas extra presentes)', n = 1 and r.prioridad = 'media', coalesce(r.prioridad, 'null'));
end $$;

-- L-04/L-05 Metas: hitos y borrado en cascada
do $$ declare m uuid; h uuid; he timestamptz; n int; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  insert into public.metas (titulo, descripcion, frente, fecha_meta) values ('m', null, 'salud', '2026-12-01') returning id into m;
  insert into public.hitos (meta_id, titulo) values (m, 'h') returning id into h;
  update public.hitos set hecho = true where id = h;
  select hecho_en into he from public.hitos where id = h;
  update public.metas set estado = 'pausada' where id = m;
  delete from public.hitos where id = h;
  insert into public.hitos (meta_id, titulo) values (m, 'h2');
  delete from public.metas where id = m;
  select count(*) into n from public.hitos;
  perform zz.reg('L-04/05 Metas: hito marcado queda con hecho_en; borrar meta limpia hitos', he is not null and n = 0, coalesce(he::text, 'null') || '/' || n);
end $$;

-- L-06/L-07 Salud: hábito heredado, upsert y borrado de registros
do $$ declare hb uuid; n int; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  insert into public.habitos (nombre, tipo, unidad, objetivo_dia, veces_semana) values ('Agua', 'cantidad', 'vasos', 8, 7) returning id into hb;
  insert into public.habito_registros (user_id, habito_id, fecha, valor) values (zz.u1(), hb, '2026-11-09', 3)
    on conflict (habito_id, fecha) do update set valor = excluded.valor;
  insert into public.habito_registros (user_id, habito_id, fecha, valor) values (zz.u1(), hb, '2026-11-09', 8)
    on conflict (habito_id, fecha) do update set valor = excluded.valor;
  select count(*) into n from public.habito_registros where habito_id = hb and valor = 8;
  perform zz.reg('L-06/07 Salud: upsert de registros heredados', n = 1, n::text);
  delete from public.habito_registros where habito_id = hb and fecha = '2026-11-09';
  update public.habitos set activo = false where id = hb;
  select count(*) into n from public.habito_registros;
  perform zz.reg('L-07b Salud: borrar registro y archivar hábito heredado', n = 0, n::text);
end $$;

-- L-08 un hábito nuevo no aparece en Salud (tabla heredada)
do $$ declare n int; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  perform public.habito_crear(gen_random_uuid(), zz.d1(), zz.sq(), 'Nuevo', 'manual', 'diaria', '{}'::smallint[], 1800);
  select count(*) into n from public.habitos;
  perform zz.reg('L-08 el hábito nuevo no aparece en la tabla heredada habitos', n = 0, n::text);
end $$;

-- L-09 las tablas heredadas no se tocaron: columnas y restricciones originales
do $$ declare r text; begin
  perform zz.admin();
  select string_agg(column_name, ',' order by ordinal_position) into r from information_schema.columns where table_schema = 'public' and table_name = 'habitos';
  perform zz.reg('L-09a habitos conserva sus columnas originales', r = 'id,user_id,nombre,tipo,unidad,objetivo_dia,veces_semana,activo,creado_en', r);
  select string_agg(column_name, ',' order by ordinal_position) into r from information_schema.columns where table_schema = 'public' and table_name = 'habito_registros';
  perform zz.reg('L-09b habito_registros conserva sus columnas originales', r = 'id,user_id,habito_id,fecha,valor', r);
  select string_agg(column_name, ',' order by ordinal_position) into r from information_schema.columns where table_schema = 'public' and table_name = 'pendientes';
  perform zz.reg('L-09c pendientes: columnas originales intactas y 3 nuevas al final', r = 'id,user_id,frente,texto,hecho,fecha_limite,creado_en,hecho_en,meta_id,prioridad,orden,fijado_dia', r);
  select string_agg(column_name, ',' order by ordinal_position) into r from information_schema.columns where table_schema = 'public' and table_name = 'hitos';
  perform zz.reg('L-09d hitos: columnas originales intactas y 2 nuevas al final', r = 'id,user_id,meta_id,titulo,hecho,fecha,creado_en,prioridad,hecho_en', r);
end $$;

select caso, ok, detalle from zz.res order by id;
