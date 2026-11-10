# Fase 3: SQL propuesto por etapas, con reversión (v1.9)

Fecha: 9 nov 2026. Base: `docs/DISENO-TECNICO-FASE-3-v1.9.md`, las aprobaciones P1 a P15 y las decisiones T-1 a T-13 aprobadas el 9 nov (T-9 queda pendiente).

**Cambios de la v1.9 respecto de la v1.8 (la v1.8 se conserva intacta):**
- **T-8 y T-8b:** el historial pasa a ser de solo lectura para el cliente: `registrar_cambios` es `SECURITY DEFINER`, se elimina la política de `INSERT` del cliente y se revoca el permiso `INSERT`.
- **T-7:** disparador `objetivos_semana_cerrada` en la etapa 3 (objetivos de semanas anteriores inmutables).
- **T-1:** nueva **etapa 0** de verificaciones previas de solo lectura; la ejecución en Supabase queda condicionada a ellas.
- **Nota corregida:** dos solicitudes simultáneas con el mismo `p_op_id` ya **no** devuelven `temporizador_ocupado`; la segunda espera y recibe el resultado almacenado (bloqueo consultivo, validación local CT-04 y CT-09).
- **Excepciones de RPC:** hacen rollback y no dejan fila en `operaciones`; la etapa 4 deberá registrar también las operaciones rechazadas (ver «Etapa 4»).
- **T-2, T-3, T-10, T-13 y `habito_crear` idempotente** ya estaban en el SQL de la v1.8 y quedan aprobados.
- **T-9 pendiente:** no se implementan umbrales de desviación del reloj.

> **ESTE SQL NO SE HA EJECUTADO EN SUPABASE.** La v1.8 del SQL se validó en un PostgreSQL 16 local y desechable (`docs/VALIDACION-LOCAL-FASE-3-v1.9.md`), que encontró y corrigió defectos. La v1.9 añade dos cambios (T-7 y T-8b) que **no se han vuelto a validar**.
> - P1 aprueba el diseño y la preparación del SQL, **no su ejecución**.
> - Evidencia de la v1.8, **local y no de Supabase**: 122 comprobaciones SQL, 9 escenarios con dos conexiones y las reversiones. T-8b se validó como variante local (16 pruebas de la etapa 1 y 3 comprobaciones propias) antes de incorporarse; el disparador de T-7 no tiene validación. **Nada se ha probado contra Supabase** (diferencias posibles de roles, PostgREST y asesores).
> - Cada etapa requiere autorización expresa del usuario antes de ejecutarse. T-1, T-2, T-3, T-7, T-8, T-8b, T-10 y T-13 están aprobadas. **T-1 condiciona la ejecución en Supabase a superar antes la etapa 0 (verificación de roles y permisos).**
> - No contiene `DROP`, `DELETE` ni `ALTER ... DROP` sobre objetos existentes: todo es aditivo. Los `DROP` aparecen **solo** en las reversiones duras, sobre objetos creados por estas migraciones.

## Cómo leer este documento

| Etapa | Contenido | Toca tablas heredadas | Nombre sugerido de migración |
|---|---|---|---|
| 0 | Verificaciones previas de solo lectura (T-1) | No | (no es una migración) |
| 1 | Columnas aditivas, historial y disparadores | **Sí, solo con columnas y disparadores** | `fase3_e1_columnas_historial` |
| 2 | Preferencias, bloqueo, Focus, descansos, operaciones y RPC en línea | No | `fase3_e2_focus_exclusividad` |
| 3 | Objetivos semanales, hábitos nuevos y RPC | No | `fase3_e3_habitos_objetivos` |
| 4 | `operaciones_aplicar` (reconciliación sin conexión) | No | **No redactada**: espera el algoritmo aprobado (P7) |

Cada etapa trae: SQL de aplicación, **reversión suave** (desactiva sin perder datos), **reversión dura** (borra lo creado; solo tras exportar) y **comprobaciones de solo lectura**.

Orden: 0 → 1 → 2 → 3. La etapa 2 depende de `pendientes` (clave foránea opcional de `focus_sesiones`). La etapa 3 depende de las funciones auxiliares de la etapa 2.

---

## Etapa 0: verificaciones previas de solo lectura (condición de T-1)

**T-1 condiciona la ejecución en Supabase a verificar antes los roles y permisos.** Estas consultas solo leen el catálogo; **no se han ejecutado**. Si algún criterio no se cumple, **no se ejecuta ninguna etapa** y se vuelve a revisar el diseño.

### 0.V Consultas

```sql
-- 0.1 Atributos de los roles. Las funciones SECURITY DEFINER dependen de que su propietario omita RLS.
select rolname, rolsuper, rolbypassrls, rolcreaterole, rolcanlogin
from pg_roles
where rolname in ('postgres', 'authenticator', 'authenticated', 'anon', 'service_role', 'supabase_admin')
order by rolname;

-- 0.2 Propietario del esquema public y de las tablas heredadas (será el propietario de las funciones nuevas).
select nspname, pg_get_userbyid(nspowner) as propietario
from pg_namespace where nspname in ('public', 'auth');
select c.relname, pg_get_userbyid(c.relowner) as propietario
from pg_class c
where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
order by c.relname;

-- 0.3 Pertenencia entre roles (quién hereda a quién).
select r.rolname as rol, g.rolname as miembro_de
from pg_auth_members am
join pg_roles r on r.oid = am.member
join pg_roles g on g.oid = am.roleid
where r.rolname in ('postgres', 'authenticator', 'authenticated', 'anon', 'service_role')
order by 1, 2;

-- 0.4 Privilegios por defecto sobre objetos nuevos en public (definen qué recibirán anon y authenticated).
select defaclrole::regrole as rol, defaclnamespace::regnamespace as esquema, defaclobjtype as tipo, defaclacl
from pg_default_acl;

-- 0.5 Funciones y disparadores existentes en public (se espera ninguno).
select proname, prosecdef, proconfig from pg_proc where pronamespace = 'public'::regnamespace order by 1;
select tgname, tgrelid::regclass from pg_trigger where not tgisinternal;

-- 0.6 Colisión de nombres: ninguno de estos objetos debe existir todavía.
select relname from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('cambios_registro', 'preferencias_usuario', 'temporizador_activo', 'focus_sesiones', 'descansos',
                  'operaciones', 'objetivos_atencion', 'habitos_config', 'habitos_config_versiones',
                  'habito_temporizadores', 'habito_segmentos', 'habito_tiempo', 'habito_tiempo_historial');
select column_name from information_schema.columns
where table_schema = 'public' and table_name in ('pendientes', 'hitos')
  and column_name in ('prioridad', 'orden', 'fijado_dia', 'hecho_en') and not (table_name = 'pendientes' and column_name = 'hecho_en');

-- 0.7 Versión del motor, zona horaria y definición real de auth.uid().
select version();
select count(*) as zona_bogota from pg_timezone_names where name = 'America/Bogota';
select pg_get_functiondef('auth.uid()'::regprocedure);

-- 0.8 Estado de las tablas heredadas que se alteran (esperado: sin filas o con las conocidas).
select (select count(*) from public.pendientes) as pendientes, (select count(*) from public.hitos) as hitos;
```

### 0.C Criterios de aceptación

| # | Criterio | Si falla |
|---|---|---|
| 1 | El rol propietario de las tablas y que ejecutará las migraciones tiene `rolbypassrls = true`. Las funciones definer dependen de ello | **No ejecutar.** Rediseñar (por ejemplo, funciones `INVOKER` con políticas) |
| 2 | `authenticated` y `anon` **no** tienen `rolbypassrls` ni `rolsuper` | No ejecutar |
| 3 | El propietario de `public` y de las tablas heredadas es el mismo rol que ejecutará las migraciones | Revisar quién será el propietario de las funciones |
| 4 | Los privilegios por defecto otorgan acceso a `anon` y `authenticated` como se espera (las revocaciones del SQL los compensan) | Ajustar las `REVOKE` |
| 5 | No existe ningún objeto con los nombres de la Fase 3 y no hay funciones ni disparadores en `public` | Investigar antes de continuar |
| 6 | `America/Bogota` existe en `pg_timezone_names` | No ejecutar las etapas 2 y 3 |
| 7 | La versión del motor es compatible (PostgreSQL 15 o superior; se validó en 16) | Repetir la validación local con esa versión |
| 8 | `auth.uid()` devuelve el `sub` del JWT (lee `request.jwt.claims`) | No ejecutar |
| 9 | El número de filas de `pendientes` e `hitos` coincide con lo conocido; si hay filas, el relleno inicial de la etapa 1 las cubre y los hitos ya hechos quedarán con `hecho_en` nulo | Decidir sobre el relleno |

Después de la etapa 0 se haría también la prueba con transacciones `ROLLBACK` (P13) **solo con tu autorización**.

---
## Etapa 1: columnas aditivas, historial y disparadores

### 1.U Aplicación

```sql
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
```

Notas:
- `ADD COLUMN ... NOT NULL DEFAULT 'media'` (valor constante) no reescribe la tabla.
- Las inserciones heredadas (`{texto, frente, meta_id}` y `{meta_id, titulo}`) siguen siendo válidas.
- Hoy ambas tablas tienen 0 filas; el relleno no inserta nada, pero queda correcto si se ejecuta más tarde.
- **T-8b:** el cliente solo puede leer su historial. La inserción la hace el disparador con permisos del propietario y únicamente con el `user_id` de la fila modificada. Un cliente que intente insertar recibe «permission denied».
- Como la función es definer, se mantiene su `search_path` vacío y su `REVOKE EXECUTE` (no es invocable como RPC).

### 1.S Reversión suave (no pierde datos)

```sql
begin;
alter table public.pendientes disable trigger pendientes_registrar_cambios;
alter table public.hitos      disable trigger hitos_registrar_cambios;
alter table public.hitos      disable trigger hitos_sellar_hecho_en;
commit;
```
Deja columnas, historial y tablas intactos. Para reactivar: `enable trigger`.

### 1.D Reversión dura (destructiva para el historial)

Precondición obligatoria: exportar el contenido de `cambios_registro` y las columnas `prioridad`, `orden`, `fijado_dia` y `hecho_en`, y obtener autorización expresa.

```sql
begin;
drop trigger if exists pendientes_registrar_cambios on public.pendientes;
drop trigger if exists hitos_registrar_cambios      on public.hitos;
drop trigger if exists hitos_sellar_hecho_en        on public.hitos;
drop function if exists public.registrar_cambios();
drop function if exists public.hitos_sellar_hecho_en();
drop table    if exists public.cambios_registro;
drop index    if exists public.pendientes_user_fecha_limite_idx;
drop index    if exists public.pendientes_user_fijado_dia_idx;
drop index    if exists public.hitos_user_fecha_idx;
alter table public.pendientes drop constraint if exists pendientes_prioridad_check;
alter table public.hitos      drop constraint if exists hitos_prioridad_check;
alter table public.pendientes drop column if exists prioridad, drop column if exists orden, drop column if exists fijado_dia;
alter table public.hitos      drop column if exists prioridad, drop column if exists hecho_en;
commit;
```

### 1.V Comprobaciones de solo lectura
```sql
select column_name, data_type, column_default, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name in ('pendientes', 'hitos')
  and column_name in ('prioridad', 'orden', 'fijado_dia', 'hecho_en');
select tgname, tgenabled from pg_trigger
where tgrelid in ('public.pendientes'::regclass, 'public.hitos'::regclass) and not tgisinternal;
select count(*) from public.cambios_registro;
```

---

## Etapa 2: preferencias, bloqueo, Focus, descansos y operaciones

### 2.U Aplicación

```sql
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

revoke insert, update, delete on public.temporizador_activo from authenticated, anon;
revoke insert, update, delete on public.focus_sesiones      from authenticated, anon;
revoke insert, update, delete on public.descansos           from authenticated, anon;
revoke insert, update, delete on public.operaciones         from authenticated, anon;
grant update (notificada) on public.operaciones to authenticated;

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
```

Notas:
- `operaciones` se escribe **solo** dentro de las funciones; el cliente únicamente puede marcar `notificada`.
- Una repetición con el mismo `p_op_id` devuelve el resultado previo sin volver a registrar ni a ejecutar efectos.
- **Corregido en la v1.8 y vigente:** si dos llamadas con el mismo `p_op_id` llegan en simultáneo, la segunda **espera** a la primera (bloqueo consultivo por `(usuario, op_id)` en `_op_existente`) y recibe **el resultado almacenado**; ya no recibe `temporizador_ocupado`. Validación local CT-04 y CT-09. Un `temporizador_ocupado` solo se produce cuando de verdad hay otro temporizador activo.
- **Excepciones de RPC:** cuando una función lanza una excepción (por ejemplo `transicion_invalida` o `temporizador_ocupado`) la transacción hace **rollback completo** y no queda fila en `operaciones`. Las operaciones rechazadas solo se registrarán cuando exista la etapa 4 (ver más abajo).
- **T-2:** la tolerancia de 2 segundos para decidir «completada» frente a «parcial» está en `focus_completar` (aprobada).
- **T-10:** `avisos` y `sonido` están activados por defecto (aprobado); la interfaz debe informar cuando el navegador no permita utilizarlos.

### 2.S Reversión suave
```sql
begin;
revoke execute on function public.focus_iniciar(uuid, uuid, bigint, text, text, text, text, uuid) from authenticated;
revoke execute on function public.focus_pausar(uuid, uuid, bigint, uuid)       from authenticated;
revoke execute on function public.focus_reanudar(uuid, uuid, bigint, uuid)     from authenticated;
revoke execute on function public.focus_completar(uuid, uuid, bigint, uuid)    from authenticated;
revoke execute on function public.focus_cancelar(uuid, uuid, bigint, uuid)     from authenticated;
revoke execute on function public.descanso_iniciar(uuid, uuid, bigint, text, uuid) from authenticated;
revoke execute on function public.descanso_pausar(uuid, uuid, bigint, uuid)    from authenticated;
revoke execute on function public.descanso_reanudar(uuid, uuid, bigint, uuid)  from authenticated;
revoke execute on function public.descanso_completar(uuid, uuid, bigint, uuid) from authenticated;
revoke execute on function public.descanso_omitir(uuid, uuid, bigint, text, uuid) from authenticated;
revoke execute on function public.descanso_cancelar(uuid, uuid, bigint, uuid)  from authenticated;
commit;
```
Deja tablas y datos; el cliente no puede iniciar ni cambiar temporizadores.

### 2.D Reversión dura (destruye sesiones, descansos y diario)
Precondición: exportar `focus_sesiones`, `descansos`, `operaciones`, `preferencias_usuario` y autorización expresa.
```sql
begin;
drop function if exists public.focus_iniciar(uuid, uuid, bigint, text, text, text, text, uuid);
drop function if exists public.focus_pausar(uuid, uuid, bigint, uuid);
drop function if exists public.focus_reanudar(uuid, uuid, bigint, uuid);
drop function if exists public.focus_completar(uuid, uuid, bigint, uuid);
drop function if exists public.focus_cancelar(uuid, uuid, bigint, uuid);
drop function if exists public.descanso_iniciar(uuid, uuid, bigint, text, uuid);
drop function if exists public.descanso_pausar(uuid, uuid, bigint, uuid);
drop function if exists public.descanso_reanudar(uuid, uuid, bigint, uuid);
drop function if exists public.descanso_completar(uuid, uuid, bigint, uuid);
drop function if exists public.descanso_omitir(uuid, uuid, bigint, text, uuid);
drop function if exists public.descanso_cancelar(uuid, uuid, bigint, uuid);
drop function if exists public._ciclos_desde_ultimo_largo(uuid);
drop function if exists public._journal(uuid, uuid, uuid, bigint, text, text, uuid, jsonb, text, text);
drop function if exists public._op_existente(uuid, uuid);
drop function if exists public._prefs(uuid);
drop function if exists public._uid();
drop table if exists public.descansos;
drop table if exists public.focus_sesiones;
drop table if exists public.operaciones;
drop table if exists public.temporizador_activo;
drop table if exists public.preferencias_usuario;
drop function if exists public._tocar_actualizado_en();
commit;
```
Si ya se aplicó la etapa 3, revertirla primero: sus funciones usan `_uid`, `_prefs`, `_journal` y `_op_existente`.

### 2.V Comprobaciones de solo lectura
```sql
select proname, prosecdef from pg_proc where pronamespace = 'public'::regnamespace order by 1;
select tablename, policyname, cmd from pg_policies where schemaname = 'public'
  and tablename in ('temporizador_activo', 'focus_sesiones', 'descansos', 'operaciones', 'preferencias_usuario');
select count(*) from public.temporizador_activo;
```

---

## Etapa 3: objetivos semanales, hábitos nuevos y funciones RPC

Precondición: etapa 2 aplicada (usa `_uid`, `_op_existente`, `_journal`, `temporizador_activo`).

### 3.U Aplicación

```sql
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

-- T-7: los objetivos de semanas anteriores a la actual son inmutables (America/Bogota).
-- No actúa sin usuario autenticado (mantenimiento y borrado del usuario por cascada).
create or replace function public.objetivos_semana_cerrada()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lunes date := (now() at time zone 'America/Bogota')::date
                  - (extract(isodow from (now() at time zone 'America/Bogota')::date)::integer - 1);
begin
  if (select auth.uid()) is null then
    return coalesce(new, old);
  end if;
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

revoke insert, update, delete on public.habitos_config           from authenticated, anon;
grant  update (nombre, modo_registro) on public.habitos_config   to authenticated;
revoke insert, update, delete on public.habitos_config_versiones from authenticated, anon;
revoke insert, update, delete on public.habito_temporizadores    from authenticated, anon;
revoke insert, update, delete on public.habito_segmentos         from authenticated, anon;
revoke insert, update, delete on public.habito_tiempo            from authenticated, anon;
revoke insert, update, delete on public.habito_tiempo_historial  from authenticated, anon;

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
```

Notas de diseño:
- Las tablas `habitos` y `habito_registros` **no se tocan**; Salud sigue funcionando idéntico.
- `habito_crear` es idempotente por `op_id`: una repetición devuelve el hábito ya creado, sin duplicar (corrección derivada de la validación local y del requisito de idempotencia).
- `_op_existente` toma un bloqueo consultivo por `(usuario, op_id)`, así que un reintento simultáneo espera y recibe el resultado almacenado. `habito_registrar_manual` y `_cerrar_tramo` toman además un bloqueo por `(hábito, fecha)` para que el historial registre el valor anterior real.
- Un segmento cuya fecha no tiene ocurrencia se conserva con `acreditado = false` y **no** se suma a `habito_tiempo` (P8).
- La programación nueva solo puede regir desde hoy en adelante: no se reescribe el historial.
- **T-7:** `objetivos_semana_cerrada` rechaza (`semana_cerrada`) insertar, modificar o borrar objetivos cuya `semana_inicio` sea anterior al lunes de la semana actual. Se permite editar la semana en curso y las futuras. No actúa sin usuario autenticado, de modo que el borrado de un usuario por cascada no falla. **Disparador nuevo, sin validación local todavía.**
- **T-3:** cancelar un temporizador de hábito descarta solo el tramo en curso; los segmentos ya cerrados o pausados quedan acreditados (aprobado).
- **T-13:** `habito_timer_iniciar` exige `modo_registro = 'temporizador'`; el registro manual siempre está disponible y `habito_registrar_manual` lo rechaza con `sin_ocurrencia` cuando no hay ocurrencia programada para esa fecha (aprobado).

### 3.S Reversión suave
```sql
begin;
revoke execute on function public.habito_crear(uuid, uuid, bigint, text, text, text, smallint[], integer, date) from authenticated;
revoke execute on function public.habito_programar(uuid, text, smallint[], integer, date)   from authenticated;
revoke execute on function public.habito_archivar(uuid, date)                               from authenticated;
revoke execute on function public.habito_timer_iniciar(uuid, uuid, bigint, uuid)            from authenticated;
revoke execute on function public.habito_timer_pausar(uuid, uuid, bigint, uuid)             from authenticated;
revoke execute on function public.habito_timer_reanudar(uuid, uuid, bigint, uuid)           from authenticated;
revoke execute on function public.habito_timer_finalizar(uuid, uuid, bigint, uuid)          from authenticated;
revoke execute on function public.habito_timer_cancelar(uuid, uuid, bigint, uuid)           from authenticated;
revoke execute on function public.habito_registrar_manual(uuid, uuid, bigint, uuid, date, integer) from authenticated;
commit;
```

### 3.D Reversión dura (destruye hábitos nuevos, tiempos e historial)
Precondición: exportar todas las tablas `habito*`, `habitos_config*` y `objetivos_atencion`; autorización expresa.
```sql
begin;
drop function if exists public.habito_registrar_manual(uuid, uuid, bigint, uuid, date, integer);
drop function if exists public.habito_timer_cancelar(uuid, uuid, bigint, uuid);
drop function if exists public.habito_timer_finalizar(uuid, uuid, bigint, uuid);
drop function if exists public.habito_timer_reanudar(uuid, uuid, bigint, uuid);
drop function if exists public.habito_timer_pausar(uuid, uuid, bigint, uuid);
drop function if exists public.habito_timer_iniciar(uuid, uuid, bigint, uuid);
drop function if exists public.habito_archivar(uuid, date);
drop function if exists public.habito_programar(uuid, text, smallint[], integer, date);
drop function if exists public.habito_crear(uuid, uuid, bigint, text, text, text, smallint[], integer, date);
drop function if exists public._cerrar_tramo(uuid, public.habito_temporizadores, timestamptz, uuid, uuid);
drop function if exists public._hay_ocurrencia(uuid, date);
drop table if exists public.habito_tiempo_historial;
drop table if exists public.habito_tiempo;
drop table if exists public.habito_segmentos;
drop table if exists public.habito_temporizadores;
drop table if exists public.habitos_config_versiones;
drop table if exists public.habitos_config;
drop function if exists public.objetivos_semana_cerrada();   -- el disparador se elimina con la tabla
drop table if exists public.objetivos_atencion;
commit;
```

### 3.V Comprobaciones de solo lectura
```sql
select table_name from information_schema.tables
where table_schema = 'public' and table_name like 'habito%' order by 1;
select count(*) from public.habitos;            -- debe seguir intacta (heredada)
select count(*) from public.habito_registros;   -- debe seguir intacta (heredada)
```

---

## Etapa 4: reconciliación sin conexión (`operaciones_aplicar`)

**No redactada.** **T-9 queda expresamente pendiente: no se implementan umbrales de desviación del reloj hasta realizar la simulación.** P7 aprueba la cola, los identificadores, las secuencias, las dependencias causales, la detección de concurrencia y la conservación de conflictos, pero **no** el algoritmo definitivo ni los valores de reloj. Su contrato propuesto:

- Entrada: arreglo JSON de operaciones (`op_id`, `dispositivo_id`, `seq`, `depende_de`, `version_base`, `tipo`, `objetivo`, `payload`, `ocurrido_en_dispositivo`) y la hora del dispositivo al enviar.
- Salida: un resultado por operación (`aplicada`, `duplicada`, `fusionada`, `rechazada`, `conflicto`, `pendiente_dependencia`) con su motivo.
- Aplica el orden aprobado: dependencias causales, secuencia por dispositivo, reglas explícitas para la concurrencia, hora ajustada solo como criterio auxiliar, conflictos conservados y notificados.

**Operaciones rechazadas (obligatorio en esta etapa).** Hoy, cuando una RPC lanza una excepción, PostgreSQL hace **rollback de toda la transacción** y no queda ninguna fila en `operaciones`. Para el modo sin conexión esto no es aceptable («nunca descartar en silencio»): `operaciones_aplicar` deberá procesar cada operación dentro de un bloque con captura de excepción (subtransacción), y registrar la operación como `rechazada` (o `conflicto`) con su motivo, para que el usuario la vea y la notificación quede pendiente. Esto afecta, por ejemplo, a un registro manual encolado sin conexión y rechazado por `sin_ocurrencia` (T-13).

Su SQL se presentará después de aprobar el algoritmo, con los escenarios de `docs/PRUEBAS-FASE-3-v1.9.md` §13.

---

## Resumen de objetos que se crearían

| Etapa | Tablas | Funciones RPC | Auxiliares | Disparadores | Columnas en tablas heredadas |
|---|---|---|---|---|---|
| 1 | 1 (`cambios_registro`) | 0 | 2 (`registrar_cambios`, `hitos_sellar_hecho_en`) | 3 | 5 (`prioridad`×2, `orden`, `fijado_dia`, `hecho_en`) |
| 2 | 5 (`preferencias_usuario`, `temporizador_activo`, `focus_sesiones`, `descansos`, `operaciones`) | 11 | 6 | 1 | 0 |
| 3 | 7 (`objetivos_atencion`, `habitos_config`, `habitos_config_versiones`, `habito_temporizadores`, `habito_segmentos`, `habito_tiempo`, `habito_tiempo_historial`) | 9 | 3 | 2 | 0 |

No se modifican ni se eliminan objetos existentes. No se tocan políticas RLS existentes, autenticación, middleware ni tareas programadas.
