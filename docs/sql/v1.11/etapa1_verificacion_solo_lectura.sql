-- ============================================================================
-- FASE 3 · v1.11 · Etapa 1 · verificacion_solo_lectura
-- Extraído de docs/MIGRACIONES-FASE-3-v1.11.md (esa es la fuente).
-- NO se ha ejecutado en Supabase. Validado completo en dos PostgreSQL locales y desechables: 16.15 (404 PASS, 0 FAIL, 2 NOT RUN; docs/VALIDACION-LOCAL-FASE-3-v1.11.md) y 17.11 (497 PASS, 0 FAIL, 2 NOT RUN; docs/VALIDACION-LOCAL-FASE-3-v1.11-PG17.md).
-- Antes de cualquier ejecución: etapa 0 (verificación de roles y permisos) y autorización expresa por etapa.
-- ============================================================================
select column_name, data_type, column_default, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name in ('pendientes', 'hitos')
  and column_name in ('prioridad', 'orden', 'fijado_dia', 'hecho_en');
select tgname, tgenabled from pg_trigger
where tgrelid in ('public.pendientes'::regclass, 'public.hitos'::regclass) and not tgisinternal;
select count(*) from public.cambios_registro;

-- Verificación de T-8b y T-8c (privilegios reales, no los de quien consulta): se espera para authenticated SOLO SELECT
-- y ningún privilegio para anon. Sin TRUNCATE, REFERENCES ni TRIGGER residuales.
select c.relname, a.grantee::regrole as rol, a.privilege_type as privilegio
from pg_class c, aclexplode(c.relacl) a
where c.oid = 'public.cambios_registro'::regclass
order by a.grantee::regrole::text, a.privilege_type;

-- El disparador definer escribe con los privilegios de su propietario: debe ser el propietario de la tabla, con INSERT,
-- y la tabla no debe tener RLS forzado.
select pg_get_userbyid(p.proowner) as propietario_funcion, pg_get_userbyid(c.relowner) as propietario_tabla,
       has_table_privilege(p.proowner, 'public.cambios_registro', 'INSERT') as propietario_puede_insertar,
       c.relrowsecurity, c.relforcerowsecurity, p.prosecdef, p.proconfig
from pg_proc p, pg_class c
where p.proname = 'registrar_cambios' and p.pronamespace = 'public'::regnamespace and c.oid = 'public.cambios_registro'::regclass;
