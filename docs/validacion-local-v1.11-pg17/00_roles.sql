-- Roles que imitan al entorno REAL de Supabase observado en la etapa 0 (PostgreSQL 17.11, proyecto kztoazvjfwzndeubghey).
-- Solo para esta instancia local y desechable. Se ejecuta como `supabase_admin` (superusuario del clúster, creado con initdb -U supabase_admin).
--
-- Observado en la etapa 0 (consultas 0.1 y 0.3):
--   postgres        : login, NO superusuario, bypassrls, createrole. Miembro de anon, authenticated, authenticator, service_role,
--                     pg_create_subscription, pg_monitor, pg_read_all_data, pg_signal_backend, supabase_privileged_role.
--   anon / authenticated : nologin, sin bypassrls, sin superusuario.   service_role : nologin, bypassrls.
--   authenticator   : login, sin bypassrls; miembro de anon, authenticated, service_role.
--   supabase_admin  : superusuario (aquí es el superusuario del clúster).
-- Supuestos (no observados en la etapa 0): createdb de postgres, atributo INHERIT de los roles de la API.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role authenticator login;
create role supabase_privileged_role nologin;
create role supabase_auth_admin nologin;
create role postgres login bypassrls createrole createdb;

-- Pertenencia, tal cual la lista 0.3 de la etapa 0 (con herencia: es lo que importa para el hallazgo de v1.11).
grant anon, authenticated, service_role to authenticator;
grant anon, authenticated, authenticator, service_role, pg_create_subscription, pg_monitor, pg_read_all_data, pg_signal_backend, supabase_privileged_role to postgres;

-- Rol auxiliar para los controles negativos (no existe en Supabase).
create role sb_other nologin;
grant sb_other to postgres;

-- Base de datos: el propietario es `postgres`; el esquema `public` conserva su propietario por defecto (pg_database_owner), como en la etapa 0.
create database fixture owner postgres;
