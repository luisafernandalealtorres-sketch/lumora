-- ============================================================================
-- ASISTENTE v1 · aplicar
-- Memoria de preferencias (solo con aprobación de Luisa) y registro del gasto en tokens, para el tope mensual.
-- APLICADA el 2026-11-20 (autorizada por Luisa). Verificado: 38 tablas, 39 políticas, RLS en ambas, anon sin acceso.
-- Es aditiva: no toca tablas ni políticas existentes. No contiene correos ni secretos (el repositorio es público).
-- ============================================================================
begin;

-- 1) Memoria: hechos cortos y duraderos que Luisa aprobó guardar. Máximo 50, de 5 a 300 caracteres.
create table public.asistente_memoria (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  texto     text not null check (length(btrim(texto)) between 5 and 300),
  creado_en timestamptz not null default now()
);
create index asistente_memoria_usuario_idx on public.asistente_memoria (user_id, creado_en);
alter table public.asistente_memoria enable row level security;
create policy "propios" on public.asistente_memoria
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.asistente_memoria from anon, authenticated;
grant select, insert, delete on public.asistente_memoria to authenticated;
grant update (texto) on public.asistente_memoria to authenticated;

create or replace function public.asistente_memoria_limite()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select count(*) from public.asistente_memoria where user_id = new.user_id) >= 50 then
    raise exception 'memoria_llena' using detail = 'La memoria del asistente admite hasta 50 recuerdos.';
  end if;
  return new;
end;
$$;
revoke execute on function public.asistente_memoria_limite() from public, anon, authenticated;
create trigger asistente_memoria_limite before insert on public.asistente_memoria
  for each row execute function public.asistente_memoria_limite();

-- 2) Uso: tokens y costo estimado de cada respuesta. El cliente puede registrar y leer lo suyo; nunca cambiar ni borrar.
create table public.asistente_uso (
  id            bigint generated always as identity primary key,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  creado_en     timestamptz not null default now(),
  modelo        text not null check (length(btrim(modelo)) > 0),
  entrada       integer not null default 0 check (entrada >= 0),
  salida        integer not null default 0 check (salida >= 0),
  cache_lectura integer not null default 0 check (cache_lectura >= 0),
  cache_escritura integer not null default 0 check (cache_escritura >= 0),
  costo_usd     numeric(10, 6) not null check (costo_usd >= 0)
);
create index asistente_uso_usuario_idx on public.asistente_uso (user_id, creado_en);
alter table public.asistente_uso enable row level security;
create policy "propios_lectura" on public.asistente_uso for select to authenticated using ((select auth.uid()) = user_id);
create policy "propios_registro" on public.asistente_uso for insert to authenticated with check ((select auth.uid()) = user_id);
revoke all on public.asistente_uso from anon, authenticated;
grant select, insert on public.asistente_uso to authenticated;

-- 3) Gasto del mes (hora de Bogotá), solo el del usuario con sesión (la seguridad por filas aplica).
create or replace function public.asistente_gasto_mes()
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(costo_usd), 0)
    from public.asistente_uso
   where creado_en >= (date_trunc('month', now() at time zone 'America/Bogota') at time zone 'America/Bogota')
$$;
revoke execute on function public.asistente_gasto_mes() from public, anon;
grant execute on function public.asistente_gasto_mes() to authenticated;

commit;
