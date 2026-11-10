-- Pruebas de la etapa 1 (historial, prioridad, hecho_en en hitos).
\set ON_ERROR_STOP 0

-- H-01 inserción heredada: prioridad media y una fila "creado"
do $$ declare p uuid; pri text; n int; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  insert into public.pendientes (texto, frente, meta_id) values ('t1', 'tanku', null) returning id, prioridad into p, pri;
  select count(*) into n from public.cambios_registro where registro_id = p and evento = 'creado';
  perform zz.reg('H-01 inserción heredada: prioridad media y 1 creado', pri = 'media' and n = 1, pri || '/' || n);
end $$;

-- H-02 / H-03 marcar y desmarcar como lo hace Pendientes.js
do $$ declare p uuid; n int; ant int; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  insert into public.pendientes (texto, frente) values ('t2', 'tanku') returning id into p;
  update public.pendientes set hecho = true, hecho_en = now() where id = p;
  select count(*) into n from public.cambios_registro where registro_id = p and evento = 'actualizado' and campo in ('hecho', 'hecho_en');
  perform zz.reg('H-02 marcar genera 2 cambios (hecho, hecho_en)', n = 2, n::text);
  update public.pendientes set hecho = false, hecho_en = null where id = p;
  select count(*) into ant from public.cambios_registro where registro_id = p and campo = 'hecho_en' and valor_anterior is not null and valor_nuevo is null;
  perform zz.reg('H-03 desmarcar conserva el hecho_en anterior en el historial', ant = 1, ant::text);
end $$;

-- H-04 cambios de fecha límite
do $$ declare p uuid; n int; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  insert into public.pendientes (texto, frente, fecha_limite) values ('t4', 'tanku', '2026-11-09') returning id into p;
  update public.pendientes set fecha_limite = '2026-11-13' where id = p;
  update public.pendientes set fecha_limite = '2026-11-20' where id = p;
  select count(*) into n from public.cambios_registro where registro_id = p and campo = 'fecha_limite';
  perform zz.reg('H-04 dos cambios de fecha_limite = 2 filas', n = 2, n::text);
end $$;

-- H-05 borrar deja instantánea y sobrevive
do $$ declare p uuid; txt text; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  insert into public.pendientes (texto, frente) values ('borrame', 'tanku') returning id into p;
  delete from public.pendientes where id = p;
  select contexto ->> 'texto' into txt from public.cambios_registro where registro_id = p and evento = 'eliminado';
  perform zz.reg('H-05 eliminado con instantánea', txt = 'borrame', txt);
end $$;

-- H-06 hito heredado
do $$ declare m uuid; h uuid; pri text; he timestamptz; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  insert into public.metas (titulo, frente) values ('m', 'tanku') returning id into m;
  insert into public.hitos (meta_id, titulo) values (m, 'h1') returning id, prioridad, hecho_en into h, pri, he;
  perform zz.reg('H-06 hito heredado: prioridad media, hecho_en nulo', pri = 'media' and he is null, pri);
end $$;

-- H-07 / H-08 sellado de hecho_en en hitos
do $$ declare m uuid; h uuid; he timestamptz; n int; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  insert into public.metas (titulo, frente) values ('m', 'tanku') returning id into m;
  insert into public.hitos (meta_id, titulo) values (m, 'h1') returning id into h;
  update public.hitos set hecho = true where id = h;
  select hecho_en into he from public.hitos where id = h;
  select count(*) into n from public.cambios_registro where registro_id = h and campo = 'hecho_en';
  perform zz.reg('H-07 marcar hito sella hecho_en e historial lo registra', he is not null and n = 1, coalesce(he::text, 'null') || '/' || n);
  update public.hitos set hecho = false where id = h;
  select hecho_en into he from public.hitos where id = h;
  perform zz.reg('H-08 desmarcar hito vacía hecho_en', he is null, coalesce(he::text, 'null'));
end $$;

-- H-09 borrar meta borra hitos en cascada: cada uno deja "eliminado"
do $$ declare m uuid; n int; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  insert into public.metas (titulo, frente) values ('m', 'tanku') returning id into m;
  insert into public.hitos (meta_id, titulo) values (m, 'h1'), (m, 'h2');
  delete from public.metas where id = m;
  select count(*) into n from public.cambios_registro where tabla = 'hitos' and evento = 'eliminado';
  perform zz.reg('H-09 cascada de hitos deja 2 eliminados', n = 2, n::text);
end $$;

-- H-10 sin usuario autenticado no registra
do $$ declare p uuid; a int; b int; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  insert into public.pendientes (texto, frente) values ('t10', 'tanku') returning id into p;
  perform zz.admin();
  select count(*) into a from public.cambios_registro;
  update public.pendientes set hecho = true where id = p;
  select count(*) into b from public.cambios_registro;
  perform zz.reg('H-10 cambio sin auth.uid() no se registra y no falla', a = b, a || '/' || b);
end $$;

-- H-11 borrar un usuario no falla por la cascada
do $$ declare u3 uuid := '33333333-3333-3333-3333-333333333333'; begin
  perform zz.limpiar();
  insert into auth.users (id, email) values (u3, 'u3@prueba.local');
  perform zz.como(u3);
  insert into public.pendientes (texto, frente) values ('de u3', 'tanku');
  perform zz.admin();
  begin
    delete from auth.users where id = u3;
    perform zz.reg('H-11 borrar usuario con datos e historial', true, 'ok');
  exception when others then
    perform zz.reg('H-11 borrar usuario con datos e historial', false, sqlerrm);
  end;
end $$;

-- H-12 el historial no se puede insertar, modificar ni borrar directamente (T-8b/T-8c): permission denied
do $$ declare p uuid; c int; st text; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  insert into public.pendientes (texto, frente) values ('t12', 'tanku') returning id into p;
  begin update public.cambios_registro set campo = 'x'; perform zz.reg('H-12a UPDATE directo del cliente sobre el historial', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('H-12a UPDATE directo del cliente = 42501', st = '42501', st); end;
  begin delete from public.cambios_registro; perform zz.reg('H-12b DELETE directo del cliente sobre el historial', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('H-12b DELETE directo del cliente = 42501', st = '42501', st); end;
  begin insert into public.cambios_registro (tabla, registro_id, evento) values ('pendientes', gen_random_uuid(), 'creado'); perform zz.reg('H-12c INSERT directo del cliente sobre el historial', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('H-12c INSERT directo del cliente = 42501', st = '42501', st); end;
  select count(*) into c from public.cambios_registro;
  perform zz.reg('H-12d el historial no cambió tras los intentos', c = 1, c::text);
end $$;
-- H-14 actualización sin campos seguidos no registra
do $$ declare p uuid; a int; b int; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  insert into public.pendientes (texto, frente) values ('t14', 'tanku') returning id into p;
  select count(*) into a from public.cambios_registro;
  update public.pendientes set texto = 'otro', orden = 3 where id = p;
  select count(*) into b from public.cambios_registro;
  perform zz.reg('H-14 cambiar texto/orden no registra', a = b, a || '/' || b);
end $$;

-- H-15 prioridad inválida
do $$ begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  begin
    insert into public.pendientes (texto, frente, prioridad) values ('t15', 'tanku', 'x');
    perform zz.reg('H-15 prioridad inválida rechazada', false, 'no falló');
  exception when check_violation then
    perform zz.reg('H-15 prioridad inválida rechazada', true, sqlerrm);
  end;
end $$;

-- H-16 aislamiento: otro usuario no ve el historial
do $$ declare n int; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  insert into public.pendientes (texto, frente) values ('t16', 'tanku');
  perform zz.como(zz.u2());
  select count(*) into n from public.cambios_registro;
  perform zz.reg('H-16 U2 no ve historial de U1', n = 0, n::text);
end $$;

-- H-17 pendiente de otro usuario no se puede tocar
do $$ declare p uuid; n int; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  insert into public.pendientes (texto, frente) values ('t17', 'tanku') returning id into p;
  perform zz.como(zz.u2());
  update public.pendientes set hecho = true where id = p;
  get diagnostics n = row_count;
  perform zz.reg('H-17 U2 no puede actualizar pendiente de U1', n = 0, n::text);
end $$;

select caso, ok, detalle from zz.res order by id;
