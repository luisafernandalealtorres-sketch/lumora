-- T-7 / T-7b-1 / T-7b-3: objetivos semanales de semanas anteriores inmutables (matriz T7-xx de la v1.11).
\set ON_ERROR_STOP 0
delete from zz.res;

-- Ayudantes
create or replace function zz.l0() returns date language sql stable as $$ select public.lunes_semana_bogota(now()) $$;
create or replace function zz.como_rol(p_rol text, p_uid uuid) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', case when p_uid is null then json_build_object('role', p_rol)::text else json_build_object('sub', p_uid, 'role', p_rol)::text end, true);
  execute format('set local role %I', p_rol);
end $$;
-- Identidad del usuario conservada pero rol propietario (borrado por una función definer hipotética)
create or replace function zz.admin_con_identidad(p_uid uuid) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid)::text, true);
end $$;
grant execute on all functions in schema zz to public;
-- Siembra como propietario (sin identidad): una fila por semana indicada para U1
create or replace function zz.sembrar_obj(p_semana date, p_puntos int default 3, p_user uuid default null, p_frente text default 'tanku') returns void language plpgsql as $$
begin
  perform zz.admin();
  insert into public.objetivos_atencion (user_id, semana_inicio, frente_id, puntos) values (coalesce(p_user, zz.u1()), p_semana, p_frente, p_puntos);
end $$;
grant execute on function zz.sembrar_obj(date, int, uuid, text) to public;

-- ============ INSERT / UPSERT (C1) ============
do $$ declare l date := zz.l0(); st text; msg text; det text; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  insert into public.objetivos_atencion (semana_inicio, frente_id, puntos) values (l, 'tanku', 5);
  perform zz.reg('T7-01 INSERT semana actual', true, null);
  insert into public.objetivos_atencion (semana_inicio, frente_id, puntos) values (l + 7, 'tanku', 5), (l + 364, 'tanku', 5);
  perform zz.reg('T7-02 INSERT semana futura (+7 y +364 días)', true, null);
  begin insert into public.objetivos_atencion (semana_inicio, frente_id, puntos) values (l - 7, 'tanku', 5); perform zz.reg('T7-03 INSERT semana pasada', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate, msg = message_text, det = pg_exception_detail;
    perform zz.reg('T7-03 INSERT semana pasada -> semana_cerrada', msg = 'semana_cerrada', st || '/' || msg); end;
  begin insert into public.objetivos_atencion (semana_inicio, frente_id, puntos) values (l - 364, 'tanku', 5); perform zz.reg('T7-04 INSERT semana muy pasada', false, 'no falló');
  exception when others then get stacked diagnostics msg = message_text; perform zz.reg('T7-04 INSERT semana muy pasada -> semana_cerrada', msg = 'semana_cerrada', msg); end;
  -- T7-31 atributos del error
  begin insert into public.objetivos_atencion (semana_inicio, frente_id, puntos) values (l - 7, 'salud', 1);
  exception when others then get stacked diagnostics st = returned_sqlstate, msg = message_text, det = pg_exception_detail;
    perform zz.reg('T7-31 error: SQLSTATE P0001, mensaje semana_cerrada y detalle', st = 'P0001' and msg = 'semana_cerrada' and det is not null, st || '/' || msg || '/' || coalesce(det, 'null')); end;
end $$;

-- La siembra va en sentencias aparte: now() es constante dentro de una transacción y T7-07 compara actualizado_en.
select zz.limpiar();
select zz.sembrar_obj(zz.l0() - 7);
select zz.sembrar_obj(zz.l0(), 3);
do $$ declare l date := zz.l0(); st text; msg text; n int; a timestamptz; b timestamptz; begin
  perform zz.como(zz.u1());
  begin insert into public.objetivos_atencion (semana_inicio, frente_id, puntos) values (l - 7, 'tanku', 9) on conflict (user_id, semana_inicio, frente_id) do update set puntos = excluded.puntos;
    perform zz.reg('T7-05 UPSERT semana pasada con fila previa', false, 'no falló');
  exception when others then get stacked diagnostics msg = message_text; perform zz.reg('T7-05 UPSERT semana pasada (con fila previa) -> semana_cerrada', msg = 'semana_cerrada', msg); end;
  begin insert into public.objetivos_atencion (semana_inicio, frente_id, puntos) values (l - 14, 'tanku', 9) on conflict (user_id, semana_inicio, frente_id) do update set puntos = excluded.puntos;
    perform zz.reg('T7-06 UPSERT semana pasada sin fila previa', false, 'no falló');
  exception when others then get stacked diagnostics msg = message_text; perform zz.reg('T7-06 UPSERT semana pasada (sin fila previa) -> semana_cerrada', msg = 'semana_cerrada', msg); end;
  select actualizado_en into a from public.objetivos_atencion where semana_inicio = l;
  insert into public.objetivos_atencion (semana_inicio, frente_id, puntos) values (l, 'tanku', 8) on conflict (user_id, semana_inicio, frente_id) do update set puntos = excluded.puntos;
  select actualizado_en, puntos into b, n from public.objetivos_atencion where semana_inicio = l;
  perform zz.reg('T7-07 UPSERT semana actual: actualiza y cambia actualizado_en (también prueba T7-30: orden de disparadores)', n = 8 and b > a, n || '/' || (b > a));
end $$;

-- ============ UPDATE (C1) ============
do $$ declare l date := zz.l0(); msg text; n int; begin
  perform zz.limpiar(); perform zz.sembrar_obj(l - 7); perform zz.sembrar_obj(l); perform zz.sembrar_obj(l + 7);
  perform zz.como(zz.u1());
  update public.objetivos_atencion set puntos = 7 where semana_inicio = l; get diagnostics n = row_count;
  perform zz.reg('T7-08 UPDATE puntos semana actual', n = 1, n::text);
  update public.objetivos_atencion set puntos = 7 where semana_inicio = l + 7; get diagnostics n = row_count;
  perform zz.reg('T7-09 UPDATE puntos semana futura', n = 1, n::text);
  begin update public.objetivos_atencion set puntos = 7 where semana_inicio = l - 7; perform zz.reg('T7-10 UPDATE puntos semana pasada', false, 'no falló');
  exception when others then get stacked diagnostics msg = message_text; perform zz.reg('T7-10 UPDATE puntos semana pasada -> semana_cerrada', msg = 'semana_cerrada', msg); end;
  begin update public.objetivos_atencion set semana_inicio = l - 14 where semana_inicio = l; perform zz.reg('T7-11 mover actual -> pasada', false, 'no falló');
  exception when others then get stacked diagnostics msg = message_text; perform zz.reg('T7-11 mover semana actual a una pasada -> semana_cerrada', msg = 'semana_cerrada', msg); end;
  begin update public.objetivos_atencion set semana_inicio = l + 14 where semana_inicio = l - 7; perform zz.reg('T7-12 mover pasada -> futura', false, 'no falló');
  exception when others then get stacked diagnostics msg = message_text; perform zz.reg('T7-12 mover una semana pasada -> semana_cerrada', msg = 'semana_cerrada', msg); end;
  update public.objetivos_atencion set semana_inicio = l + 21 where semana_inicio = l; get diagnostics n = row_count;
  perform zz.reg('T7-13 mover semana actual a una futura', n = 1, n::text);
  begin update public.objetivos_atencion set frente_id = 'salud' where semana_inicio = l - 7; perform zz.reg('T7-14 cambiar frente en semana pasada', false, 'no falló');
  exception when others then get stacked diagnostics msg = message_text; perform zz.reg('T7-14 UPDATE de frente en semana pasada -> semana_cerrada', msg = 'semana_cerrada', msg); end;
end $$;

-- ============ DELETE (C1) ============
do $$ declare l date := zz.l0(); msg text; n int; begin
  perform zz.limpiar(); perform zz.sembrar_obj(l - 7); perform zz.sembrar_obj(l); perform zz.sembrar_obj(l + 7);
  perform zz.como(zz.u1());
  delete from public.objetivos_atencion where semana_inicio = l; get diagnostics n = row_count;
  perform zz.reg('T7-15 DELETE semana actual', n = 1, n::text);
  delete from public.objetivos_atencion where semana_inicio = l + 7; get diagnostics n = row_count;
  perform zz.reg('T7-16 DELETE semana futura', n = 1, n::text);
  begin delete from public.objetivos_atencion where semana_inicio = l - 7; perform zz.reg('T7-17 DELETE semana pasada', false, 'no falló');
  exception when others then get stacked diagnostics msg = message_text; perform zz.reg('T7-17 DELETE semana pasada -> semana_cerrada', msg = 'semana_cerrada', msg); end;
  begin delete from public.objetivos_atencion; perform zz.reg('T7-66 borrado directo del usuario de todas sus filas (incluye pasadas)', false, 'no falló');
  exception when others then get stacked diagnostics msg = message_text; perform zz.reg('T7-66 el usuario no puede borrar directamente semanas pasadas', msg = 'semana_cerrada', msg); end;
  select count(*) into n from public.objetivos_atencion;
  perform zz.reg('T7-66b la fila pasada sigue existiendo tras el intento', n = 1, n::text);
end $$;

-- ============ Sentencias masivas y atomicidad ============
do $$ declare l date := zz.l0(); msg text; n int; s int; begin
  perform zz.limpiar(); perform zz.sembrar_obj(l - 7, 3); perform zz.sembrar_obj(l, 3); perform zz.sembrar_obj(l + 7, 3);
  perform zz.como(zz.u1());
  begin update public.objetivos_atencion set puntos = 0; perform zz.reg('T7-20 UPDATE masivo con semanas pasadas', false, 'no falló');
  exception when others then get stacked diagnostics msg = message_text; perform zz.reg('T7-20 UPDATE masivo falla por completo (semana_cerrada)', msg = 'semana_cerrada', msg); end;
  select sum(puntos) into s from public.objetivos_atencion;
  perform zz.reg('T7-20b atomicidad del UPDATE masivo: ningún punto cambió (suma 9)', s = 9, s::text);
  begin delete from public.objetivos_atencion; perform zz.reg('T7-21 DELETE masivo con semanas pasadas', false, 'no falló');
  exception when others then get stacked diagnostics msg = message_text; perform zz.reg('T7-21 DELETE masivo falla por completo (semana_cerrada)', msg = 'semana_cerrada', msg); end;
  select count(*) into n from public.objetivos_atencion;
  perform zz.reg('T7-21b atomicidad del DELETE masivo: las 3 filas siguen', n = 3, n::text);
  delete from public.objetivos_atencion where semana_inicio >= l; get diagnostics n = row_count;
  perform zz.reg('T7-22 DELETE filtrado por semana >= lunes actual', n = 2, n::text);
  begin insert into public.objetivos_atencion (semana_inicio, frente_id, puntos) select l + 7, 'salud', 1 union all select l - 7, 'salud', 1;
    perform zz.reg('T7-23 INSERT … SELECT mezclando semanas', false, 'no falló');
  exception when others then get stacked diagnostics msg = message_text; perform zz.reg('T7-23 INSERT … SELECT mezclando semanas falla por completo', msg = 'semana_cerrada', msg); end;
  select count(*) into n from public.objetivos_atencion where frente_id = 'salud';
  perform zz.reg('T7-23b atomicidad del INSERT … SELECT: no se insertó ninguna fila', n = 0, n::text);
end $$;

-- ============ Contextos con auth.uid() NULL y roles ============
do $$ declare l date := zz.l0(); n int; st text; msg text; begin
  -- T7-50 administrador (propietario, sin identidad)
  perform zz.limpiar(); perform zz.admin();
  insert into public.objetivos_atencion (user_id, semana_inicio, frente_id, puntos) values (zz.u1(), l - 7, 'tanku', 1);
  update public.objetivos_atencion set puntos = 2 where semana_inicio = l - 7;
  delete from public.objetivos_atencion where semana_inicio = l - 7;
  perform zz.reg('T7-50 contexto administrativo (auth.uid() NULL): INSERT, UPDATE y DELETE en semana pasada permitidos', true, null);
  -- T7-51 service_role
  perform zz.como_rol('service_role', null);
  insert into public.objetivos_atencion (user_id, semana_inicio, frente_id, puntos) values (zz.u1(), l - 7, 'tanku', 1);
  update public.objetivos_atencion set puntos = 2 where semana_inicio = l - 7;
  delete from public.objetivos_atencion where semana_inicio = l - 7;
  perform zz.reg('T7-51 service_role (sin sub): INSERT, UPDATE y DELETE en semana pasada permitidos', true, null);
  -- T7-52/53 anon
  perform zz.sembrar_obj(l - 7);
  perform zz.como_rol('anon', null);
  begin insert into public.objetivos_atencion (user_id, semana_inicio, frente_id, puntos) values (zz.u1(), l - 14, 'tanku', 1); perform zz.reg('T7-52 anon INSERT', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('T7-52 anon INSERT denegado (42501, sin hueco)', st = '42501', st); end;
  begin update public.objetivos_atencion set puntos = 9; perform zz.reg('T7-53a anon UPDATE', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('T7-53a anon UPDATE denegado (42501)', st = '42501', st); end;
  begin delete from public.objetivos_atencion; perform zz.reg('T7-53b anon DELETE', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('T7-53b anon DELETE denegado (42501)', st = '42501', st); end;
  -- T7-54/55/58 authenticated con claims sin sub (identidad rota): el disparador salta, RLS decide
  perform zz.como_rol('authenticated', null);
  begin insert into public.objetivos_atencion (user_id, semana_inicio, frente_id, puntos) values (zz.u1(), l - 14, 'tanku', 1); perform zz.reg('T7-54 identidad rota INSERT', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate, msg = message_text; perform zz.reg('T7-54/58 identidad rota INSERT semana pasada: RLS lo deniega (no semana_cerrada)', st = '42501' and msg like '%row-level security%', st || '/' || msg); end;
  update public.objetivos_atencion set puntos = 9; get diagnostics n = row_count;
  perform zz.reg('T7-55a identidad rota UPDATE: 0 filas (RLS)', n = 0, n::text);
  delete from public.objetivos_atencion; get diagnostics n = row_count;
  perform zz.reg('T7-55b identidad rota DELETE: 0 filas (RLS)', n = 0, n::text);
  perform zz.admin(); select count(*) into n from public.objetivos_atencion;
  perform zz.reg('T7-55c la fila pasada sigue intacta tras los intentos sin identidad', n = 1, n::text);
end $$;

do $$ declare l date := zz.l0(); n int; st text; begin
  perform zz.limpiar(); perform zz.sembrar_obj(l - 7); perform zz.sembrar_obj(l);
  -- T7-56/57 otro usuario autenticado
  perform zz.como(zz.u2());
  update public.objetivos_atencion set puntos = 9; get diagnostics n = row_count;
  perform zz.reg('T7-56a otro usuario UPDATE sobre filas de U1: 0 filas', n = 0, n::text);
  delete from public.objetivos_atencion; get diagnostics n = row_count;
  perform zz.reg('T7-56b otro usuario DELETE sobre filas de U1: 0 filas', n = 0, n::text);
  begin insert into public.objetivos_atencion (user_id, semana_inicio, frente_id, puntos) values (zz.u1(), l + 7, 'tanku', 1); perform zz.reg('T7-57 otro usuario INSERT con user_id de U1', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('T7-57 otro usuario INSERT con user_id de U1: RLS (42501)', st = '42501', st); end;
end $$;

-- ============ Borrado de usuario en cascada (T-7b-1) ============
do $$ declare l date := zz.l0(); u uuid := '55555555-5555-5555-5555-555555555555'; n int; begin
  perform zz.limpiar(); perform zz.admin();
  insert into auth.users (id, email) values (u, 'u5@prueba.local');
  perform zz.sembrar_obj(l - 7, 1, u); perform zz.sembrar_obj(l, 1, u); perform zz.sembrar_obj(l + 7, 1, u);
  perform zz.admin();
  delete from auth.users where id = u;
  select count(*) into n from public.objetivos_atencion where user_id = u;
  perform zz.reg('T7-60 administrador borra al usuario (auth.uid() NULL): la cascada borra sus 3 objetivos', n = 0, n::text);
end $$;
do $$ declare l date := zz.l0(); u uuid := '66666666-6666-6666-6666-666666666666'; n int; begin
  perform zz.limpiar(); perform zz.admin();
  insert into auth.users (id, email) values (u, 'u6@prueba.local');
  perform zz.sembrar_obj(l - 7, 1, u); perform zz.sembrar_obj(l, 1, u);
  perform zz.admin_con_identidad(u);                                  -- sesión con la identidad del propio usuario
  begin
    delete from auth.users where id = u;
    select count(*) into n from public.objetivos_atencion where user_id = u;
    perform zz.reg('T7-61 borrado del usuario CONSERVANDO su identidad (T-7b-1): la cascada funciona', n = 0, n::text);
  exception when others then perform zz.reg('T7-61 borrado del usuario conservando su identidad (T-7b-1)', false, sqlerrm); end;
end $$;
do $$ declare l date := zz.l0(); u uuid := '77777777-7777-7777-7777-777777777777'; n int; begin
  perform zz.limpiar(); perform zz.admin();
  insert into auth.users (id, email) values (u, 'u7@prueba.local');
  perform zz.sembrar_obj(l - 7, 1, u);
  perform zz.admin_con_identidad(zz.u2());                            -- identidad de OTRO usuario
  begin
    delete from auth.users where id = u;
    select count(*) into n from public.objetivos_atencion where user_id = u;
    perform zz.reg('T7-62 borrado del usuario con la identidad de otro usuario: la cascada funciona', n = 0, n::text);
  exception when others then perform zz.reg('T7-62 borrado con identidad de otro usuario', false, sqlerrm); end;
end $$;

-- ============ T7-63 profundidad de disparador observada, y T-7b-1 "cualquier disparador anidado" ============
create or replace function zz.t_profundidad() returns trigger language plpgsql as $$
begin
  insert into zz.profundidad (etiqueta, profundidad) values (tg_argv[0], pg_trigger_depth());
  return coalesce(new, old);
end $$;
grant execute on function zz.t_profundidad() to public;
-- (el cliente no puede crear disparadores desde T-8c: este lo crea el propietario solo para medir)
create trigger zz_prof_antes before delete on public.objetivos_atencion for each row execute function zz.t_profundidad('objetivos');

do $$ declare l date := zz.l0(); u uuid := '88888888-8888-8888-8888-888888888888'; pd int; pc int; begin
  perform zz.limpiar(); perform zz.admin(); delete from zz.profundidad;
  perform zz.sembrar_obj(l, 1);
  perform zz.como(zz.u1()); delete from public.objetivos_atencion where semana_inicio = l;
  perform zz.admin(); select max(profundidad) into pd from zz.profundidad where etiqueta = 'objetivos'; delete from zz.profundidad;
  insert into auth.users (id, email) values (u, 'u8@prueba.local'); perform zz.sembrar_obj(l, 1, u);
  delete from auth.users where id = u;
  select max(profundidad) into pc from zz.profundidad where etiqueta = 'objetivos';
  perform zz.reg('T7-63 profundidad observada: borrado directo = 1; cascada desde auth.users = 2', pd = 1 and pc = 2, pd || '/' || pc);
end $$;
drop trigger zz_prof_antes on public.objetivos_atencion;

-- T7-67: la excepción cubre CUALQUIER disparador anidado (límite documentado): un disparador ajeno que borra objetivos pasados
create table zz.dummy (id serial primary key, x int);
grant all on zz.dummy to public; grant usage on sequence zz.dummy_id_seq to public;
create or replace function zz.t_anidado() returns trigger language plpgsql as $$
begin
  delete from public.objetivos_atencion where user_id = (select auth.uid()) and semana_inicio < public.lunes_semana_bogota(now());
  return new;
end $$;
grant execute on function zz.t_anidado() to public;
create trigger zz_anidado after insert on zz.dummy for each row execute function zz.t_anidado();
do $$ declare l date := zz.l0(); n int; begin
  perform zz.limpiar(); perform zz.sembrar_obj(l - 7, 1); perform zz.sembrar_obj(l, 1);
  perform zz.como(zz.u1());
  insert into zz.dummy (x) values (1);              -- dispara el borrado anidado como U1
  perform zz.admin(); select count(*) into n from public.objetivos_atencion;
  perform zz.reg('T7-67 LÍMITE DOCUMENTADO (T-7b-1): un disparador anidado ajeno SÍ puede borrar semanas pasadas (queda 1 fila)', n = 1, n::text);
end $$;
drop table zz.dummy;
do $$ begin perform zz.nr('T7-59', 'No alcanzable desde la API: PostgREST no expone set_config y ninguna función de la Fase 3 altera los claims (revisión de código)'); end $$;

-- ============ TRUNCATE ============
do $$ declare l date := zz.l0(); n int; st text; begin
  perform zz.limpiar(); perform zz.sembrar_obj(l - 7, 1);
  perform zz.como(zz.u1());
  begin truncate public.objetivos_atencion; perform zz.reg('T7-65 TRUNCATE del cliente (authenticated)', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('T7-65 TRUNCATE del cliente denegado (42501, T-8c)', st = '42501', st); end;
  perform zz.admin();
  truncate public.objetivos_atencion;
  select count(*) into n from public.objetivos_atencion;
  perform zz.reg('T7-64 TRUNCATE del propietario: permitido (no dispara disparadores de fila; vía administrativa)', n = 0, n::text);
end $$;

-- ============ Función auxiliar parametrizada (T-7b-3): fronteras ============
do $$ declare r text := ''; ok boolean := true; x record; begin
  perform zz.admin();
  for x in select * from (values
    ('2026-11-09 04:59:59.999+00'::timestamptz, '2026-11-02'::date, 'domingo 23:59:59.999 Bogotá = lunes 04:59:59.999 UTC'),
    ('2026-11-09 05:00:00+00',               '2026-11-09',         'lunes 00:00:00 Bogotá = lunes 05:00:00 UTC'),
    ('2026-11-09 00:00:00+00',               '2026-11-02',         'lunes 00:00:00 UTC = domingo 19:00 Bogotá'),
    ('2026-11-09 05:00:00.001+00',           '2026-11-09',         'lunes 05:00:00.001 UTC'),
    ('2026-11-15 04:59:59.999+00',           '2026-11-09',         'sábado 23:59:59.999 Bogotá'),
    ('2026-11-16 04:59:59.999+00',           '2026-11-09',         'domingo 23:59:59.999 Bogotá'),
    ('2026-11-16 05:00:00+00',               '2026-11-16',         'lunes 00:00 Bogotá siguiente'),
    ('2028-02-29 17:00:00+00',               '2028-02-28',         'bisiesto: 29 feb 2028 (martes)'),
    ('2028-03-01 04:59:59.999+00',           '2028-02-28',         'bisiesto: 23:59:59.999 del 29 feb 2028 en Bogotá'),
    ('2028-03-01 05:00:00+00',               '2028-02-28',         'bisiesto: 1 mar 2028 00:00 Bogotá (miércoles)'),
    ('2024-02-29 12:00:00+00',               '2024-02-26',         'bisiesto 2024 (jueves)'),
    ('2020-02-29 12:00:00+00',               '2020-02-24',         'bisiesto 2020 (sábado)'),
    ('2026-12-31 12:00:00+00',               '2026-12-28',         'fin de año 2026 (jueves)'),
    ('2027-01-01 04:59:59.999+00',           '2026-12-28',         '31 dic 2026 23:59:59.999 Bogotá'),
    ('2027-01-01 05:00:00+00',               '2026-12-28',         '1 ene 2027 00:00 Bogotá (viernes)'),
    ('2027-01-04 04:59:59.999+00',           '2026-12-28',         '3 ene 2027 23:59:59.999 Bogotá (domingo)'),
    ('2027-01-04 05:00:00+00',               '2027-01-04',         '4 ene 2027 00:00 Bogotá (lunes)'),
    ('2024-12-31 12:00:00+00',               '2024-12-30',         'fin de año 2024 (martes)'),
    ('2025-01-01 12:00:00+00',               '2024-12-30',         'inicio de año 2025 (miércoles)')
  ) as v(ts, esperado, caso) loop
    if public.lunes_semana_bogota(x.ts) is distinct from x.esperado then ok := false; r := r || x.caso || ' => ' || public.lunes_semana_bogota(x.ts) || ' (esperado ' || x.esperado || '); '; end if;
  end loop;
  perform zz.reg('T7-40 fronteras de la función auxiliar (19 instantes: domingo 23:59:59.999, lunes 00:00, 04:59:59.999 UTC, 05:00:00 UTC, bisiestos, cambio de año)', ok, nullif(r, ''));
end $$;

-- T7-41 propiedad: para cada hora de 2 años el resultado es lunes y está a 0..6 días de la fecha local
do $$ declare malos int; begin
  select count(*) into malos from generate_series('2026-01-01 00:00+00'::timestamptz, '2027-12-31 23:00+00', interval '1 hour') g
   where extract(isodow from public.lunes_semana_bogota(g)) <> 1
      or (g at time zone 'America/Bogota')::date - public.lunes_semana_bogota(g) not between 0 and 6;
  perform zz.reg('T7-41 propiedad en 17 520 instantes horarios (2026 y 2027): siempre lunes y a 0..6 días', malos = 0, malos::text);
end $$;

-- T7-42 el cambio real de semana no se puede forzar sin adelantar el reloj del sistema
do $$ begin perform zz.nr('T7-42', 'Cambio de semana en tiempo real: no se manipula el reloj (T-7b-3); las fronteras se cubren con T7-40, T7-41 y la comparación con JavaScript (T7-44)'); end $$;

-- T7-43 el disparador usa la función con el instante actual: el lunes actual se acepta y la semana anterior se rechaza
do $$ declare l date := public.lunes_semana_bogota(now()); msg text; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  insert into public.objetivos_atencion (semana_inicio, frente_id, puntos) values (l, 'tanku', 1);
  begin insert into public.objetivos_atencion (semana_inicio, frente_id, puntos) values (l - 7, 'tanku', 1);
  exception when others then get stacked diagnostics msg = message_text;
    perform zz.reg('T7-43 el disparador usa lunes_semana_bogota(now()): acepta el lunes actual y rechaza el anterior', msg = 'semana_cerrada', msg); end;
end $$;

-- T7-30 orden de disparadores: objetivos_semana_cerrada corre antes que objetivos_tocar
do $$ declare r text; begin
  perform zz.admin();
  select string_agg(tgname, ' < ' order by tgname) into r from pg_trigger where tgrelid = 'public.objetivos_atencion'::regclass and not tgisinternal and tgtype & 2 = 2;
  perform zz.reg('T7-30 orden alfabético de disparadores BEFORE: objetivos_semana_cerrada < objetivos_tocar', r = 'objetivos_semana_cerrada < objetivos_tocar', r);
end $$;

select caso, ok, detalle from zz.res order by id;
