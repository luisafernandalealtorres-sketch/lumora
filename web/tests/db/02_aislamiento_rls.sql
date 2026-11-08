-- PRUEBA DE BASE DE DATOS 2/4: aislamiento por usuario (RLS).
-- Ejecutar DESPUÉS de 01_crear_y_modificar.sql y ANTES de 03_borrar.sql (necesita registros existentes).
-- Un usuario distinto y el rol anónimo no deben ver, modificar, borrar ni insertar a nombre del dueño.
do $$
declare
  uid uuid := (select id from auth.users limit 1);
  otro uuid := gen_random_uuid();
  n int; bloqueado boolean := false;
begin
  -- Otro usuario autenticado
  perform set_config('request.jwt.claims', json_build_object('sub', otro, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', otro::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  select count(*) into n from pendientes;  if n <> 0 then raise exception 'RLS: otro usuario ve pendientes (%)', n; end if;
  select count(*) into n from gastos;      if n <> 0 then raise exception 'RLS: otro usuario ve gastos (%)', n; end if;
  select count(*) into n from notas;       if n <> 0 then raise exception 'RLS: otro usuario ve notas (%)', n; end if;
  select count(*) into n from jornadas;    if n <> 0 then raise exception 'RLS: otro usuario ve jornadas (%)', n; end if;
  select count(*) into n from deudas;      if n <> 0 then raise exception 'RLS: otro usuario ve deudas (%)', n; end if;
  update pendientes set texto = 'hackeado'; get diagnostics n = row_count;
  if n <> 0 then raise exception 'RLS: otro usuario modificó pendientes (%)', n; end if;
  delete from gastos; get diagnostics n = row_count;
  if n <> 0 then raise exception 'RLS: otro usuario borró gastos (%)', n; end if;

  -- Insertar a nombre del dueño debe fallar
  begin
    insert into pendientes (user_id, texto, frente) values (uid, 'intruso', 'tanku');
  exception when others then bloqueado := true;
  end;
  if not bloqueado then raise exception 'RLS: se pudo insertar a nombre de otro usuario'; end if;

  -- Usuario anónimo
  execute 'reset role';
  execute 'set local role anon';
  begin
    select count(*) into n from pendientes;
    if n <> 0 then raise exception 'RLS: anon ve pendientes (%)', n; end if;
  exception when insufficient_privilege then null;
  end;

  -- El catálogo de frentes es de solo lectura para la app
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  execute 'set local role authenticated';
  bloqueado := false;
  begin
    insert into frentes (slug, nombre, grupo, orden) values ('intruso', 'x', 'personal', 99);
  exception when others then bloqueado := true;
  end;
  if not bloqueado then raise exception 'RLS: se pudo insertar en el catálogo de frentes'; end if;
  execute 'reset role';
end $$;
select 'OK 2/4: aislamiento RLS verificado' as resultado;
