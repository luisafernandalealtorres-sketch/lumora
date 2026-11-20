-- ============================================================================
-- GOOGLE v2 · aplicar (funciones de apoyo de la sincronización)
-- APLICADA en Supabase el 2026-11-20, con autorización expresa (google-v1 ya aplicada). Verificada: 5 funciones solo para service_role,
-- 1 secreto sync_agenda_secret en el Vault, 36 tablas y 36 políticas sin cambios, 4 eventos y 4 fuentes intactos.
-- Esta migración NO contiene correos, ids de calendario ni secretos: el secreto compartido se GENERA aquí, dentro de la base,
-- y nadie lo ve ni lo copia (lo lee pg_cron desde el Vault y lo valida la función de sincronización contra la base).
-- Todas las funciones son solo para service_role (las llaman las Edge Functions); el navegador no puede ejecutar ninguna.
-- ============================================================================
begin;

-- 1) Secreto compartido entre pg_cron y la función sincronizar-agenda.
select vault.create_secret(
  replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  'sync_agenda_secret',
  'Secreto con el que pg_cron llama a la función sincronizar-agenda'
);

create or replace function public.google_validar_sync(p_valor text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(length(p_valor), 0) >= 32
     and exists (select 1 from vault.decrypted_secrets where name = 'sync_agenda_secret' and decrypted_secret = p_valor)
$$;
revoke execute on function public.google_validar_sync(text) from public, anon, authenticated;
grant execute on function public.google_validar_sync(text) to service_role;

-- 2) Reemplazar, de forma atómica, los eventos de un calendario entre dos fechas (los eventos borrados en Google desaparecen).
--    También borra los eventos sincronizados de días anteriores y marca la hora de sincronización.
create or replace function public.agenda_reemplazar(p_user_id uuid, p_calendario_id text, p_desde date, p_hasta date, p_filas jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if p_filas is null or jsonb_typeof(p_filas) <> 'array' then
    raise exception 'filas_invalidas';
  end if;
  delete from public.agenda_hoy
   where user_id = p_user_id and calendario_id = p_calendario_id and fecha between p_desde and p_hasta and origen_id is not null;
  insert into public.agenda_hoy (user_id, fecha, inicio, fin, titulo, detalle, calendario_id, frente_id, origen_id, sincronizado_en)
  select p_user_id, (f ->> 'fecha')::date, (f ->> 'inicio')::timestamptz, nullif(f ->> 'fin', '')::timestamptz,
         coalesce(nullif(btrim(f ->> 'titulo'), ''), '(sin título)'), nullif(f ->> 'detalle', ''), p_calendario_id,
         nullif(f ->> 'frente_id', ''), f ->> 'origen_id', coalesce((f ->> 'sincronizado_en')::timestamptz, now())
    from jsonb_array_elements(p_filas) as f
   where nullif(f ->> 'origen_id', '') is not null
  on conflict (user_id, calendario_id, origen_id, fecha) where origen_id is not null do nothing;
  get diagnostics n = row_count;
  delete from public.agenda_hoy where user_id = p_user_id and fecha < p_desde and origen_id is not null;
  update public.calendarios_fuente set ultima_sincronizacion = now(), ultimo_error = null
   where user_id = p_user_id and calendario_id = p_calendario_id;
  return n;
end;
$$;
revoke execute on function public.agenda_reemplazar(uuid, text, date, date, jsonb) from public, anon, authenticated;
grant execute on function public.agenda_reemplazar(uuid, text, date, date, jsonb) to service_role;

-- 3) Anotar un error de sincronización en un calendario o en una cuenta (sin tocar sus eventos).
create or replace function public.agenda_error_fuente(p_user_id uuid, p_calendario_id text, p_error text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.calendarios_fuente set ultimo_error = left(coalesce(p_error, 'error'), 300)
   where user_id = p_user_id and calendario_id = p_calendario_id
$$;
revoke execute on function public.agenda_error_fuente(uuid, text, text) from public, anon, authenticated;
grant execute on function public.agenda_error_fuente(uuid, text, text) to service_role;

create or replace function public.google_marcar_cuenta(p_cuenta_id uuid, p_estado text, p_error text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.google_cuentas set estado = p_estado, ultimo_error = left(coalesce(p_error, ''), 300)
   where id = p_cuenta_id
$$;
revoke execute on function public.google_marcar_cuenta(uuid, text, text) from public, anon, authenticated;
grant execute on function public.google_marcar_cuenta(uuid, text, text) to service_role;

-- 4) Al conectar una cuenta, enlazar los calendarios de esa cuenta (por el correo guardado en calendarios_fuente.cuenta)
--    y activar los que estaban pendientes. Devuelve cuántos calendarios enlazó.
create or replace function public.google_vincular_calendarios(p_user_id uuid, p_cuenta_id uuid, p_email text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  update public.calendarios_fuente
     set cuenta_id = p_cuenta_id,
         estado = case when estado = 'pendiente' then 'activa' else estado end
   where user_id = p_user_id and lower(btrim(cuenta)) = lower(btrim(p_email));
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.google_vincular_calendarios(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.google_vincular_calendarios(uuid, uuid, text) to service_role;

commit;
