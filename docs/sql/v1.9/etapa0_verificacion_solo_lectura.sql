-- ============================================================================
-- FASE 3 · v1.9 · Etapa 0 · verificacion_solo_lectura
-- NO EJECUTADO. Extraído de docs/MIGRACIONES-FASE-3-v1.9.md (esa es la fuente).
-- No se ha ejecutado en Supabase. La v1.8 se validó solo en PostgreSQL local; T-7 y T-8b (v1.9) no se han revalidado.
-- Antes de cualquier ejecución: etapa 0 (verificación de roles y permisos) y autorización expresa por etapa.
-- ============================================================================
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
