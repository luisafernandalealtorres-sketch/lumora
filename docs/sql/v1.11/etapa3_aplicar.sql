-- ============================================================================
-- FASE 3 · v1.11 · Etapa 3 · aplicar
-- Extraído de docs/MIGRACIONES-FASE-3-v1.11.md (esa es la fuente).
-- NO se ha ejecutado en Supabase. Validado completo (404 PASS, 0 FAIL, 2 NOT RUN) solo en un PostgreSQL 16 local y desechable: docs/VALIDACION-LOCAL-FASE-3-v1.11.md.
-- Antes de cualquier ejecución: etapa 0 (verificación de roles y permisos) y autorización expresa por etapa.
-- ============================================================================
begin;

-- Objetivos semanales de atención (P15: la interfaz llega en 3.3).
create table public.objetivos_atencion (
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  semana_inicio  date not null check (extract(isodow from semana_inicio) = 1),
  frente_id      text not null check (frente_id in ('tanku', 'ticketcode', 'personal', 'salud', 'familia', 'otros')),
  puntos         integer not null check (puntos >= 0),
  actualizado_en timestamptz not null default now(),
  primary key (user_id, semana_inicio, frente_id)
);
alter table public.objetivos_atencion enable row level security;
create policy "propios" on public.objetivos_atencion
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create trigger objetivos_tocar before update on public.objetivos_atencion
  for each row execute function public._tocar_actualizado_en();

-- T-7b-3: lunes de la semana de un instante, en America/Bogota. Recibe el instante como parámetro para poder probar
-- las fronteras sin manipular el reloj. Función pura; el cliente puede ejecutarla (la usa el disparador invoker).
create or replace function public.lunes_semana_bogota(p_instante timestamptz)
returns date
language sql
stable
set search_path = ''
as $$
  select (p_instante at time zone 'America/Bogota')::date
         - (extract(isodow from (p_instante at time zone 'America/Bogota')::date)::integer - 1)
$$;
revoke execute on function public.lunes_semana_bogota(timestamptz) from public, anon;
grant execute on function public.lunes_semana_bogota(timestamptz) to authenticated;

-- T-7: los objetivos de semanas anteriores a la actual son inmutables (America/Bogota).
-- T-7b-1: no actúa dentro de disparadores anidados (pg_trigger_depth() > 1): borrados en cascada (por ejemplo al borrar
--         el usuario) y, en general, cualquier acción lanzada desde otro disparador. Las operaciones directas del
--         cliente siguen protegidas (profundidad 1).
-- No actúa sin usuario autenticado (mantenimiento administrativo y service_role).
create or replace function public.objetivos_semana_cerrada()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lunes date;
begin
  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;
  if (select auth.uid()) is null then
    return coalesce(new, old);
  end if;
  v_lunes := public.lunes_semana_bogota(now());
  if tg_op in ('UPDATE', 'DELETE') and old.semana_inicio < v_lunes then
    raise exception 'semana_cerrada' using detail = 'Los objetivos de semanas anteriores son inmutables.';
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.semana_inicio < v_lunes then
    raise exception 'semana_cerrada' using detail = 'No se pueden crear ni mover objetivos a semanas anteriores.';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger objetivos_semana_cerrada
  before insert or update or delete on public.objetivos_atencion
  for each row execute function public.objetivos_semana_cerrada();
revoke execute on function public.objetivos_semana_cerrada() from public, anon, authenticated;

-- Hábitos nuevos: tablas independientes de `habitos` y `habito_registros` (Salud heredado no se toca).
create table public.habitos_config (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre          text not null check (length(btrim(nombre)) > 0),
  modo_registro   text not null check (modo_registro in ('manual', 'temporizador')),
  archivado_desde date,
  creado_en       timestamptz not null default now()
);
create index habitos_config_usuario_idx on public.habitos_config (user_id);

create table public.habitos_config_versiones (
  habito_id     uuid not null references public.habitos_config (id),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vigente_desde date not null,
  frecuencia    text not null check (frecuencia in ('diaria', 'dias')),
  dias_semana   smallint[] not null default '{}',
  objetivo_s    integer not null check (objetivo_s > 0),
  creado_en     timestamptz not null default now(),
  primary key (habito_id, vigente_desde),
  constraint versiones_dias_coherentes check (
    (frecuencia = 'diaria' and cardinality(dias_semana) = 0)
    or (frecuencia = 'dias' and cardinality(dias_semana) between 1 and 7
        and dias_semana <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[])
  )
);
create index habitos_versiones_usuario_idx on public.habitos_config_versiones (user_id);

create table public.habito_temporizadores (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habito_id     uuid not null references public.habitos_config (id),
  estado        text not null default 'en_curso' check (estado in ('en_curso', 'pausado', 'finalizado', 'cancelado')),
  iniciado_en   timestamptz not null default now(),
  tramo_inicio  timestamptz,
  finalizado_en timestamptz,
  version       integer not null default 1,
  constraint habito_temp_coherente check (
    (estado = 'en_curso' and tramo_inicio is not null and finalizado_en is null)
    or (estado = 'pausado' and tramo_inicio is null and finalizado_en is null)
    or (estado in ('finalizado', 'cancelado') and tramo_inicio is null and finalizado_en is not null)
  )
);
create unique index habito_temp_uno_activo on public.habito_temporizadores (user_id)
  where estado in ('en_curso', 'pausado');
create index habito_temp_habito_idx on public.habito_temporizadores (habito_id);

create table public.habito_segmentos (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  temporizador_id uuid not null references public.habito_temporizadores (id),
  habito_id       uuid not null references public.habitos_config (id),
  fecha           date not null,
  inicio          timestamptz not null,
  fin             timestamptz not null,
  segundos        integer not null check (segundos >= 0),
  acreditado      boolean not null,
  reemplazado_en  timestamptz,
  op_id           uuid,
  unique (temporizador_id, inicio),
  check (fin > inicio)
);
create index habito_segmentos_habito_fecha_idx on public.habito_segmentos (habito_id, fecha);

create table public.habito_tiempo (
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habito_id      uuid not null references public.habitos_config (id),
  fecha          date not null,
  manual_s       integer check (manual_s >= 0),
  temporizador_s integer not null default 0 check (temporizador_s >= 0),
  fuente         text not null check (fuente in ('manual', 'temporizador')),
  actualizado_en timestamptz not null default now(),
  primary key (habito_id, fecha)
);
create index habito_tiempo_usuario_fecha_idx on public.habito_tiempo (user_id, fecha);

create table public.habito_tiempo_historial (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habito_id        uuid not null references public.habitos_config (id),
  fecha            date not null,
  valor_anterior_s integer,
  valor_nuevo_s    integer not null,
  fuente           text not null check (fuente in ('manual', 'temporizador')),
  dispositivo_id   uuid,
  op_id            uuid,
  creado_en        timestamptz not null default now()
);
create index habito_historial_idx on public.habito_tiempo_historial (habito_id, fecha, creado_en);

-- RLS
alter table public.habitos_config           enable row level security;
alter table public.habitos_config_versiones enable row level security;
alter table public.habito_temporizadores    enable row level security;
alter table public.habito_segmentos         enable row level security;
alter table public.habito_tiempo            enable row level security;
alter table public.habito_tiempo_historial  enable row level security;

create policy "ver propios" on public.habitos_config           for select to authenticated using ((select auth.uid()) = user_id);
create policy "editar propios" on public.habitos_config
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "ver propios" on public.habitos_config_versiones for select to authenticated using ((select auth.uid()) = user_id);
create policy "ver propios" on public.habito_temporizadores    for select to authenticated using ((select auth.uid()) = user_id);
create policy "ver propios" on public.habito_segmentos         for select to authenticated using ((select auth.uid()) = user_id);
create policy "ver propios" on public.habito_tiempo            for select to authenticated using ((select auth.uid()) = user_id);
create policy "ver propios" on public.habito_tiempo_historial  for select to authenticated using ((select auth.uid()) = user_id);

-- T-8c: higiene de privilegios. Solo lectura para el cliente: se revoca todo y se concede únicamente SELECT.
revoke all on public.habitos_config           from authenticated, anon;
revoke all on public.habitos_config_versiones from authenticated, anon;
revoke all on public.habito_temporizadores    from authenticated, anon;
revoke all on public.habito_segmentos         from authenticated, anon;
revoke all on public.habito_tiempo            from authenticated, anon;
revoke all on public.habito_tiempo_historial  from authenticated, anon;
grant select on public.habitos_config_versiones to authenticated;
grant select on public.habito_temporizadores    to authenticated;
grant select on public.habito_segmentos         to authenticated;
grant select on public.habito_tiempo            to authenticated;
grant select on public.habito_tiempo_historial  to authenticated;
grant select, update (nombre, modo_registro) on public.habitos_config to authenticated;   -- columnas editables por el cliente
-- objetivos_atencion es CRUD del propietario: sin privilegios para anon ni residuales (TRUNCATE, REFERENCES, TRIGGER y, desde PostgreSQL 17, MAINTAIN): se revoca todo y se concede solo el CRUD.
revoke all on public.objetivos_atencion from anon;
revoke all on public.objetivos_atencion from authenticated;
grant select, insert, update, delete on public.objetivos_atencion to authenticated;   -- PostgreSQL 17 añade MAINTAIN a los privilegios por defecto: «revoke truncate, references, trigger» no lo quitaba

-- ---------- Auxiliares internas ----------
-- ¿El hábito tiene ocurrencia programada en esa fecha? (versión vigente hacia delante; respeta archivado)
create or replace function public._hay_ocurrencia(p_habito uuid, p_fecha date)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.habitos_config h
    join lateral (
      select v.frecuencia, v.dias_semana
      from public.habitos_config_versiones v
      where v.habito_id = h.id and v.vigente_desde <= p_fecha
      order by v.vigente_desde desc
      limit 1
    ) v on true
    where h.id = p_habito
      and (h.archivado_desde is null or p_fecha < h.archivado_desde)
      and (v.frecuencia = 'diaria'
           or (extract(isodow from p_fecha)::integer - 1)::smallint = any (v.dias_semana))
  );
$$;

-- Cierra un tramo del temporizador: lo parte por día local (America/Bogota), conserva cada segmento y acredita
-- solo los de fechas con ocurrencia. Debe llamarse ANTES de modificar la fila del temporizador.
create or replace function public._cerrar_tramo(
  p_uid uuid, p_t public.habito_temporizadores, p_fin timestamptz, p_op uuid, p_disp uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_d     date;
  v_ini   timestamptz;
  v_fin   timestamptz;
  v_seg   integer;
  v_acre  boolean;
  v_prev  integer;
  v_nuevo integer;
begin
  for v_d in
    select g::date
    from generate_series((p_t.tramo_inicio at time zone 'America/Bogota')::date::timestamp,
                         (p_fin at time zone 'America/Bogota')::date::timestamp, interval '1 day') as g
  loop
    v_ini := greatest(p_t.tramo_inicio, (v_d::timestamp at time zone 'America/Bogota'));
    v_fin := least(p_fin, ((v_d + 1)::timestamp at time zone 'America/Bogota'));
    v_seg := floor(extract(epoch from (v_fin - v_ini)))::integer;
    if v_seg <= 0 then
      continue;
    end if;
    v_acre := public._hay_ocurrencia(p_t.habito_id, v_d);
    insert into public.habito_segmentos
      (user_id, temporizador_id, habito_id, fecha, inicio, fin, segundos, acreditado, op_id)
    values (p_uid, p_t.id, p_t.habito_id, v_d, v_ini, v_fin, v_seg, v_acre, p_op);
    if v_acre then
      -- Serializa con otros escritores de la misma ocurrencia (registro manual, otro cierre de tramo).
      perform pg_advisory_xact_lock(hashtextextended(p_t.habito_id::text || '|' || v_d::text, 0));
      select coalesce(t.manual_s, 0) + t.temporizador_s into v_prev
        from public.habito_tiempo t where t.habito_id = p_t.habito_id and t.fecha = v_d;
      insert into public.habito_tiempo (user_id, habito_id, fecha, temporizador_s, fuente)
      values (p_uid, p_t.habito_id, v_d, v_seg, 'temporizador')
      on conflict (habito_id, fecha) do update
        set temporizador_s = public.habito_tiempo.temporizador_s + excluded.temporizador_s,
            fuente = 'temporizador', actualizado_en = now();
      v_nuevo := coalesce(v_prev, 0) + v_seg;
      insert into public.habito_tiempo_historial
        (user_id, habito_id, fecha, valor_anterior_s, valor_nuevo_s, fuente, dispositivo_id, op_id)
      values (p_uid, p_t.habito_id, v_d, v_prev, v_nuevo, 'temporizador', p_disp, p_op);
    end if;
  end loop;
end;
$$;

-- ---------- Configuración de hábitos ----------
create or replace function public.habito_crear(
  p_op_id uuid, p_dispositivo_id uuid, p_seq bigint,
  p_nombre text, p_modo text, p_frecuencia text, p_dias smallint[], p_objetivo_s integer,
  p_desde date default null)
returns public.habitos_config
language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := public._uid();
  v_op    public.operaciones := public._op_existente(v_uid, p_op_id);
  v_hoy   date := (now() at time zone 'America/Bogota')::date;
  v_desde date := coalesce(p_desde, (now() at time zone 'America/Bogota')::date);
  v_dias  smallint[];
  v_h     public.habitos_config;
begin
  -- Idempotencia: la misma operación devuelve el hábito ya creado (sin duplicar).
  if v_op.op_id is not null then
    select * into v_h from public.habitos_config where id = v_op.objetivo_id and user_id = v_uid;
    return v_h;
  end if;
  if nullif(btrim(p_nombre), '') is null
     or p_modo not in ('manual', 'temporizador')
     or p_frecuencia not in ('diaria', 'dias')
     or p_objetivo_s is null or p_objetivo_s <= 0 then
    raise exception 'parametro_invalido';
  end if;
  if v_desde < v_hoy then raise exception 'fecha_no_permitida'; end if;
  if p_frecuencia = 'dias' then
    select coalesce(array_agg(distinct d order by d), '{}'::smallint[]) into v_dias
      from unnest(p_dias) as d where d between 0 and 6;
    if cardinality(v_dias) = 0 then raise exception 'parametro_invalido'; end if;
  else
    v_dias := '{}'::smallint[];
  end if;
  insert into public.habitos_config (user_id, nombre, modo_registro)
  values (v_uid, btrim(p_nombre), p_modo) returning * into v_h;
  insert into public.habitos_config_versiones (habito_id, user_id, vigente_desde, frecuencia, dias_semana, objetivo_s)
  values (v_h.id, v_uid, v_desde, p_frecuencia, v_dias, p_objetivo_s);
  perform public._journal(v_uid, p_op_id, p_dispositivo_id, p_seq, 'habito_crear', 'habito_config', v_h.id,
    jsonb_build_object('nombre', v_h.nombre), 'aplicada', null);
  return v_h;
end;
$$;
create or replace function public.habito_programar(
  p_habito_id uuid, p_frecuencia text, p_dias smallint[], p_objetivo_s integer, p_desde date)
returns public.habitos_config_versiones
language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := public._uid();
  v_hoy  date := (now() at time zone 'America/Bogota')::date;
  v_dias smallint[];
  v_v    public.habitos_config_versiones;
begin
  if not exists (select 1 from public.habitos_config where id = p_habito_id and user_id = v_uid) then
    raise exception 'habito_invalido';
  end if;
  if p_frecuencia not in ('diaria', 'dias') or p_objetivo_s is null or p_objetivo_s <= 0 or p_desde is null then
    raise exception 'parametro_invalido';
  end if;
  if p_desde < v_hoy then raise exception 'fecha_no_permitida'; end if;  -- la programación rige hacia delante
  if p_frecuencia = 'dias' then
    select coalesce(array_agg(distinct d order by d), '{}'::smallint[]) into v_dias
      from unnest(p_dias) as d where d between 0 and 6;
    if cardinality(v_dias) = 0 then raise exception 'parametro_invalido'; end if;
  else
    v_dias := '{}'::smallint[];
  end if;
  begin
    insert into public.habitos_config_versiones (habito_id, user_id, vigente_desde, frecuencia, dias_semana, objetivo_s)
    values (p_habito_id, v_uid, p_desde, p_frecuencia, v_dias, p_objetivo_s)
    returning * into v_v;
  exception when unique_violation then
    raise exception 'version_existente';
  end;
  return v_v;
end;
$$;

create or replace function public.habito_archivar(p_habito_id uuid, p_desde date default null)
returns public.habitos_config
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public._uid();
  v_hoy date := (now() at time zone 'America/Bogota')::date;
  v_h   public.habitos_config;
begin
  if p_desde is not null and p_desde < v_hoy then raise exception 'fecha_no_permitida'; end if;
  update public.habitos_config
     set archivado_desde = coalesce(p_desde, v_hoy + 1)
   where id = p_habito_id and user_id = v_uid
  returning * into v_h;
  if not found then raise exception 'habito_invalido'; end if;
  return v_h;
end;
$$;

-- ---------- Temporizador de hábito ----------
create or replace function public.habito_timer_iniciar(
  p_op_id uuid, p_dispositivo_id uuid, p_seq bigint, p_habito_id uuid)
returns public.habito_temporizadores
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public._uid();
  v_op  public.operaciones := public._op_existente(v_uid, p_op_id);
  v_hoy date := (now() at time zone 'America/Bogota')::date;
  v_h   public.habitos_config;
  v_t   public.habito_temporizadores;
  v_id  uuid := gen_random_uuid();
  v_det text;
begin
  if v_op.op_id is not null then
    select * into v_t from public.habito_temporizadores where id = v_op.objetivo_id and user_id = v_uid;
    return v_t;
  end if;
  select * into v_h from public.habitos_config where id = p_habito_id and user_id = v_uid;
  if not found or (v_h.archivado_desde is not null and v_h.archivado_desde <= v_hoy) then
    raise exception 'habito_invalido';
  end if;
  if v_h.modo_registro <> 'temporizador' then raise exception 'modo_no_temporizador'; end if;  -- T-13
  begin
    insert into public.temporizador_activo (user_id, tipo, ref_id, estado)
    values (v_uid, 'habito', v_id, 'corriendo');
  exception when unique_violation then
    select tipo || ':' || ref_id::text || ':' || estado into v_det
      from public.temporizador_activo where user_id = v_uid;
    raise exception 'temporizador_ocupado' using detail = v_det;
  end;
  insert into public.habito_temporizadores (id, user_id, habito_id, tramo_inicio)
  values (v_id, v_uid, p_habito_id, now()) returning * into v_t;
  perform public._journal(v_uid, p_op_id, p_dispositivo_id, p_seq, 'habito_iniciar', 'habito_timer', v_id,
    jsonb_build_object('habito_id', p_habito_id), 'aplicada', null);
  return v_t;
end;
$$;

create or replace function public.habito_timer_pausar(
  p_op_id uuid, p_dispositivo_id uuid, p_seq bigint, p_temporizador_id uuid)
returns public.habito_temporizadores
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public._uid();
  v_op  public.operaciones := public._op_existente(v_uid, p_op_id);
  v_t   public.habito_temporizadores;
begin
  if v_op.op_id is not null then
    select * into v_t from public.habito_temporizadores where id = v_op.objetivo_id and user_id = v_uid;
    return v_t;
  end if;
  select * into v_t from public.habito_temporizadores where id = p_temporizador_id and user_id = v_uid for update;
  if not found then raise exception 'temporizador_no_encontrado'; end if;
  if v_t.estado = 'pausado' then
    perform public._journal(v_uid, p_op_id, p_dispositivo_id, p_seq, 'habito_pausar', 'habito_timer', v_t.id,
      '{}'::jsonb, 'fusionada', 'ya_estaba_pausado');
    return v_t;
  end if;
  if v_t.estado <> 'en_curso' then raise exception 'transicion_invalida' using detail = v_t.estado; end if;
  perform public._cerrar_tramo(v_uid, v_t, now(), p_op_id, p_dispositivo_id);
  update public.habito_temporizadores
     set estado = 'pausado', tramo_inicio = null, version = version + 1
   where id = v_t.id returning * into v_t;
  update public.temporizador_activo
     set estado = 'pausado', version = version + 1, actualizado_en = now()
   where user_id = v_uid and tipo = 'habito' and ref_id = v_t.id;
  perform public._journal(v_uid, p_op_id, p_dispositivo_id, p_seq, 'habito_pausar', 'habito_timer', v_t.id,
    '{}'::jsonb, 'aplicada', null);
  return v_t;
end;
$$;

create or replace function public.habito_timer_reanudar(
  p_op_id uuid, p_dispositivo_id uuid, p_seq bigint, p_temporizador_id uuid)
returns public.habito_temporizadores
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public._uid();
  v_op  public.operaciones := public._op_existente(v_uid, p_op_id);
  v_t   public.habito_temporizadores;
begin
  if v_op.op_id is not null then
    select * into v_t from public.habito_temporizadores where id = v_op.objetivo_id and user_id = v_uid;
    return v_t;
  end if;
  select * into v_t from public.habito_temporizadores where id = p_temporizador_id and user_id = v_uid for update;
  if not found then raise exception 'temporizador_no_encontrado'; end if;
  if v_t.estado = 'en_curso' then
    perform public._journal(v_uid, p_op_id, p_dispositivo_id, p_seq, 'habito_reanudar', 'habito_timer', v_t.id,
      '{}'::jsonb, 'fusionada', 'ya_estaba_en_curso');
    return v_t;
  end if;
  if v_t.estado <> 'pausado' then raise exception 'transicion_invalida' using detail = v_t.estado; end if;
  update public.habito_temporizadores
     set estado = 'en_curso', tramo_inicio = now(), version = version + 1
   where id = v_t.id returning * into v_t;
  update public.temporizador_activo
     set estado = 'corriendo', version = version + 1, actualizado_en = now()
   where user_id = v_uid and tipo = 'habito' and ref_id = v_t.id;
  perform public._journal(v_uid, p_op_id, p_dispositivo_id, p_seq, 'habito_reanudar', 'habito_timer', v_t.id,
    '{}'::jsonb, 'aplicada', null);
  return v_t;
end;
$$;

create or replace function public.habito_timer_finalizar(
  p_op_id uuid, p_dispositivo_id uuid, p_seq bigint, p_temporizador_id uuid)
returns public.habito_temporizadores
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public._uid();
  v_op  public.operaciones := public._op_existente(v_uid, p_op_id);
  v_t   public.habito_temporizadores;
begin
  if v_op.op_id is not null then
    select * into v_t from public.habito_temporizadores where id = v_op.objetivo_id and user_id = v_uid;
    return v_t;
  end if;
  select * into v_t from public.habito_temporizadores where id = p_temporizador_id and user_id = v_uid for update;
  if not found then raise exception 'temporizador_no_encontrado'; end if;
  if v_t.estado in ('finalizado', 'cancelado') then
    perform public._journal(v_uid, p_op_id, p_dispositivo_id, p_seq, 'habito_finalizar', 'habito_timer', v_t.id,
      '{}'::jsonb, case when v_t.estado = 'finalizado' then 'duplicada' else 'conflicto' end, 'ya_finalizado');
    return v_t;
  end if;
  if v_t.estado = 'en_curso' then
    perform public._cerrar_tramo(v_uid, v_t, now(), p_op_id, p_dispositivo_id);
  end if;
  update public.habito_temporizadores
     set estado = 'finalizado', tramo_inicio = null, finalizado_en = now(), version = version + 1
   where id = v_t.id returning * into v_t;
  delete from public.temporizador_activo where user_id = v_uid and tipo = 'habito' and ref_id = v_t.id;
  perform public._journal(v_uid, p_op_id, p_dispositivo_id, p_seq, 'habito_finalizar', 'habito_timer', v_t.id,
    '{}'::jsonb, 'aplicada', null);
  return v_t;
end;
$$;

-- T-3: cancelar descarta solo el tramo en curso; los tramos ya cerrados quedan acreditados.
create or replace function public.habito_timer_cancelar(
  p_op_id uuid, p_dispositivo_id uuid, p_seq bigint, p_temporizador_id uuid)
returns public.habito_temporizadores
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public._uid();
  v_op  public.operaciones := public._op_existente(v_uid, p_op_id);
  v_t   public.habito_temporizadores;
begin
  if v_op.op_id is not null then
    select * into v_t from public.habito_temporizadores where id = v_op.objetivo_id and user_id = v_uid;
    return v_t;
  end if;
  select * into v_t from public.habito_temporizadores where id = p_temporizador_id and user_id = v_uid for update;
  if not found then raise exception 'temporizador_no_encontrado'; end if;
  if v_t.estado in ('finalizado', 'cancelado') then
    perform public._journal(v_uid, p_op_id, p_dispositivo_id, p_seq, 'habito_cancelar', 'habito_timer', v_t.id,
      '{}'::jsonb, case when v_t.estado = 'cancelado' then 'duplicada' else 'conflicto' end, 'ya_finalizado');
    return v_t;
  end if;
  update public.habito_temporizadores
     set estado = 'cancelado', tramo_inicio = null, finalizado_en = now(), version = version + 1
   where id = v_t.id returning * into v_t;
  delete from public.temporizador_activo where user_id = v_uid and tipo = 'habito' and ref_id = v_t.id;
  perform public._journal(v_uid, p_op_id, p_dispositivo_id, p_seq, 'habito_cancelar', 'habito_timer', v_t.id,
    '{}'::jsonb, 'aplicada', null);
  return v_t;
end;
$$;

-- ---------- Registro manual (reemplaza el tiempo vigente de la ocurrencia; conserva historial) ----------
create or replace function public.habito_registrar_manual(
  p_op_id uuid, p_dispositivo_id uuid, p_seq bigint, p_habito_id uuid, p_fecha date, p_segundos integer)
returns public.habito_tiempo
language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := public._uid();
  v_op   public.operaciones := public._op_existente(v_uid, p_op_id);
  v_hoy  date := (now() at time zone 'America/Bogota')::date;
  v_prev integer;
  v_t    public.habito_tiempo;
begin
  if v_op.op_id is not null then
    select * into v_t from public.habito_tiempo where habito_id = p_habito_id and user_id = v_uid and fecha = p_fecha;
    return v_t;
  end if;
  if not exists (select 1 from public.habitos_config where id = p_habito_id and user_id = v_uid) then
    raise exception 'habito_invalido';
  end if;
  if p_segundos is null or p_segundos < 0 or p_fecha is null then raise exception 'parametro_invalido'; end if;
  if p_fecha > v_hoy then raise exception 'fecha_no_permitida'; end if;
  if not public._hay_ocurrencia(p_habito_id, p_fecha) then raise exception 'sin_ocurrencia'; end if;  -- T-13

  -- Serializa con otros escritores de la misma ocurrencia para que el historial registre el valor anterior real.
  perform pg_advisory_xact_lock(hashtextextended(p_habito_id::text || '|' || p_fecha::text, 0));
  select coalesce(t.manual_s, 0) + t.temporizador_s into v_prev
    from public.habito_tiempo t where t.habito_id = p_habito_id and t.fecha = p_fecha;
  insert into public.habito_tiempo (user_id, habito_id, fecha, manual_s, temporizador_s, fuente)
  values (v_uid, p_habito_id, p_fecha, p_segundos, 0, 'manual')
  on conflict (habito_id, fecha) do update
    set manual_s = excluded.manual_s, temporizador_s = 0, fuente = 'manual', actualizado_en = now()
  returning * into v_t;
  update public.habito_segmentos
     set reemplazado_en = now()
   where habito_id = p_habito_id and fecha = p_fecha and acreditado and reemplazado_en is null;
  insert into public.habito_tiempo_historial
    (user_id, habito_id, fecha, valor_anterior_s, valor_nuevo_s, fuente, dispositivo_id, op_id)
  values (v_uid, p_habito_id, p_fecha, v_prev, p_segundos, 'manual', p_dispositivo_id, p_op_id);
  perform public._journal(v_uid, p_op_id, p_dispositivo_id, p_seq, 'habito_manual', 'habito_manual', p_habito_id,
    jsonb_build_object('fecha', p_fecha, 'segundos', p_segundos), 'aplicada', null);
  return v_t;
end;
$$;

-- ---------- Permisos de ejecución ----------
revoke execute on function public._hay_ocurrencia(uuid, date) from public, anon, authenticated;
revoke execute on function public._cerrar_tramo(uuid, public.habito_temporizadores, timestamptz, uuid, uuid)
  from public, anon, authenticated;

revoke execute on function public.habito_crear(uuid, uuid, bigint, text, text, text, smallint[], integer, date) from public, anon;
revoke execute on function public.habito_programar(uuid, text, smallint[], integer, date)   from public, anon;
revoke execute on function public.habito_archivar(uuid, date)                               from public, anon;
revoke execute on function public.habito_timer_iniciar(uuid, uuid, bigint, uuid)            from public, anon;
revoke execute on function public.habito_timer_pausar(uuid, uuid, bigint, uuid)             from public, anon;
revoke execute on function public.habito_timer_reanudar(uuid, uuid, bigint, uuid)           from public, anon;
revoke execute on function public.habito_timer_finalizar(uuid, uuid, bigint, uuid)          from public, anon;
revoke execute on function public.habito_timer_cancelar(uuid, uuid, bigint, uuid)           from public, anon;
revoke execute on function public.habito_registrar_manual(uuid, uuid, bigint, uuid, date, integer) from public, anon;

grant execute on function public.habito_crear(uuid, uuid, bigint, text, text, text, smallint[], integer, date) to authenticated;
grant execute on function public.habito_programar(uuid, text, smallint[], integer, date)   to authenticated;
grant execute on function public.habito_archivar(uuid, date)                               to authenticated;
grant execute on function public.habito_timer_iniciar(uuid, uuid, bigint, uuid)            to authenticated;
grant execute on function public.habito_timer_pausar(uuid, uuid, bigint, uuid)             to authenticated;
grant execute on function public.habito_timer_reanudar(uuid, uuid, bigint, uuid)           to authenticated;
grant execute on function public.habito_timer_finalizar(uuid, uuid, bigint, uuid)          to authenticated;
grant execute on function public.habito_timer_cancelar(uuid, uuid, bigint, uuid)           to authenticated;
grant execute on function public.habito_registrar_manual(uuid, uuid, bigint, uuid, date, integer) to authenticated;

commit;
