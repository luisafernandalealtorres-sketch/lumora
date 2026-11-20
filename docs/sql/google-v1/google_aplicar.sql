-- ============================================================================
-- GOOGLE v1 · aplicar
-- Cuentas de Google conectadas (Calendar, solo lectura), con el token guardado en el Vault de Supabase.
-- APLICADA en Supabase el 2026-11-20, con autorización expresa. Verificada: 36 tablas (+3), 36 políticas (+1), 5 funciones, columna cuenta_id,
-- permisos correctos (solo authenticated/SELECT en google_cuentas; tokens solo para service_role) y 0 secretos en el Vault.
-- Validada el 2026-11-20 en una transacción que terminó en ROLLBACK sobre el proyecto real (ver pruebas en este archivo's historial):
-- permisos de tablas y funciones, código de un solo uso, vencimiento, guardar y actualizar el token en el Vault, desconexión
-- y aislamiento entre usuarios. Tras la prueba se comprobó que no quedó nada (33 tablas, 35 políticas, 0 secretos en el Vault).
-- Esta migración NO contiene correos, identificadores de calendario ni secretos (el repositorio es público).
-- Es aditiva: no cambia columnas ni políticas existentes (solo agrega una columna opcional a calendarios_fuente).
-- Los tokens de Google nunca viven en una tabla: se guardan cifrados en el Vault, y solo las funciones de abajo (service_role) los leen.
-- ============================================================================
begin;

-- 1) Cuentas conectadas. La aplicación puede LEER esta tabla (correo y estado); nunca contiene tokens.
create table public.google_cuentas (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  email        text not null check (length(btrim(email)) > 0),
  scopes       text[] not null default '{}',
  estado       text not null default 'activa' check (estado in ('activa', 'revocada', 'error')),
  ultimo_error text,
  conectada_en timestamptz not null default now(),
  unique (user_id, email)
);
alter table public.google_cuentas enable row level security;
create policy "propios_lectura" on public.google_cuentas
  for select to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.google_cuentas from anon, authenticated;
grant select on public.google_cuentas to authenticated;

-- 2) A qué secreto del Vault corresponde cada cuenta. Ningún acceso para el cliente.
create table public.google_secretos (
  cuenta_id  uuid primary key references public.google_cuentas (id) on delete cascade,
  secreto_id uuid not null
);
alter table public.google_secretos enable row level security;
revoke all on public.google_secretos from anon, authenticated;

-- 3) Códigos de un solo uso (state) para el retorno de Google. Ningún acceso para el cliente: se crean con google_iniciar_conexion().
create table public.google_oauth_estados (
  nonce     text primary key,
  user_id   uuid not null references auth.users (id) on delete cascade,
  creado_en timestamptz not null default now(),
  expira_en timestamptz not null default now() + interval '10 minutes',
  usado     boolean not null default false
);
alter table public.google_oauth_estados enable row level security;
revoke all on public.google_oauth_estados from anon, authenticated;

-- 4) Cada calendario sabe de qué cuenta es. Opcional: las filas existentes siguen siendo válidas.
alter table public.calendarios_fuente
  add column cuenta_id uuid references public.google_cuentas (id) on delete set null;

-- 5) Inicio de la conexión (lo llama la aplicación con la sesión del usuario): crea el código de un solo uso.
create or replace function public.google_iniciar_conexion()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_nonce text;
begin
  if v_uid is null then
    raise exception 'sin_sesion';
  end if;
  delete from public.google_oauth_estados where user_id = v_uid and (usado or expira_en < now());
  v_nonce := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.google_oauth_estados (nonce, user_id) values (v_nonce, v_uid);
  return v_nonce;
end;
$$;
revoke execute on function public.google_iniciar_conexion() from public, anon;
grant execute on function public.google_iniciar_conexion() to authenticated;

-- 6) Solo service_role (la función de retorno de Google): consumir el código, guardar y leer el token.
create or replace function public.google_consumir_nonce(p_nonce text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
begin
  update public.google_oauth_estados
     set usado = true
   where nonce = p_nonce and not usado and expira_en > now()
  returning user_id into v_uid;
  return v_uid;   -- null si el código no existe, ya se usó o venció
end;
$$;
revoke execute on function public.google_consumir_nonce(text) from public, anon, authenticated;
grant execute on function public.google_consumir_nonce(text) to service_role;

create or replace function public.google_guardar_cuenta(p_user_id uuid, p_email text, p_refresh_token text, p_scopes text[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cuenta  uuid;
  v_secreto uuid;
begin
  if coalesce(btrim(p_refresh_token), '') = '' then
    raise exception 'token_vacio';
  end if;
  insert into public.google_cuentas (user_id, email, scopes, estado, ultimo_error, conectada_en)
  values (p_user_id, lower(btrim(p_email)), coalesce(p_scopes, '{}'), 'activa', null, now())
  on conflict (user_id, email) do update
    set scopes = excluded.scopes, estado = 'activa', ultimo_error = null, conectada_en = now()
  returning id into v_cuenta;

  select secreto_id into v_secreto from public.google_secretos where cuenta_id = v_cuenta;
  if v_secreto is null then
    v_secreto := vault.create_secret(p_refresh_token, 'google_refresh_' || v_cuenta::text, 'Token de actualización de Google (Calendar, solo lectura)');
    insert into public.google_secretos (cuenta_id, secreto_id) values (v_cuenta, v_secreto);
  else
    perform vault.update_secret(v_secreto, p_refresh_token);
  end if;
  return v_cuenta;
end;
$$;
revoke execute on function public.google_guardar_cuenta(uuid, text, text, text[]) from public, anon, authenticated;
grant execute on function public.google_guardar_cuenta(uuid, text, text, text[]) to service_role;

create or replace function public.google_leer_token(p_cuenta_id uuid)
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select s.decrypted_secret
    from public.google_secretos g
    join vault.decrypted_secrets s on s.id = g.secreto_id
   where g.cuenta_id = p_cuenta_id
$$;
revoke execute on function public.google_leer_token(uuid) from public, anon, authenticated;
grant execute on function public.google_leer_token(uuid) to service_role;

-- 7) Desconectar (lo llama la aplicación con la sesión del usuario): borra el token y los eventos de esa cuenta.
--    No revoca el permiso en Google: eso se hace en myaccount.google.com/permissions (o desde la función de retorno).
create or replace function public.google_desconectar(p_cuenta_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_secreto uuid;
begin
  if v_uid is null then
    raise exception 'sin_sesion';
  end if;
  if not exists (select 1 from public.google_cuentas where id = p_cuenta_id and user_id = v_uid) then
    raise exception 'cuenta_inexistente';
  end if;

  delete from public.agenda_hoy
   where user_id = v_uid and origen_id is not null
     and calendario_id in (select calendario_id from public.calendarios_fuente where cuenta_id = p_cuenta_id and user_id = v_uid);
  update public.calendarios_fuente
     set estado = 'pendiente', cuenta_id = null, ultima_sincronizacion = null, ultimo_error = null
   where cuenta_id = p_cuenta_id and user_id = v_uid;

  select secreto_id into v_secreto from public.google_secretos where cuenta_id = p_cuenta_id;
  delete from public.google_cuentas where id = p_cuenta_id and user_id = v_uid;   -- borra también google_secretos (cascada)
  if v_secreto is not null then
    delete from vault.secrets where id = v_secreto;
  end if;
end;
$$;
revoke execute on function public.google_desconectar(uuid) from public, anon;
grant execute on function public.google_desconectar(uuid) to authenticated;

commit;
