-- Controles negativos del disparador SECURITY DEFINER (T-8b). Se ejecuta como SUPERUSUARIO del clúster de prueba,
-- porque cambia atributos de roles y propietarios. Cada control restaura el estado original al terminar.
\set ON_ERROR_STOP 0
delete from zz.res;
grant create on schema public to sb_other;

-- Intento de escritura heredada como cliente: devuelve 'ok' o el SQLSTATE del error
create or replace function zz.intento_escritura() returns text language plpgsql as $$
declare st text; p uuid;
begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  begin
    insert into public.pendientes (texto, frente) values ('control', 'tanku') returning id into p;
    perform zz.admin();
    return 'ok:' || (select count(*) from public.cambios_registro where registro_id = p) || ' filas de historial';
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    perform zz.admin();
    return st || ' (pendientes guardados: ' || (select count(*) from public.pendientes) || ')';
  end;
end $$;
grant execute on function zz.intento_escritura() to public;

-- Línea base
do $$ declare r text; begin r := zz.intento_escritura();
  perform zz.reg('TD-00 línea base: el cliente escribe un pendiente y el historial se registra', r = 'ok:1 filas de historial', r); end $$;

-- TD-05 Control A: el propietario pierde INSERT sobre cambios_registro
-- sb_owner es miembro (con herencia) de service_role, como el propietario en Supabase: para aislar el control se retira
-- INSERT también a service_role mientras dura la prueba; se restaura justo después.
revoke insert on public.cambios_registro from sb_owner;
revoke insert on public.cambios_registro from service_role;
do $$ declare r text; begin r := zz.intento_escritura();
  perform zz.reg('TD-05 CONTROL NEGATIVO A: sin INSERT para el propietario, la escritura heredada FALLA (42501) y no se guarda el pendiente', r like '42501%' and r like '%pendientes guardados: 0%', r); end $$;
grant insert on public.cambios_registro to sb_owner;
grant insert on public.cambios_registro to service_role;
do $$ declare r text; begin r := zz.intento_escritura();
  perform zz.reg('TD-05b restauración tras el control A', r = 'ok:1 filas de historial', r); end $$;

-- TD-06 Control B: la función tiene un propietario distinto del de la tabla
alter function public.registrar_cambios() owner to sb_other;
do $$ declare r text; begin r := zz.intento_escritura();
  perform zz.reg('TD-06 CONTROL NEGATIVO B: propietario distinto de la tabla, la escritura heredada FALLA (42501)', r like '42501%' and r like '%pendientes guardados: 0%', r); end $$;
alter function public.registrar_cambios() owner to sb_owner;
do $$ declare r text; begin r := zz.intento_escritura();
  perform zz.reg('TD-06b restauración tras el control B', r = 'ok:1 filas de historial', r); end $$;

-- TD-07 Control C: propietario sin BYPASSRLS y tabla con RLS forzado (no hay política de INSERT)
alter role sb_owner nobypassrls;
alter table public.cambios_registro force row level security;
do $$ declare r text; begin r := zz.intento_escritura();
  perform zz.reg('TD-07 CONTROL NEGATIVO C: RLS forzado y propietario sin BYPASSRLS, la escritura heredada FALLA (42501)', r like '42501%' and r like '%pendientes guardados: 0%', r); end $$;
alter table public.cambios_registro no force row level security;

-- TD-08: propietario sin BYPASSRLS, pero propietario de la tabla y sin RLS forzado → funciona
do $$ declare r text; begin r := zz.intento_escritura();
  perform zz.reg('TD-08 propietario sin BYPASSRLS pero dueño de la tabla y sin RLS forzado: la escritura FUNCIONA', r = 'ok:1 filas de historial', r); end $$;
alter role sb_owner bypassrls;
do $$ declare r text; begin r := zz.intento_escritura();
  perform zz.reg('TD-08b restauración final (BYPASSRLS, sin RLS forzado)', r = 'ok:1 filas de historial', r); end $$;

select caso, ok, detalle from zz.res order by id;
