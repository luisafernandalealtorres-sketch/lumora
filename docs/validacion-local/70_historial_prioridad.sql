delete from zz.res;
do $$ declare p uuid; h uuid; m uuid; n1 int; n2 int; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  insert into public.pendientes (texto, frente) values ('p','tanku') returning id into p;
  update public.pendientes set prioridad = 'alta' where id = p;
  update public.pendientes set prioridad = 'baja' where id = p;
  select count(*) into n1 from public.cambios_registro where registro_id = p and campo = 'prioridad';
  insert into public.metas (titulo, frente) values ('m','tanku') returning id into m;
  insert into public.hitos (meta_id, titulo) values (m, 'h') returning id into h;
  update public.hitos set prioridad = 'alta', fecha = '2026-12-01' where id = h;
  select count(*) into n2 from public.cambios_registro where registro_id = h and campo in ('prioridad','fecha');
  perform zz.reg('T6-evidencia: cambios de prioridad (pendiente 2, hito+fecha 2) quedan registrados', n1 = 2 and n2 = 2, n1 || '/' || n2);
end $$;
select caso, ok, detalle from zz.res;
