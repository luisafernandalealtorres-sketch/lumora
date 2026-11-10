-- Réplica ESTRUCTURAL (sin datos reales) del esquema heredado observado en la auditoría. Variante PostgreSQL 17 (entorno real de la etapa 0).
-- Se ejecuta como postgres en la base `fixture`, DESPUÉS de 01a_auth_extensiones_real.sql. El esquema public conserva su propietario por defecto (pg_database_owner).
grant usage on schema public to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role;

create table public.frentes (
  slug text primary key, nombre text not null,
  grupo text not null check (grupo in ('ticketcode', 'tanku', 'personal')),
  orden integer not null default 0);
alter table public.frentes enable row level security;
create policy "frentes visibles al usuario autenticado" on public.frentes for select to authenticated using (true);
insert into public.frentes (slug, nombre, grupo, orden) values
  ('ticketcode-eventos', 'TICKETCODE · Producción de eventos', 'ticketcode', 1),
  ('ticketcode-eve', 'TICKETCODE · EVE', 'ticketcode', 2),
  ('tanku', 'TANKU', 'tanku', 3), ('hama', 'Hama beads', 'personal', 4), ('crochet', 'Crochet', 'personal', 5),
  ('jardin', 'Jardín de mamá', 'personal', 6), ('salud-abuela', 'Salud de la abuela', 'personal', 7),
  ('hogar', 'Hogar', 'personal', 8), ('personal', 'Personal general', 'personal', 9), ('salud', 'Salud', 'personal', 10);

create table public.metas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  frente text not null references public.frentes (slug),
  titulo text not null, descripcion text,
  estado text not null default 'activa' check (estado in ('activa', 'pausada', 'lograda')),
  fecha_meta date, creado_en timestamptz not null default now());
create index metas_frente_idx on public.metas (frente);
create index metas_user_id_estado_idx on public.metas (user_id, estado);

create table public.pendientes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  frente text not null references public.frentes (slug),
  texto text not null, hecho boolean not null default false, fecha_limite date,
  creado_en timestamptz not null default now(), hecho_en timestamptz,
  meta_id uuid references public.metas (id) on delete set null);
create index pendientes_meta_id_idx on public.pendientes (meta_id);
create index pendientes_user_id_hecho_frente_idx on public.pendientes (user_id, hecho, frente);

create table public.hitos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  meta_id uuid not null references public.metas (id) on delete cascade,
  titulo text not null, hecho boolean not null default false, fecha date,
  creado_en timestamptz not null default now());
create index hitos_meta_id_idx on public.hitos (meta_id);

create table public.habitos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null, tipo text not null default 'check' check (tipo in ('check', 'cantidad')),
  unidad text, objetivo_dia numeric not null default 1 check (objetivo_dia > 0),
  veces_semana integer not null default 7 check (veces_semana between 1 and 7),
  activo boolean not null default true, creado_en timestamptz not null default now());

create table public.habito_registros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habito_id uuid not null references public.habitos (id) on delete cascade,
  fecha date not null, valor numeric not null default 1,
  unique (habito_id, fecha));

do $$
declare t text;
begin
  foreach t in array array['metas', 'pendientes', 'hitos', 'habitos', 'habito_registros'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format($p$create policy "propios" on public.%I for all to authenticated
      using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)$p$, t);
  end loop;
end $$;
