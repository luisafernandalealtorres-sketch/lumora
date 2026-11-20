-- ============================================================================
-- AGENDA v1 · aplicar
-- Fuentes de calendario de Home: de qué calendario viene cada evento y a qué frente pertenece.
-- APLICADA en Supabase el 2026-11-19, con autorización expresa. Verificada: 33 tablas (+1), 35 políticas (+1), 4 columnas nuevas en agenda_hoy,
-- índice único creado, políticas de agenda_hoy sin cambios y calendarios_fuente accesible solo con SELECT para authenticated.
-- Esta migración NO contiene ningún identificador de calendario ni correo (el repositorio es público):
-- las filas de `calendarios_fuente` se siembran aparte, con un INSERT que no se guarda en el repositorio.
-- Es aditiva: no borra ni cambia columnas existentes y no toca las políticas de `agenda_hoy`.
-- ============================================================================
begin;

-- 1) Qué calendarios alimentan la agenda, y a qué frente pertenece cada uno.
create table public.calendarios_fuente (
  user_id               uuid not null default auth.uid() references auth.users (id) on delete cascade,
  calendario_id         text not null check (length(btrim(calendario_id)) > 0),
  nombre                text not null check (length(btrim(nombre)) > 0),
  cuenta                text,
  frente_id             text check (frente_id in ('tanku', 'ticketcode', 'personal', 'salud', 'familia', 'otros')),
  estado                text not null default 'activa' check (estado in ('activa', 'pendiente', 'pausada')),
  ultima_sincronizacion timestamptz,
  ultimo_error          text,
  creado_en             timestamptz not null default now(),
  primary key (user_id, calendario_id)
);
alter table public.calendarios_fuente enable row level security;
-- La aplicación solo LEE esta tabla. Quien la mantiene es la tarea de sincronización (rol de servicio / administración).
create policy "propios_lectura" on public.calendarios_fuente
  for select to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.calendarios_fuente from anon, authenticated;
grant select on public.calendarios_fuente to authenticated;

-- 2) Cada evento de la agenda recuerda su origen. Todo es opcional: las filas existentes (hoy ninguna) siguen siendo válidas.
alter table public.agenda_hoy
  add column calendario_id   text,
  add column frente_id       text check (frente_id in ('tanku', 'ticketcode', 'personal', 'salud', 'familia', 'otros')),
  add column origen_id       text,
  add column sincronizado_en timestamptz;

-- Un evento de un calendario aparece una sola vez por día: la sincronización repetida actualiza, no duplica.
create unique index agenda_hoy_origen_uidx
  on public.agenda_hoy (user_id, calendario_id, origen_id, fecha)
  where origen_id is not null;

commit;
