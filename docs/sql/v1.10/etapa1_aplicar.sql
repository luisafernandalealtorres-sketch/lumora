-- ============================================================================
-- FASE 3 · v1.10 · Etapa 1 · aplicar
-- NO EJECUTADO. Extraído de docs/MIGRACIONES-FASE-3-v1.10.md (esa es la fuente).
-- No se ha ejecutado en Supabase. La v1.8 se validó solo en PostgreSQL local; T-7 y T-8b (v1.9) no se han revalidado; la etapa 0 se rediseñó en la v1.10 y no se ejecutó.
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
-- T-8b: no existe política de INSERT, UPDATE ni DELETE para el cliente y se revocan los permisos.
revoke insert, update, delete on public.cambios_registro from authenticated, anon;

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

-- Las funciones de disparador no deben quedar expuestas como RPC (el permiso solo se exige al crear el disparador).
revoke execute on function public.registrar_cambios()       from public, anon, authenticated;
revoke execute on function public.hitos_sellar_hecho_en()  from public, anon, authenticated;

commit;
