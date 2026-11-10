-- ============================================================================
-- FASE 3 · v1.11 · Etapa 2 · aplicar
-- Extraído de docs/MIGRACIONES-FASE-3-v1.11.md (esa es la fuente).
-- NO se ha ejecutado en Supabase. Validado completo (404 PASS, 0 FAIL, 2 NOT RUN) solo en un PostgreSQL 16 local y desechable: docs/VALIDACION-LOCAL-FASE-3-v1.11.md.
-- Antes de cualquier ejecución: etapa 0 (verificación de roles y permisos) y autorización expresa por etapa.
-- ============================================================================
begin;

-- Utilidad: mantiene actualizado_en.
create or replace function public._tocar_actualizado_en()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;
revoke execute on function public._tocar_actualizado_en() from public, anon, authenticated;

-- Preferencias de Focus (una fila por usuario; sin fila = valores iniciales).
create table public.preferencias_usuario (
  user_id            uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  focus_min          integer not null default 30 check (focus_min between 1 and 240),
  descanso_corto_min integer not null default 5  check (descanso_corto_min between 1 and 60),
  descanso_largo_min integer not null default 20 check (descanso_largo_min between 1 and 120),
  ciclos_para_largo  integer not null default 4  check (ciclos_para_largo between 2 and 12),
  avisos             boolean not null default true,
  sonido             boolean not null default true,
  actualizado_en     timestamptz not null default now()
);
alter table public.preferencias_usuario enable row level security;
create policy "propios" on public.preferencias_usuario
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create trigger preferencias_tocar before update on public.preferencias_usuario
  for each row execute function public._tocar_actualizado_en();

-- Bloqueo global: una sola fila por usuario garantiza un temporizador activo.
create table public.temporizador_activo (
  user_id        uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  tipo           text not null check (tipo in ('focus', 'descanso', 'habito')),
  ref_id         uuid not null,
  estado         text not null check (estado in ('corriendo', 'pausado')),
  version        integer not null default 1,
  iniciado_en    timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- Sesiones de Focus.
create table public.focus_sesiones (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  modalidad           text not null check (modalidad in ('productivity', 'enjoyment')),
  frente_id           text not null check (frente_id in ('tanku', 'ticketcode', 'personal', 'salud', 'familia', 'otros')),
  actividad           text,
  intencion           text,
  pendiente_id        uuid references public.pendientes (id) on delete set null,
  duracion_objetivo_s integer not null check (duracion_objetivo_s > 0),
  estado              text not null default 'en_curso'
                      check (estado in ('en_curso', 'pausada', 'completada', 'parcial', 'cancelada')),
  iniciado_en         timestamptz not null default now(),
  tramo_inicio        timestamptz,
  acumulado_s         integer not null default 0 check (acumulado_s >= 0),
  finalizado_en       timestamptz,
  tiempo_efectivo_s   integer check (tiempo_efectivo_s >= 0),
  puntos              smallint not null default 0,
  version             integer not null default 1,
  constraint focus_puntos_coherentes check (
    (estado = 'completada' and puntos = 1) or (estado <> 'completada' and puntos = 0)
  ),
  constraint focus_estado_coherente check (
    (estado = 'en_curso' and tramo_inicio is not null and finalizado_en is null and tiempo_efectivo_s is null)
    or (estado = 'pausada' and tramo_inicio is null and finalizado_en is null and tiempo_efectivo_s is null)
    or (estado in ('completada', 'parcial', 'cancelada')
        and tramo_inicio is null and finalizado_en is not null and tiempo_efectivo_s is not null)
  )
);
create unique index focus_sesiones_una_activa
  on public.focus_sesiones (user_id) where estado in ('en_curso', 'pausada');
create index focus_sesiones_usuario_fin_idx on public.focus_sesiones (user_id, finalizado_en);
create index focus_sesiones_frente_fin_idx  on public.focus_sesiones (user_id, frente_id, finalizado_en);
create index focus_sesiones_pendiente_idx   on public.focus_sesiones (pendiente_id) where pendiente_id is not null;

-- Descansos y su decisión (el contador de ciclos se deriva de estas dos tablas).
create table public.descansos (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo                text not null check (tipo in ('corto', 'largo')),
  estado              text not null check (estado in ('en_curso', 'pausado', 'completado', 'omitido')),
  motivo_omision      text check (motivo_omision in ('usuario', 'inicio_focus', 'cancelado')),
  sesion_origen_id    uuid references public.focus_sesiones (id) on delete set null,
  duracion_objetivo_s integer not null check (duracion_objetivo_s > 0),
  iniciado_en         timestamptz,
  tramo_inicio        timestamptz,
  acumulado_s         integer not null default 0 check (acumulado_s >= 0),
  finalizado_en       timestamptz,
  version             integer not null default 1,
  constraint descansos_estado_coherente check (
    (estado = 'en_curso' and iniciado_en is not null and tramo_inicio is not null
       and finalizado_en is null and motivo_omision is null)
    or (estado = 'pausado' and iniciado_en is not null and tramo_inicio is null
       and finalizado_en is null and motivo_omision is null)
    or (estado = 'completado' and iniciado_en is not null and tramo_inicio is null
       and finalizado_en is not null and motivo_omision is null)
    or (estado = 'omitido' and tramo_inicio is null and finalizado_en is not null and motivo_omision is not null)
  )
);
create index descansos_largos_idx on public.descansos (user_id, finalizado_en) where tipo = 'largo';
create index descansos_origen_idx on public.descansos (sesion_origen_id) where sesion_origen_id is not null;

-- Diario de operaciones: idempotencia, secuencias, causalidad, conflictos.
create table public.operaciones (
  user_id                 uuid not null default auth.uid() references auth.users (id) on delete cascade,
  op_id                   uuid not null,
  dispositivo_id          uuid not null,
  seq                     bigint not null check (seq >= 0),
  depende_de              uuid,
  tipo                    text not null check (tipo in (
    'focus_iniciar', 'focus_pausar', 'focus_reanudar', 'focus_completar', 'focus_cancelar',
    'descanso_iniciar', 'descanso_pausar', 'descanso_reanudar', 'descanso_completar',
    'descanso_omitir', 'descanso_cancelar',
    'habito_iniciar', 'habito_pausar', 'habito_reanudar', 'habito_finalizar', 'habito_cancelar',
    'habito_manual', 'habito_crear')),
  objetivo_tipo           text not null check (objetivo_tipo in ('focus', 'descanso', 'habito_timer', 'habito_manual', 'habito_config')),
  objetivo_id             uuid,
  payload                 jsonb not null default '{}'::jsonb,
  ocurrido_en_dispositivo timestamptz not null,
  ocurrido_en_ajustado    timestamptz,
  desfase_s               integer,
  recibido_en             timestamptz not null default now(),
  resultado               text not null check (resultado in (
    'aplicada', 'duplicada', 'fusionada', 'rechazada', 'conflicto', 'pendiente_dependencia')),
  motivo                  text,
  notificada              boolean not null default false,
  primary key (user_id, op_id),
  unique (user_id, dispositivo_id, seq)
);
create index operaciones_objetivo_idx on public.operaciones (user_id, objetivo_tipo, objetivo_id, recibido_en);
create index operaciones_sin_notificar_idx on public.operaciones (user_id)
  where resultado in ('rechazada', 'fusionada', 'conflicto') and not notificada;

-- RLS: lectura propia; la escritura se hace solo por las funciones RPC (T-1).
alter table public.temporizador_activo enable row level security;
alter table public.focus_sesiones      enable row level security;
alter table public.descansos           enable row level security;
alter table public.operaciones         enable row level security;

create policy "ver propios" on public.temporizador_activo for select to authenticated using ((select auth.uid()) = user_id);
create policy "ver propios" on public.focus_sesiones      for select to authenticated using ((select auth.uid()) = user_id);
create policy "ver propios" on public.descansos           for select to authenticated using ((select auth.uid()) = user_id);
create policy "ver propios" on public.operaciones         for select to authenticated using ((select auth.uid()) = user_id);
create policy "marcar notificadas" on public.operaciones
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- T-8c: higiene de privilegios. Solo lectura para el cliente: se revoca todo y se concede únicamente SELECT.
revoke all on public.temporizador_activo from authenticated, anon;
revoke all on public.focus_sesiones      from authenticated, anon;
revoke all on public.descansos           from authenticated, anon;
revoke all on public.operaciones         from authenticated, anon;
grant select on public.temporizador_activo to authenticated;
grant select on public.focus_sesiones      to authenticated;
grant select on public.descansos           to authenticated;
grant select, update (notificada) on public.operaciones to authenticated;   -- única columna que el cliente puede actualizar
-- preferencias_usuario es CRUD del propietario: sin privilegios para anon ni residuales (TRUNCATE, REFERENCES, TRIGGER).
revoke all on public.preferencias_usuario from anon;
revoke truncate, references, trigger on public.preferencias_usuario from authenticated;

-- ---------- Funciones auxiliares internas (no ejecutables por el cliente) ----------
create or replace function public._uid()
returns uuid language plpgsql stable set search_path = '' as $$
declare v uuid := (select auth.uid());
begin
  if v is null then
    raise exception 'no_autenticado' using errcode = '28000';
  end if;
  return v;
end;
$$;

create or replace function public._prefs(p_uid uuid)
returns public.preferencias_usuario
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select p from public.preferencias_usuario p where p.user_id = p_uid),
    row(p_uid, 30, 5, 20, 4, true, true, now())::public.preferencias_usuario
  );
$$;

-- Volátil a propósito: toma un bloqueo consultivo por (usuario, op_id) y relee después, de modo que un reintento
-- simultáneo espera a la primera llamada y recibe su resultado almacenado (no un falso 	emporizador_ocupado).
create or replace function public._op_existente(p_uid uuid, p_op uuid)
returns public.operaciones
language plpgsql volatile security definer set search_path = '' as $$
declare r public.operaciones;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_uid::text || '|' || p_op::text, 0));
  select * into r from public.operaciones where user_id = p_uid and op_id = p_op;
  return r;
end;
$$;

create or replace function public._journal(
  p_uid uuid, p_op uuid, p_disp uuid, p_seq bigint, p_tipo text, p_obj_tipo text,
  p_obj_id uuid, p_payload jsonb, p_resultado text, p_motivo text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.operaciones
    (user_id, op_id, dispositivo_id, seq, tipo, objetivo_tipo, objetivo_id, payload,
     ocurrido_en_dispositivo, ocurrido_en_ajustado, resultado, motivo)
  values
    (p_uid, p_op, p_disp, p_seq, p_tipo, p_obj_tipo, p_obj_id, coalesce(p_payload, '{}'::jsonb),
     now(), now(), p_resultado, p_motivo);
end;
$$;

-- Contador de ciclos: sesiones completadas posteriores al último descanso largo completado u omitido.
create or replace function public._ciclos_desde_ultimo_largo(p_uid uuid)
returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer
  from public.focus_sesiones s
  where s.user_id = p_uid
    and s.estado = 'completada'
    and s.finalizado_en > coalesce(
      (select max(d.finalizado_en) from public.descansos d
        where d.user_id = p_uid and d.tipo = 'largo' and d.estado in ('completado', 'omitido')),
      '-infinity'::timestamptz);
$$;

-- ---------- Focus ----------
create or replace function public.focus_iniciar(
  p_op_id uuid, p_dispositivo_id uuid, p_seq bigint,
  p_modalidad text, p_frente_id text,
  p_actividad text default null, p_intencion text default null, p_pendiente_id uuid default null)
returns public.focus_sesiones
language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := public._uid();
  v_op   public.operaciones := public._op_existente(v_uid, p_op_id);
  v_pref public.preferencias_usuario;
  v_s    public.focus_sesiones;
  v_id   uuid := gen_random_uuid();
  v_det  text;
begin
  if v_op.op_id is not null then
    select * into v_s from public.focus_sesiones where id = v_op.objetivo_id and user_id = v_uid;
    return v_s;
  end if;
  if p_modalidad not in ('productivity', 'enjoyment')
     or p_frente_id not in ('tanku', 'ticketcode', 'personal', 'salud', 'familia', 'otros') then
    raise exception 'parametro_invalido';
  end if;
  if p_pendiente_id is not null
     and not exists (select 1 from public.pendientes where id = p_pendiente_id and user_id = v_uid) then
    raise exception 'pendiente_invalido';
  end if;
  v_pref := public._prefs(v_uid);

  begin
    insert into public.temporizador_activo (user_id, tipo, ref_id, estado)
    values (v_uid, 'focus', v_id, 'corriendo');
  exception when unique_violation then
    select tipo || ':' || ref_id::text || ':' || estado into v_det
      from public.temporizador_activo where user_id = v_uid;
    raise exception 'temporizador_ocupado' using detail = v_det;
  end;

  -- P9: iniciar otro Focus con la sugerencia de descanso largo pendiente cuenta como omitirlo.
  if public._ciclos_desde_ultimo_largo(v_uid) >= v_pref.ciclos_para_largo then
    insert into public.descansos (user_id, tipo, estado, motivo_omision, duracion_objetivo_s, finalizado_en)
    values (v_uid, 'largo', 'omitido', 'inicio_focus', v_pref.descanso_largo_min * 60, now());
  end if;

  insert into public.focus_sesiones
    (id, user_id, modalidad, frente_id, actividad, intencion, pendiente_id, duracion_objetivo_s, tramo_inicio)
  values
    (v_id, v_uid, p_modalidad, p_frente_id, nullif(btrim(p_actividad), ''), nullif(btrim(p_intencion), ''),
     p_pendiente_id, v_pref.focus_min * 60, now())
  returning * into v_s;

  perform public._journal(v_uid, p_op_id, p_dispositivo_id, p_seq, 'focus_iniciar', 'focus', v_id,
    jsonb_build_object('modalidad', p_modalidad, 'frente_id', p_frente_id), 'aplicada', null);
  return v_s;
end;
$$;

create or replace function public.focus_pausar(
  p_op_id uuid, p_dispositivo_id uuid, p_seq bigint, p_sesion_id uuid)
returns public.focus_sesiones
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public._uid();
  v_op  public.operaciones := public._op_existente(v_uid, p_op_id);
  v_s   public.focus_sesiones;
begin
  if v_op.op_id is not null then
    select * into v_s from public.focus_sesiones where id = v_op.objetivo_id and user_id = v_uid;
    return v_s;
  end if;
  select * into v_s from public.focus_sesiones where id = p_sesion_id and user_id = v_uid for update;
  if not found then raise exception 'sesion_no_encontrada'; end if;
  if v_s.estado = 'pausada' then
    perform public._journal(v_uid, p_op_id, p_dispositivo_id, p_seq, 'focus_pausar', 'focus', v_s.id,
      '{}'::jsonb, 'fusionada', 'ya_estaba_pausada');
    return v_s;
  end if;
  if v_s.estado <> 'en_curso' then
    raise exception 'transicion_invalida' using detail = v_s.estado;
  end if;
  update public.focus_sesiones
     set estado = 'pausada',
         acumulado_s = acumulado_s + greatest(0, floor(extract(epoch from (now() - tramo_inicio)))::integer),
         tramo_inicio = null,
         version = version + 1
   where id = v_s.id
  returning * into v_s;
  update public.temporizador_activo
     set estado = 'pausado', version = version + 1, actualizado_en = now()
   where user_id = v_uid and tipo = 'focus' and ref_id = v_s.id;
  perform public._journal(v_uid, p_op_id, p_dispositivo_id, p_seq, 'focus_pausar', 'focus', v_s.id,
    '{}'::jsonb, 'aplicada', null);
  return v_s;
end;
$$;

create or replace function public.focus_reanudar(
  p_op_id uuid, p_dispositivo_id uuid, p_seq bigint, p_sesion_id uuid)
returns public.focus_sesiones
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public._uid();
  v_op  public.operaciones := public._op_existente(v_uid, p_op_id);
  v_s   public.focus_sesiones;
begin
  if v_op.op_id is not null then
    select * into v_s from public.focus_sesiones where id = v_op.objetivo_id and user_id = v_uid;
    return v_s;
  end if;
  select * into v_s from public.focus_sesiones where id = p_sesion_id and user_id = v_uid for update;
  if not found then raise exception 'sesion_no_encontrada'; end if;
  if v_s.estado = 'en_curso' then
    perform public._journal(v_uid, p_op_id, p_dispositivo_id, p_seq, 'focus_reanudar', 'focus', v_s.id,
      '{}'::jsonb, 'fusionada', 'ya_estaba_en_curso');
    return v_s;
  end if;
  if v_s.estado <> 'pausada' then
    raise exception 'transicion_invalida' using detail = v_s.estado;
  end if;
  update public.focus_sesiones
     set estado = 'en_curso', tramo_inicio = now(), version = version + 1
   where id = v_s.id
  returning * into v_s;
  update public.temporizador_activo
     set estado = 'corriendo', version = version + 1, actualizado_en = now()
   where user_id = v_uid and tipo = 'focus' and ref_id = v_s.id;
  perform public._journal(v_uid, p_op_id, p_dispositivo_id, p_seq, 'focus_reanudar', 'focus', v_s.id,
    '{}'::jsonb, 'aplicada', null);
  return v_s;
end;
$$;

create or replace function public.focus_completar(
  p_op_id uuid, p_dispositivo_id uuid, p_seq bigint, p_sesion_id uuid)
returns public.focus_sesiones
language plpgsql security definer set search_path = '' as $$
declare
  c_tolerancia constant integer := 2;  -- T-2: tolerancia en segundos para «completada» frente a «parcial»
  v_uid      uuid := public._uid();
  v_op       public.operaciones := public._op_existente(v_uid, p_op_id);
  v_s        public.focus_sesiones;
  v_efectivo integer;
  v_final    text;
begin
  if v_op.op_id is not null then
    select * into v_s from public.focus_sesiones where id = v_op.objetivo_id and user_id = v_uid;
    return v_s;
  end if;
  select * into v_s from public.focus_sesiones where id = p_sesion_id and user_id = v_uid for update;
  if not found then raise exception 'sesion_no_encontrada'; end if;
  if v_s.estado in ('completada', 'parcial') then
    perform public._journal(v_uid, p_op_id, p_dispositivo_id, p_seq, 'focus_completar', 'focus', v_s.id,
      '{}'::jsonb, 'duplicada', 'ya_finalizada');
    return v_s;
  elsif v_s.estado = 'cancelada' then
    perform public._journal(v_uid, p_op_id, p_dispositivo_id, p_seq, 'focus_completar', 'focus', v_s.id,
      '{}'::jsonb, 'conflicto', 'ya_cancelada');
    return v_s;
  end if;
  v_efectivo := v_s.acumulado_s + case when v_s.estado = 'en_curso'
    then greatest(0, round(extract(epoch from (now() - v_s.tramo_inicio)))::integer) else 0 end;
  v_final := case when v_efectivo >= v_s.duracion_objetivo_s - c_tolerancia then 'completada' else 'parcial' end;
  update public.focus_sesiones
     set estado = v_final,
         puntos = case when v_final = 'completada' then 1 else 0 end,
         tiempo_efectivo_s = v_efectivo,
         finalizado_en = now(),
         tramo_inicio = null,
         version = version + 1
   where id = v_s.id
  returning * into v_s;
  delete from public.temporizador_activo where user_id = v_uid and tipo = 'focus' and ref_id = v_s.id;
  perform public._journal(v_uid, p_op_id, p_dispositivo_id, p_seq, 'focus_completar', 'focus', v_s.id,
    jsonb_build_object('estado', v_final, 'tiempo_efectivo_s', v_efectivo), 'aplicada', null);
  return v_s;
end;
$$;

create or replace function public.focus_cancelar(
  p_op_id uuid, p_dispositivo_id uuid, p_seq bigint, p_sesion_id uuid)
returns public.focus_sesiones
language plpgsql security definer set search_path = '' as $$
declare
  v_uid      uuid := public._uid();
  v_op       public.operaciones := public._op_existente(v_uid, p_op_id);
  v_s        public.focus_sesiones;
  v_efectivo integer;
begin
  if v_op.op_id is not null then
    select * into v_s from public.focus_sesiones where id = v_op.objetivo_id and user_id = v_uid;
    return v_s;
  end if;
  select * into v_s from public.focus_sesiones where id = p_sesion_id and user_id = v_uid for update;
  if not found then raise exception 'sesion_no_encontrada'; end if;
  if v_s.estado = 'cancelada' then
    perform public._journal(v_uid, p_op_id, p_dispositivo_id, p_seq, 'focus_cancelar', 'focus', v_s.id,
      '{}'::jsonb, 'duplicada', 'ya_cancelada');
    return v_s;
  elsif v_s.estado in ('completada', 'parcial') then
    perform public._journal(v_uid, p_op_id, p_dispositivo_id, p_seq, 'focus_cancelar', 'focus', v_s.id,
      '{}'::jsonb, 'conflicto', 'ya_finalizada');
    return v_s;
  end if;
  v_efectivo := v_s.acumulado_s + case when v_s.estado = 'en_curso'
    then greatest(0, round(extract(epoch from (now() - v_s.tramo_inicio)))::integer) else 0 end;
  update public.focus_sesiones
     set estado = 'cancelada', puntos = 0, tiempo_efectivo_s = v_efectivo,
         finalizado_en = now(), tramo_inicio = null, version = version + 1
   where id = v_s.id
  returning * into v_s;
  delete from public.temporizador_activo where user_id = v_uid and tipo = 'focus' and ref_id = v_s.id;
  perform public._journal(v_uid, p_op_id, p_dispositivo_id, p_seq, 'focus_cancelar', 'focus', v_s.id,
    '{}'::jsonb, 'aplicada', null);
  return v_s;
end;
$$;

-- ---------- Descansos ----------
create or replace function public.descanso_iniciar(
  p_op_id uuid, p_dispositivo_id uuid, p_seq bigint, p_tipo text, p_sesion_origen_id uuid default null)
returns public.descansos
language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := public._uid();
  v_op   public.operaciones := public._op_existente(v_uid, p_op_id);
  v_pref public.preferencias_usuario;
  v_d    public.descansos;
  v_id   uuid := gen_random_uuid();
  v_det  text;
begin
  if v_op.op_id is not null then
    select * into v_d from public.descansos where id = v_op.objetivo_id and user_id = v_uid;
    return v_d;
  end if;
  if p_tipo not in ('corto', 'largo') then raise exception 'parametro_invalido'; end if;
  if p_sesion_origen_id is not null
     and not exists (select 1 from public.focus_sesiones where id = p_sesion_origen_id and user_id = v_uid) then
    raise exception 'sesion_no_encontrada';
  end if;
  v_pref := public._prefs(v_uid);
  begin
    insert into public.temporizador_activo (user_id, tipo, ref_id, estado)
    values (v_uid, 'descanso', v_id, 'corriendo');
  exception when unique_violation then
    select tipo || ':' || ref_id::text || ':' || estado into v_det
      from public.temporizador_activo where user_id = v_uid;
    raise exception 'temporizador_ocupado' using detail = v_det;
  end;
  insert into public.descansos
    (id, user_id, tipo, estado, sesion_origen_id, duracion_objetivo_s, iniciado_en, tramo_inicio)
  values
    (v_id, v_uid, p_tipo, 'en_curso', p_sesion_origen_id,
     case when p_tipo = 'corto' then v_pref.descanso_corto_min else v_pref.descanso_largo_min end * 60,
     now(), now())
  returning * into v_d;
  perform public._journal(v_uid, p_op_id, p_dispositivo_id, p_seq, 'descanso_iniciar', 'descanso', v_id,
    jsonb_build_object('tipo', p_tipo), 'aplicada', null);
  return v_d;
end;
$$;

create or replace function public.descanso_pausar(
  p_op_id uuid, p_dispositivo_id uuid, p_seq bigint, p_descanso_id uuid)
returns public.descansos
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public._uid();
  v_op  public.operaciones := public._op_existente(v_uid, p_op_id);
  v_d   public.descansos;
begin
  if v_op.op_id is not null then
    select * into v_d from public.descansos where id = v_op.objetivo_id and user_id = v_uid;
    return v_d;
  end if;
  select * into v_d from public.descansos where id = p_descanso_id and user_id = v_uid for update;
  if not found then raise exception 'descanso_no_encontrado'; end if;
  if v_d.estado = 'pausado' then
    perform public._journal(v_uid, p_op_id, p_dispositivo_id, p_seq, 'descanso_pausar', 'descanso', v_d.id,
      '{}'::jsonb, 'fusionada', 'ya_estaba_pausado');
    return v_d;
  end if;
  if v_d.estado <> 'en_curso' then raise exception 'transicion_invalida' using detail = v_d.estado; end if;
  update public.descansos
     set estado = 'pausado',
         acumulado_s = acumulado_s + greatest(0, floor(extract(epoch from (now() - tramo_inicio)))::integer),
         tramo_inicio = null, version = version + 1
   where id = v_d.id
  returning * into v_d;
  update public.temporizador_activo
     set estado = 'pausado', version = version + 1, actualizado_en = now()
   where user_id = v_uid and tipo = 'descanso' and ref_id = v_d.id;
  perform public._journal(v_uid, p_op_id, p_dispositivo_id, p_seq, 'descanso_pausar', 'descanso', v_d.id,
    '{}'::jsonb, 'aplicada', null);
  return v_d;
end;
$$;

create or replace function public.descanso_reanudar(
  p_op_id uuid, p_dispositivo_id uuid, p_seq bigint, p_descanso_id uuid)
returns public.descansos
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public._uid();
  v_op  public.operaciones := public._op_existente(v_uid, p_op_id);
  v_d   public.descansos;
begin
  if v_op.op_id is not null then
    select * into v_d from public.descansos where id = v_op.objetivo_id and user_id = v_uid;
    return v_d;
  end if;
  select * into v_d from public.descansos where id = p_descanso_id and user_id = v_uid for update;
  if not found then raise exception 'descanso_no_encontrado'; end if;
  if v_d.estado = 'en_curso' then
    perform public._journal(v_uid, p_op_id, p_dispositivo_id, p_seq, 'descanso_reanudar', 'descanso', v_d.id,
      '{}'::jsonb, 'fusionada', 'ya_estaba_en_curso');
    return v_d;
  end if;
  if v_d.estado <> 'pausado' then raise exception 'transicion_invalida' using detail = v_d.estado; end if;
  update public.descansos
     set estado = 'en_curso', tramo_inicio = now(), version = version + 1
   where id = v_d.id
  returning * into v_d;
  update public.temporizador_activo
     set estado = 'corriendo', version = version + 1, actualizado_en = now()
   where user_id = v_uid and tipo = 'descanso' and ref_id = v_d.id;
  perform public._journal(v_uid, p_op_id, p_dispositivo_id, p_seq, 'descanso_reanudar', 'descanso', v_d.id,
    '{}'::jsonb, 'aplicada', null);
  return v_d;
end;
$$;

create or replace function public.descanso_completar(
  p_op_id uuid, p_dispositivo_id uuid, p_seq bigint, p_descanso_id uuid)
returns public.descansos
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public._uid();
  v_op  public.operaciones := public._op_existente(v_uid, p_op_id);
  v_d   public.descansos;
begin
  if v_op.op_id is not null then
    select * into v_d from public.descansos where id = v_op.objetivo_id and user_id = v_uid;
    return v_d;
  end if;
  select * into v_d from public.descansos where id = p_descanso_id and user_id = v_uid for update;
  if not found then raise exception 'descanso_no_encontrado'; end if;
  if v_d.estado in ('completado', 'omitido') then
    perform public._journal(v_uid, p_op_id, p_dispositivo_id, p_seq, 'descanso_completar', 'descanso', v_d.id,
      '{}'::jsonb, case when v_d.estado = 'completado' then 'duplicada' else 'conflicto' end, 'ya_finalizado');
    return v_d;
  end if;
  update public.descansos
     set estado = 'completado',
         acumulado_s = acumulado_s + case when estado = 'en_curso'
           then greatest(0, floor(extract(epoch from (now() - tramo_inicio)))::integer) else 0 end,
         tramo_inicio = null, finalizado_en = now(), version = version + 1
   where id = v_d.id
  returning * into v_d;
  delete from public.temporizador_activo where user_id = v_uid and tipo = 'descanso' and ref_id = v_d.id;
  perform public._journal(v_uid, p_op_id, p_dispositivo_id, p_seq, 'descanso_completar', 'descanso', v_d.id,
    '{}'::jsonb, 'aplicada', null);
  return v_d;
end;
$$;

create or replace function public.descanso_omitir(
  p_op_id uuid, p_dispositivo_id uuid, p_seq bigint, p_tipo text, p_sesion_origen_id uuid default null)
returns public.descansos
language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := public._uid();
  v_op   public.operaciones := public._op_existente(v_uid, p_op_id);
  v_pref public.preferencias_usuario;
  v_d    public.descansos;
begin
  if v_op.op_id is not null then
    select * into v_d from public.descansos where id = v_op.objetivo_id and user_id = v_uid;
    return v_d;
  end if;
  if p_tipo not in ('corto', 'largo') then raise exception 'parametro_invalido'; end if;
  if p_sesion_origen_id is not null
     and not exists (select 1 from public.focus_sesiones where id = p_sesion_origen_id and user_id = v_uid) then
    raise exception 'sesion_no_encontrada';
  end if;
  v_pref := public._prefs(v_uid);
  insert into public.descansos
    (user_id, tipo, estado, motivo_omision, sesion_origen_id, duracion_objetivo_s, finalizado_en)
  values
    (v_uid, p_tipo, 'omitido', 'usuario', p_sesion_origen_id,
     case when p_tipo = 'corto' then v_pref.descanso_corto_min else v_pref.descanso_largo_min end * 60, now())
  returning * into v_d;
  perform public._journal(v_uid, p_op_id, p_dispositivo_id, p_seq, 'descanso_omitir', 'descanso', v_d.id,
    jsonb_build_object('tipo', p_tipo), 'aplicada', null);
  return v_d;
end;
$$;

create or replace function public.descanso_cancelar(
  p_op_id uuid, p_dispositivo_id uuid, p_seq bigint, p_descanso_id uuid)
returns public.descansos
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public._uid();
  v_op  public.operaciones := public._op_existente(v_uid, p_op_id);
  v_d   public.descansos;
begin
  if v_op.op_id is not null then
    select * into v_d from public.descansos where id = v_op.objetivo_id and user_id = v_uid;
    return v_d;
  end if;
  select * into v_d from public.descansos where id = p_descanso_id and user_id = v_uid for update;
  if not found then raise exception 'descanso_no_encontrado'; end if;
  if v_d.estado in ('completado', 'omitido') then
    perform public._journal(v_uid, p_op_id, p_dispositivo_id, p_seq, 'descanso_cancelar', 'descanso', v_d.id,
      '{}'::jsonb, 'duplicada', 'ya_finalizado');
    return v_d;
  end if;
  update public.descansos
     set estado = 'omitido', motivo_omision = 'cancelado', tramo_inicio = null,
         finalizado_en = now(), version = version + 1
   where id = v_d.id
  returning * into v_d;
  delete from public.temporizador_activo where user_id = v_uid and tipo = 'descanso' and ref_id = v_d.id;
  perform public._journal(v_uid, p_op_id, p_dispositivo_id, p_seq, 'descanso_cancelar', 'descanso', v_d.id,
    '{}'::jsonb, 'aplicada', null);
  return v_d;
end;
$$;

-- ---------- Permisos de ejecución ----------
revoke execute on function public._uid()                                   from public, anon, authenticated;
revoke execute on function public._prefs(uuid)                             from public, anon, authenticated;
revoke execute on function public._op_existente(uuid, uuid)                from public, anon, authenticated;
revoke execute on function public._ciclos_desde_ultimo_largo(uuid)         from public, anon, authenticated;
revoke execute on function public._journal(uuid, uuid, uuid, bigint, text, text, uuid, jsonb, text, text)
  from public, anon, authenticated;

revoke execute on function public.focus_iniciar(uuid, uuid, bigint, text, text, text, text, uuid) from public, anon;
revoke execute on function public.focus_pausar(uuid, uuid, bigint, uuid)       from public, anon;
revoke execute on function public.focus_reanudar(uuid, uuid, bigint, uuid)     from public, anon;
revoke execute on function public.focus_completar(uuid, uuid, bigint, uuid)    from public, anon;
revoke execute on function public.focus_cancelar(uuid, uuid, bigint, uuid)     from public, anon;
revoke execute on function public.descanso_iniciar(uuid, uuid, bigint, text, uuid) from public, anon;
revoke execute on function public.descanso_pausar(uuid, uuid, bigint, uuid)    from public, anon;
revoke execute on function public.descanso_reanudar(uuid, uuid, bigint, uuid)  from public, anon;
revoke execute on function public.descanso_completar(uuid, uuid, bigint, uuid) from public, anon;
revoke execute on function public.descanso_omitir(uuid, uuid, bigint, text, uuid) from public, anon;
revoke execute on function public.descanso_cancelar(uuid, uuid, bigint, uuid)  from public, anon;

grant execute on function public.focus_iniciar(uuid, uuid, bigint, text, text, text, text, uuid) to authenticated;
grant execute on function public.focus_pausar(uuid, uuid, bigint, uuid)       to authenticated;
grant execute on function public.focus_reanudar(uuid, uuid, bigint, uuid)     to authenticated;
grant execute on function public.focus_completar(uuid, uuid, bigint, uuid)    to authenticated;
grant execute on function public.focus_cancelar(uuid, uuid, bigint, uuid)     to authenticated;
grant execute on function public.descanso_iniciar(uuid, uuid, bigint, text, uuid) to authenticated;
grant execute on function public.descanso_pausar(uuid, uuid, bigint, uuid)    to authenticated;
grant execute on function public.descanso_reanudar(uuid, uuid, bigint, uuid)  to authenticated;
grant execute on function public.descanso_completar(uuid, uuid, bigint, uuid) to authenticated;
grant execute on function public.descanso_omitir(uuid, uuid, bigint, text, uuid) to authenticated;
grant execute on function public.descanso_cancelar(uuid, uuid, bigint, uuid)  to authenticated;

commit;
