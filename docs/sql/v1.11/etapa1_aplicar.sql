-- ============================================================================
-- FASE 3 · v1.11 · Etapa 1 · aplicar
-- Extraído de docs/MIGRACIONES-FASE-3-v1.11.md (esa es la fuente).
-- NO se ha ejecutado en Supabase. Validado completo (404 PASS, 0 FAIL, 2 NOT RUN) solo en un PostgreSQL 16 local y desechable: docs/VALIDACION-LOCAL-FASE-3-v1.11.md.
-- Antes de cualquier ejecución: etapa 0 (verificación de roles y permisos) y autorización expresa por etapa.
-- ============================================================================
begin;

-- 1. Columnas aditivas en tablas heredadas (nulables o con valor por defecto constante).
alter table public.pendientes
  add column prioridad  text not null default 'media',
  add column orden      integer,
  add column fijado_dia date;
alter table public.pendientes
  add constraint pendientes_prioridad_check check (prioridad in ('alta', 'media', 'baja'));

alter table public.hitos
  add column prioridad text not null default 'media',
  add column hecho_en  timestamptz;
alter table public.hitos
  add constraint hitos_prioridad_check check (prioridad in ('alta', 'media', 'baja'));

create index pendientes_user_fecha_limite_idx
  on public.pendientes (user_id, fecha_limite) where fecha_limite is not null;
create index pendientes_user_fijado_dia_idx
  on public.pendientes (user_id, fijado_dia) where fijado_dia is not null;
create index hitos_user_fecha_idx
  on public.hitos (user_id, fecha) where fecha is not null;

-- 2. Historial de cambios (T-8 y T-8b: solo lectura para el cliente; lo escribe únicamente el disparador SECURITY DEFINER).`n-- Sin FK a los registros para que sobreviva al borrado.
create table public.cambios_registro (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  seq            bigint generated always as identity,   -- orden determinista de eventos con el mismo instante (T-6)
  tabla          text not null check (tabla in ('pendientes', 'hitos')),
  registro_id    uuid not null,
  evento         text not null check (evento in ('creado', 'actualizado', 'eliminado')),
  campo          text,
  valor_anterior text,
  valor_nuevo    text,
  contexto       jsonb,
  cambiado_en    timestamptz not null default now(),
  constraint cambios_registro_campo_check check (
    (evento = 'actualizado' and campo is not null) or (evento <> 'actualizado' and campo is null)
  )
);
create index cambios_registro_registro_idx
  on public.cambios_registro (user_id, tabla, registro_id, cambiado_en);

alter table public.cambios_registro enable row level security;
create policy "ver propios" on public.cambios_registro
  for select to authenticated using ((select auth.uid()) = user_id);
-- T-8b: no existe política de INSERT, UPDATE ni DELETE para el cliente.
-- T-8c: higiene de privilegios. Se revoca TODO a authenticated y anon y se concede solo SELECT a authenticated
-- (sin TRUNCATE, REFERENCES ni TRIGGER residuales). service_role y el propietario no se modifican.
revoke all on public.cambios_registro from authenticated, anon;
grant select on public.cambios_registro to authenticated;

-- 3. Relleno inicial: una fila "creado" por cada registro existente (hoy 0 filas). Antes de crear los disparadores.
insert into public.cambios_registro (user_id, tabla, registro_id, evento, contexto, cambiado_en)
select p.user_id, 'pendientes', p.id, 'creado', to_jsonb(p), p.creado_en from public.pendientes p;
insert into public.cambios_registro (user_id, tabla, registro_id, evento, contexto, cambiado_en)
select h.user_id, 'hitos', h.id, 'creado', to_jsonb(h), h.creado_en from public.hitos h;

-- 4. Función de historial (T-8b: SECURITY DEFINER para poder escribir sin permiso de INSERT del cliente).
-- Sigue sin registrar si no hay usuario autenticado. Escribe solo con el user_id de la fila modificada.
create or replace function public.registrar_cambios()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campos text[];
  v_campo  text;
  v_ant    text;
  v_nue    text;
begin
  if (select auth.uid()) is null then
    return coalesce(new, old);
  end if;

  if tg_table_name = 'pendientes' then
    v_campos := array['hecho', 'hecho_en', 'fecha_limite', 'prioridad'];
  else
    v_campos := array['hecho', 'hecho_en', 'fecha', 'prioridad'];
  end if;

  if tg_op = 'INSERT' then
    insert into public.cambios_registro (user_id, tabla, registro_id, evento, contexto)
    values (new.user_id, tg_table_name::text, new.id, 'creado', to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    foreach v_campo in array v_campos loop
      v_ant := to_jsonb(old) ->> v_campo;
      v_nue := to_jsonb(new) ->> v_campo;
      if v_ant is distinct from v_nue then
        insert into public.cambios_registro
          (user_id, tabla, registro_id, evento, campo, valor_anterior, valor_nuevo)
        values (new.user_id, tg_table_name::text, new.id, 'actualizado', v_campo, v_ant, v_nue);
      end if;
    end loop;
    return new;
  else
    insert into public.cambios_registro (user_id, tabla, registro_id, evento, contexto)
    values (old.user_id, tg_table_name::text, old.id, 'eliminado', to_jsonb(old));
    return old;
  end if;
end;
$$;

-- 5. Sellado de hecho_en en hitos (los módulos heredados no lo informan).
create or replace function public.hitos_sellar_hecho_en()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.hecho and new.hecho_en is null then
      new.hecho_en := now();
    end if;
  else
    if new.hecho and not old.hecho and new.hecho_en is null then
      new.hecho_en := now();
    elsif not new.hecho and old.hecho then
      new.hecho_en := null;
    end if;
  end if;
  return new;
end;
$$;

create trigger hitos_sellar_hecho_en
  before insert or update on public.hitos
  for each row execute function public.hitos_sellar_hecho_en();
create trigger pendientes_registrar_cambios
  after insert or update or delete on public.pendientes
  for each row execute function public.registrar_cambios();
create trigger hitos_registrar_cambios
  after insert or update or delete on public.hitos
  for each row execute function public.registrar_cambios();

-- T-6: prioridad vigente al CIERRE del día de vencimiento (America/Bogota), reconstruida desde cambios_registro.
-- El corte es las 00:00 del día siguiente a la fecha límite, en America/Bogota. Un cambio exactamente en el corte
-- cuenta como posterior. Orden de resolución:
--   1) el último cambio de prioridad anterior al corte;
--   2) si no hay, el valor anterior del primer cambio posterior al corte;
--   3) la instantánea de creación;  4) la instantánea de eliminación;  5) la prioridad actual (respaldo);  6) 'media'.
-- SECURITY INVOKER: respeta RLS (el cliente solo ve su propio historial).
create or replace function public.prioridad_en_cierre(p_tabla text, p_registro uuid, p_fecha_limite date)
returns text
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_corte timestamptz;
  v_p     text;
begin
  if p_tabla not in ('pendientes', 'hitos') or p_registro is null or p_fecha_limite is null then
    raise exception 'parametro_invalido';
  end if;
  v_corte := ((p_fecha_limite + 1)::timestamp at time zone 'America/Bogota');

  select c.valor_nuevo into v_p
    from public.cambios_registro c
   where c.tabla = p_tabla and c.registro_id = p_registro
     and c.evento = 'actualizado' and c.campo = 'prioridad' and c.cambiado_en < v_corte
   order by c.cambiado_en desc, c.seq desc
   limit 1;
  if v_p is not null then return v_p; end if;

  select c.valor_anterior into v_p
    from public.cambios_registro c
   where c.tabla = p_tabla and c.registro_id = p_registro
     and c.evento = 'actualizado' and c.campo = 'prioridad' and c.cambiado_en >= v_corte
   order by c.cambiado_en asc, c.seq asc
   limit 1;
  if v_p is not null then return v_p; end if;

  select c.contexto ->> 'prioridad' into v_p
    from public.cambios_registro c
   where c.tabla = p_tabla and c.registro_id = p_registro and c.evento = 'creado'
   order by c.cambiado_en asc, c.seq asc
   limit 1;
  if v_p is not null then return v_p; end if;

  select c.contexto ->> 'prioridad' into v_p
    from public.cambios_registro c
   where c.tabla = p_tabla and c.registro_id = p_registro and c.evento = 'eliminado'
   order by c.cambiado_en desc, c.seq desc
   limit 1;
  if v_p is not null then return v_p; end if;

  if p_tabla = 'pendientes' then
    select p.prioridad into v_p from public.pendientes p where p.id = p_registro;
  else
    select h.prioridad into v_p from public.hitos h where h.id = p_registro;
  end if;
  return coalesce(v_p, 'media');
end;
$$;
revoke execute on function public.prioridad_en_cierre(text, uuid, date) from public, anon;
grant execute on function public.prioridad_en_cierre(text, uuid, date) to authenticated;
-- Las funciones de disparador no deben quedar expuestas como RPC (el permiso solo se exige al crear el disparador).
revoke execute on function public.registrar_cambios()       from public, anon, authenticated;
revoke execute on function public.hitos_sellar_hecho_en()  from public, anon, authenticated;

commit;
