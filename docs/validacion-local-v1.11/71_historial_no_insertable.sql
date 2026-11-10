delete from zz.res;
do $$ declare st text; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  begin
    insert into public.cambios_registro (tabla, registro_id, evento, campo, valor_anterior, valor_nuevo) values ('pendientes', gen_random_uuid(), 'actualizado', 'hecho', 'false', 'true');
    perform zz.reg('T-8b el cliente NO puede insertar filas en su propio historial', false, 'inserción permitida');
  exception when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('T-8b el cliente NO puede insertar filas en su propio historial', st = '42501', st); end;
  begin
    insert into public.cambios_registro (user_id, tabla, registro_id, evento, contexto) values (zz.u2(), 'pendientes', gen_random_uuid(), 'creado', '{}');
    perform zz.reg('T-8c el cliente no puede insertar historial a nombre de otro usuario', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('T-8c el cliente no puede insertar historial a nombre de otro usuario', st = '42501', st); end;
end $$;
select caso, ok, detalle from zz.res;