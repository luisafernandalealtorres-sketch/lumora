-- Utilidades de prueba (esquema zz, solo en la base local desechable).
create schema zz;
grant usage on schema zz to public;
create table zz.res (id serial primary key, caso text, ok boolean, detalle text);
grant all on zz.res to public;
grant usage, select on sequence zz.res_id_seq to public;
create sequence zz.seq;
grant usage, select on sequence zz.seq to public;

create function zz.reg(p_caso text, p_ok boolean, p_det text default null) returns void
language sql as $$ insert into zz.res(caso, ok, detalle) values (p_caso, coalesce(p_ok, false), p_det) $$;
create function zz.sq() returns bigint language sql as $$ select nextval('zz.seq') $$;
create function zz.u1() returns uuid language sql immutable as $$ select '11111111-1111-1111-1111-111111111111'::uuid $$;
create function zz.u2() returns uuid language sql immutable as $$ select '22222222-2222-2222-2222-222222222222'::uuid $$;
create function zz.d1() returns uuid language sql immutable as $$ select 'd1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1'::uuid $$;
create function zz.d2() returns uuid language sql immutable as $$ select 'd2d2d2d2-d2d2-d2d2-d2d2-d2d2d2d2d2d2'::uuid $$;
grant execute on all functions in schema zz to public;

create function zz.como(p_uid uuid) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;
create function zz.admin() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;
create function zz.limpiar() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
  truncate public.operaciones, public.descansos, public.focus_sesiones, public.temporizador_activo,
    public.preferencias_usuario, public.habito_tiempo_historial, public.habito_tiempo, public.habito_segmentos,
    public.habito_temporizadores, public.habitos_config_versiones, public.habitos_config, public.objetivos_atencion,
    public.cambios_registro, public.pendientes, public.hitos, public.metas, public.habito_registros, public.habitos;
end $$;
grant execute on all functions in schema zz to public;

insert into auth.users (id, email) values (zz.u1(), 'u1@prueba.local'), (zz.u2(), 'u2@prueba.local');
