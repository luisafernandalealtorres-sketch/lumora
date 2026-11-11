-- Ayudantes de las pruebas de reversión con temporizadores activos (esquema zz, solo en la base local desechable).
-- Se ejecuta DESPUÉS de 10_utilidades.sql y con las etapas 1, 2 y 3 aplicadas.
create table if not exists zz.antes (clave text primary key, valor text);
grant all on zz.antes to public;

-- Hábito con una versión de programación vigente desde p_desde (inserta como propietario, sin pasar por las RPC).
create or replace function zz.hab(p_user uuid, p_modo text, p_frec text, p_dias smallint[], p_desde date) returns uuid language plpgsql as $$
declare v uuid;
begin
  insert into public.habitos_config (user_id, nombre, modo_registro) values (p_user, 'h', p_modo) returning id into v;
  insert into public.habitos_config_versiones (habito_id, user_id, vigente_desde, frecuencia, dias_semana, objetivo_s)
  values (v, p_user, p_desde, p_frec, p_dias, 2700);
  return v;
end $$;

-- Huella de los privilegios de TODO lo que usa Focus (etapa 2): tablas (con privilegios por columna) y funciones.
-- La reversión suave no debe cambiarla.
create or replace function zz.privs_etapa2() returns text language sql stable as $$
  select md5(
    coalesce((select string_agg(c.relname || ':' || coalesce(c.relacl::text, '') || ':' ||
                coalesce((select string_agg(a.attname || '=' || a.attacl::text, ',' order by a.attname) from pg_attribute a where a.attrelid = c.oid and a.attacl is not null), ''), '|' order by c.relname)
              from pg_class c where c.relnamespace = 'public'::regnamespace
                and c.relname in ('preferencias_usuario', 'temporizador_activo', 'focus_sesiones', 'descansos', 'operaciones')), '')
    || '#' ||
    coalesce((select string_agg(p.oid::regprocedure::text || ':' || coalesce(p.proacl::text, ''), '|' order by p.oid::regprocedure::text)
              from pg_proc p where p.pronamespace = 'public'::regnamespace
                and (p.proname like 'focus\_%' or p.proname like 'descanso\_%'
                     or p.proname in ('_uid', '_prefs', '_op_existente', '_journal', '_ciclos_desde_ultimo_largo', '_tocar_actualizado_en'))), ''))
$$;
grant execute on all functions in schema zz to public;
