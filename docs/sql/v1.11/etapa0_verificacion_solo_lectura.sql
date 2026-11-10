-- ============================================================================
-- FASE 3 · v1.11 · Etapa 0 · verificacion_solo_lectura
-- Extraído de docs/MIGRACIONES-FASE-3-v1.11.md (esa es la fuente).
-- NO se ha ejecutado en Supabase. Validado completo (404 PASS, 0 FAIL, 2 NOT RUN) solo en un PostgreSQL 16 local y desechable: docs/VALIDACION-LOCAL-FASE-3-v1.11.md.
-- Antes de cualquier ejecución: etapa 0 (verificación de roles y permisos) y autorización expresa por etapa.
-- ============================================================================
-- 0.0 Contexto de ejecución. Debe ser el rol que ejecutará las migraciones (en Supabase, normalmente `postgres`).
select current_user as usuario_actual, session_user as usuario_de_sesion, current_setting('role') as rol_efectivo,
       r.rolsuper as superusuario, r.rolbypassrls as omite_rls
from pg_roles r where r.rolname = current_user;

-- 0.1 Atributos de los roles. Las funciones SECURITY DEFINER dependen de que su propietario omita RLS.
select rolname, rolsuper, rolbypassrls, rolcreaterole, rolcanlogin
from pg_roles
where rolname in ('postgres', 'authenticator', 'authenticated', 'anon', 'service_role', 'supabase_admin')
order by rolname;

-- 0.2 Propietarios y RLS forzado. El propietario omite RLS salvo que la tabla tenga RLS forzado.
select nspname, pg_get_userbyid(nspowner) as propietario from pg_namespace where nspname in ('public', 'auth');
select c.relname, pg_get_userbyid(c.relowner) as propietario, c.relrowsecurity, c.relforcerowsecurity
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

-- 0.4 Privilegios por defecto sobre objetos nuevos y ACL real de dos tablas heredadas.
select defaclrole::regrole as rol, defaclnamespace::regnamespace as esquema, defaclobjtype as tipo, defaclacl
from pg_default_acl;
select c.relname, a.grantee::regrole as rol, a.privilege_type as privilegio
from pg_class c, aclexplode(c.relacl) a
where c.relnamespace = 'public'::regnamespace and c.relname in ('pendientes', 'hitos')
order by c.relname, a.grantee::regrole::text, a.privilege_type;

-- 0.5 Funciones y disparadores existentes en public (se espera ninguno).
select proname, prosecdef, proconfig from pg_proc where pronamespace = 'public'::regnamespace order by 1;
select tgname, tgrelid::regclass from pg_trigger where not tgisinternal;

-- 0.6 Colisión de nombres, con catálogos (no depende de los privilegios de quien consulta).
select relname from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('cambios_registro', 'preferencias_usuario', 'temporizador_activo', 'focus_sesiones', 'descansos',
                  'operaciones', 'objetivos_atencion', 'habitos_config', 'habitos_config_versiones',
                  'habito_temporizadores', 'habito_segmentos', 'habito_tiempo', 'habito_tiempo_historial');
-- Esperado: solo (pendientes, hecho_en).
select c.relname, a.attname
from pg_attribute a join pg_class c on c.oid = a.attrelid
where c.relnamespace = 'public'::regnamespace and c.relname in ('pendientes', 'hitos')
  and a.attname in ('prioridad', 'orden', 'fijado_dia', 'hecho_en') and a.attnum > 0 and not a.attisdropped;

-- 0.7 Versión del motor, zona horaria y extensiones.
select version();
select count(*) as zona_bogota from pg_timezone_names where name = 'America/Bogota';
select extname from pg_extension order by 1;

-- 0.7b Definición de auth.uid(): solo informativa (NO demuestra el comportamiento).
select pg_get_functiondef('auth.uid()'::regprocedure);

-- 0.8 Filas de las tablas heredadas que se alteran. Solo es fiable como rol que omite RLS:
--     con otro rol, RLS devolvería 0 por no haber identidad.
select (select count(*) from public.pendientes) as pendientes, (select count(*) from public.hitos) as hitos;

-- 0.9 Comportamiento REAL de auth.uid() con una identidad JWT de prueba (ficticia). Solo lectura y se revierte.
begin read only;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f1","role":"authenticated"}', true);
set local role authenticated;
select 'a_identidad_jwt' as caso, current_user as rol_efectivo, session_user as usuario_de_sesion, auth.uid() as uid;
reset role;

select set_config('request.jwt.claims', '', true);
set local role authenticated;
select 'b_sin_claims' as caso, current_user, session_user, auth.uid();
reset role;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select 'c_anon_sin_sub' as caso, current_user, session_user, auth.uid();
reset role;

select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000f2', true);
set local role authenticated;
select 'd_claim_sub_suelto_informativo' as caso, current_user, session_user, auth.uid();
reset role;

select set_config('request.jwt.claim.sub', '', true);
select 'e_contexto_administrativo' as caso, current_user, session_user, auth.uid();

rollback;
select 'f_tras_rollback' as caso, nullif(current_setting('request.jwt.claims', true), '') as claims, auth.uid() as uid;

-- 0.10 ¿Puede el rol actual cambiar a authenticated y anon? (necesario para 0.9 y para las pruebas con ROLLBACK)
select pg_has_role(current_user, 'authenticated', 'member') as puede_authenticated,
       pg_has_role(current_user, 'anon', 'member') as puede_anon;

-- 0.11 Atributos de auth.uid().
select p.proname, p.provolatile, p.prosecdef, pg_get_userbyid(p.proowner) as propietario
from pg_proc p where p.oid = 'auth.uid()'::regprocedure;
