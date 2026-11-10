-- Pruebas específicas de PostgreSQL 17 (v1.11): privilegio MAINTAIN, resultado real de REVOKE/GRANT, funciones SECURITY DEFINER y disparadores.
-- Se ejecuta como postgres (propietario) sobre la base con las etapas 1, 2 y 3 aplicadas. Solo lectura del catálogo.
-- Contexto: en PostgreSQL 17 aparece el privilegio MAINTAIN (VACUUM, ANALYZE, CLUSTER, REINDEX, REFRESH MATERIALIZED VIEW, LOCK TABLE) y los
-- privilegios por defecto de public (`grant all on tables`) lo incluyen. Un `revoke truncate, references, trigger` NO lo quita.
delete from zz.res;

-- ===== P17-01 .. P17-03: MAINTAIN en las tablas NUEVAS de la Fase 3 =====
do $$
declare t text; tablas text[] := array['cambios_registro','preferencias_usuario','temporizador_activo','focus_sesiones','descansos','operaciones','objetivos_atencion',
    'habitos_config','habitos_config_versiones','habito_temporizadores','habito_segmentos','habito_tiempo','habito_tiempo_historial'];
  malos text;
begin
  select string_agg(distinct c.relname || ':' || a.grantee::regrole::text, ', ' order by c.relname || ':' || a.grantee::regrole::text) into malos
  from pg_class c, aclexplode(c.relacl) a
  where c.relnamespace = 'public'::regnamespace and c.relname = any (tablas) and a.privilege_type = 'MAINTAIN' and a.grantee::regrole::text = 'anon';
  perform zz.reg('P17-01 anon no tiene MAINTAIN en ninguna tabla nueva', malos is null, coalesce(malos, 'ninguna'));

  select string_agg(distinct c.relname || ':' || a.grantee::regrole::text, ', ' order by c.relname || ':' || a.grantee::regrole::text) into malos
  from pg_class c, aclexplode(c.relacl) a
  where c.relnamespace = 'public'::regnamespace and c.relname = any (tablas) and a.privilege_type = 'MAINTAIN' and a.grantee::regrole::text = 'authenticated';
  perform zz.reg('P17-02 authenticated no tiene MAINTAIN en ninguna tabla nueva', malos is null, coalesce(malos, 'ninguna'));

  -- Cualquier otro rol de la API o PUBLIC (grantee 0) con MAINTAIN en tablas nuevas, distinto del propietario y de service_role.
  select string_agg(distinct c.relname || ':' || coalesce(nullif(a.grantee::regrole::text, '-'), 'PUBLIC'), ', ') into malos
  from pg_class c, aclexplode(c.relacl) a
  where c.relnamespace = 'public'::regnamespace and c.relname = any (tablas) and a.privilege_type = 'MAINTAIN'
    and coalesce(nullif(a.grantee::regrole::text, '-'), 'PUBLIC') not in ('postgres', 'service_role');
  perform zz.reg('P17-03 solo el propietario y service_role tienen MAINTAIN en las tablas nuevas', malos is null, coalesce(malos, 'ninguno otro'));
end $$;

-- ===== P17-04: privilegios de tabla exactos (anon y authenticated) en las tablas nuevas =====
-- Esperado según los REVOKE/GRANT de las etapas 1, 2 y 3. Las columnas con UPDATE por columna se comprueban aparte (P17-05).
do $$
declare r record; priv text; got text; privs text[] := array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'];
begin
  for r in select * from (values
    ('cambios_registro', 'SELECT'), ('preferencias_usuario', 'DELETE,INSERT,SELECT,UPDATE'), ('temporizador_activo', 'SELECT'), ('focus_sesiones', 'SELECT'),
    ('descansos', 'SELECT'), ('operaciones', 'SELECT'), ('objetivos_atencion', 'DELETE,INSERT,SELECT,UPDATE'), ('habitos_config', 'SELECT'),
    ('habitos_config_versiones', 'SELECT'), ('habito_temporizadores', 'SELECT'), ('habito_segmentos', 'SELECT'), ('habito_tiempo', 'SELECT'),
    ('habito_tiempo_historial', 'SELECT')) as v(tabla, esperado) loop
    got := '';
    foreach priv in array privs loop
      if has_table_privilege('authenticated', 'public.' || r.tabla, priv) then got := got || case when got = '' then '' else ',' end || priv; end if;
    end loop;
    got := (select string_agg(x, ',' order by x) from unnest(string_to_array(got, ',')) x where x <> '');
    perform zz.reg('P17-04a authenticated en ' || r.tabla || ' = ' || r.esperado, got is not distinct from r.esperado, 'real=' || coalesce(got, '(ninguno)'));

    got := '';
    foreach priv in array privs loop
      if has_table_privilege('anon', 'public.' || r.tabla, priv) then got := got || case when got = '' then '' else ',' end || priv; end if;
    end loop;
    perform zz.reg('P17-04b anon en ' || r.tabla || ' = (ninguno)', got = '', 'real=' || coalesce(nullif(got, ''), '(ninguno)'));
  end loop;
end $$;

-- ===== P17-05: UPDATE por columna =====
do $$ begin
  perform zz.reg('P17-05a operaciones: authenticated puede actualizar solo notificada',
    has_column_privilege('authenticated', 'public.operaciones', 'notificada', 'UPDATE')
    and not exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = 'operaciones' and c.column_name <> 'notificada'
                    and has_column_privilege('authenticated', 'public.operaciones', c.column_name, 'UPDATE')), null);
  perform zz.reg('P17-05b habitos_config: authenticated puede actualizar solo nombre y modo_registro',
    has_column_privilege('authenticated', 'public.habitos_config', 'nombre', 'UPDATE') and has_column_privilege('authenticated', 'public.habitos_config', 'modo_registro', 'UPDATE')
    and not exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = 'habitos_config' and c.column_name not in ('nombre', 'modo_registro')
                    and has_column_privilege('authenticated', 'public.habitos_config', c.column_name, 'UPDATE')), null);
end $$;

-- ===== P17-06: funciones. Sin EXECUTE para PUBLIC ni anon; authenticated solo en las 22 RPC del cliente =====
do $$
declare cli text[] := array['descanso_cancelar','descanso_completar','descanso_iniciar','descanso_omitir','descanso_pausar','descanso_reanudar','focus_cancelar','focus_completar',
    'focus_iniciar','focus_pausar','focus_reanudar','habito_archivar','habito_crear','habito_programar','habito_registrar_manual','habito_timer_cancelar','habito_timer_finalizar',
    'habito_timer_iniciar','habito_timer_pausar','habito_timer_reanudar','lunes_semana_bogota','prioridad_en_cierre'];
  nuevas text[] := cli || array['_cerrar_tramo','_ciclos_desde_ultimo_largo','_hay_ocurrencia','_journal','_op_existente','_prefs','_tocar_actualizado_en','_uid','hitos_sellar_hecho_en','objetivos_semana_cerrada','registrar_cambios'];
  malo text;
begin
  select string_agg(p.proname, ', ') into malo from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = any (nuevas)
     and exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.grantee = 0 and a.privilege_type = 'EXECUTE');
  perform zz.reg('P17-06a ninguna función nueva es ejecutable por PUBLIC', malo is null, coalesce(malo, 'ninguna'));
  select string_agg(p.proname, ', ') into malo from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = any (nuevas) and has_function_privilege('anon', p.oid, 'EXECUTE');
  perform zz.reg('P17-06b ninguna función nueva es ejecutable por anon', malo is null, coalesce(malo, 'ninguna'));
  select string_agg(p.proname, ', ') into malo from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = any (cli) and not has_function_privilege('authenticated', p.oid, 'EXECUTE');
  perform zz.reg('P17-06c las 22 RPC del cliente son ejecutables por authenticated', malo is null and (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname = any (cli)) = array_length(cli, 1), coalesce(malo, 'todas'));
  select string_agg(p.proname, ', ') into malo from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = any (nuevas) and not (p.proname = any (cli)) and has_function_privilege('authenticated', p.oid, 'EXECUTE');
  perform zz.reg('P17-06d las funciones internas y de disparador NO son ejecutables por authenticated', malo is null, coalesce(malo, 'ninguna'));
end $$;

-- ===== P17-07: funciones SECURITY DEFINER: search_path vacío fijado y propietario que omite RLS =====
do $$
declare malo text; n int;
begin
  select count(*) into n from pg_proc where pronamespace = 'public'::regnamespace and prosecdef;
  perform zz.reg('P17-07a existen funciones SECURITY DEFINER en public', n > 0, 'cantidad=' || n);
  select string_agg(proname, ', ') into malo from pg_proc where pronamespace = 'public'::regnamespace and prosecdef and not coalesce(proconfig @> array['search_path=""'], false);
  perform zz.reg('P17-07b toda función SECURITY DEFINER fija search_path = ""', malo is null, coalesce(malo, 'todas'));
  select string_agg(p.proname || ':' || r.rolname, ', ') into malo from pg_proc p join pg_roles r on r.oid = p.proowner
   where p.pronamespace = 'public'::regnamespace and p.prosecdef and not r.rolbypassrls and not r.rolsuper;
  perform zz.reg('P17-07c el propietario de toda función definer omite RLS', malo is null, coalesce(malo, 'todas'));
end $$;

-- ===== P17-08: disparadores presentes y habilitados =====
do $$
declare malo text;
begin
  select string_agg(esp.t, ', ') into malo from (values ('hitos_sellar_hecho_en'), ('pendientes_registrar_cambios'), ('hitos_registrar_cambios'), ('preferencias_tocar'), ('objetivos_tocar'), ('objetivos_semana_cerrada')) as esp(t)
   where not exists (select 1 from pg_trigger g where g.tgname = esp.t and not g.tgisinternal and g.tgenabled = 'O');
  perform zz.reg('P17-08 los 6 disparadores de la Fase 3 existen y están habilitados', malo is null, coalesce(malo, 'todos'));
end $$;

-- ===== P17-09: evidencia de las ACL (informativa: queda como PASS con el texto real para el informe) =====
do $$
declare r record;
begin
  for r in select c.relname, coalesce(c.relacl::text, '(por defecto)') as acl from pg_class c
            where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
              and c.relname in ('cambios_registro','preferencias_usuario','objetivos_atencion','operaciones','habitos_config','pendientes','hitos') order by 1 loop
    perform zz.reg('P17-09 ACL de ' || r.relname || ' (informativa)', true, r.acl);
  end loop;
end $$;

select caso, ok, detalle from zz.res order by id;
