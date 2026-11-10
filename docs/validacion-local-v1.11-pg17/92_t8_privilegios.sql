-- T-8b / T-8c: matriz de permisos (H-12a a H-12n), inventario de privilegios con aclexplode y controles del disparador definer.
\set ON_ERROR_STOP 0
delete from zz.res;

-- ============ H-12: matriz sobre cambios_registro ============
do $$ declare p uuid; n int; st text; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  insert into public.pendientes (texto, frente) values ('t8', 'tanku') returning id into p;
  select count(*) into n from public.cambios_registro;
  perform zz.reg('H-12a authenticated SELECT: ve sus filas', n = 1, n::text);

  begin insert into public.cambios_registro (tabla, registro_id, evento) values ('pendientes', gen_random_uuid(), 'creado'); perform zz.reg('H-12b authenticated INSERT', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('H-12b authenticated INSERT = 42501', st = '42501', st); end;
  begin update public.cambios_registro set campo = 'x' where false; perform zz.reg('H-12c authenticated UPDATE (WHERE false)', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('H-12c authenticated UPDATE incluso con WHERE false = 42501', st = '42501', st); end;
  begin delete from public.cambios_registro where false; perform zz.reg('H-12d authenticated DELETE (WHERE false)', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('H-12d authenticated DELETE incluso con WHERE false = 42501', st = '42501', st); end;
  begin perform 1 from public.cambios_registro for update; perform zz.reg('H-12e authenticated SELECT … FOR UPDATE', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('H-12e authenticated SELECT … FOR UPDATE = 42501', st = '42501', st); end;
  begin insert into public.cambios_registro (id, tabla, registro_id, evento) values (gen_random_uuid(), 'pendientes', gen_random_uuid(), 'creado') on conflict (id) do nothing; perform zz.reg('H-12f authenticated INSERT … ON CONFLICT', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('H-12f authenticated INSERT … ON CONFLICT = 42501', st = '42501', st); end;
  begin truncate public.cambios_registro; perform zz.reg('H-12g authenticated TRUNCATE', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('H-12g authenticated TRUNCATE = 42501 (T-8c)', st = '42501', st); end;
  begin create table zz.fk_prueba (x uuid references public.cambios_registro (id)); perform zz.reg('H-12h-1 authenticated REFERENCES', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('H-12h-1 authenticated REFERENCES = 42501 (T-8c)', st = '42501', st); end;
  begin create trigger zz_t_prueba after insert on public.cambios_registro for each row execute function zz.t_profundidad('x'); perform zz.reg('H-12h-2 authenticated TRIGGER', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('H-12h-2 authenticated TRIGGER = 42501 (T-8c)', st = '42501', st); end;

  perform zz.como_rol('anon', null);
  begin perform 1 from public.cambios_registro; perform zz.reg('H-12i anon SELECT', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('H-12i anon SELECT = 42501 (T-8c revoca todo a anon)', st = '42501', st); end;
  begin insert into public.cambios_registro (tabla, registro_id, evento) values ('pendientes', gen_random_uuid(), 'creado'); perform zz.reg('H-12j-1 anon INSERT', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('H-12j-1 anon INSERT = 42501', st = '42501', st); end;
  begin update public.cambios_registro set campo = 'x'; perform zz.reg('H-12j-2 anon UPDATE', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('H-12j-2 anon UPDATE = 42501', st = '42501', st); end;
  begin delete from public.cambios_registro; perform zz.reg('H-12j-3 anon DELETE', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('H-12j-3 anon DELETE = 42501', st = '42501', st); end;
  begin truncate public.cambios_registro; perform zz.reg('H-12k-1 anon TRUNCATE', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('H-12k-1 anon TRUNCATE = 42501', st = '42501', st); end;
  begin create trigger zz_t_prueba2 after insert on public.cambios_registro for each row execute function zz.t_profundidad('x'); perform zz.reg('H-12k-2 anon TRIGGER', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('H-12k-2 anon TRIGGER = 42501', st = '42501', st); end;
  begin create table zz.fk_prueba2 (x uuid references public.cambios_registro (id)); perform zz.reg('H-12k-3 anon REFERENCES', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('H-12k-3 anon REFERENCES = 42501', st = '42501', st); end;

  perform zz.como_rol('service_role', null);
  select count(*) into n from public.cambios_registro;
  insert into public.cambios_registro (user_id, tabla, registro_id, evento) values (zz.u1(), 'pendientes', gen_random_uuid(), 'creado');
  perform zz.reg('H-12l service_role: SELECT e INSERT permitidos (sin cambios de privilegios)', n >= 1, n::text);

  perform zz.admin();
  select count(*) into n from public.cambios_registro;
  perform zz.reg('H-12m propietario: lectura permitida', n >= 1, n::text);

  perform zz.como(zz.u2());
  select count(*) into n from public.cambios_registro;
  perform zz.reg('H-12n otro usuario autenticado: 0 filas (aislamiento)', n = 0, n::text);
end $$;

-- ============ Inventario de privilegios efectivos con aclexplode (T-8c) ============
do $$ declare nsr int; malos text := ''; t text; esperado_auth text; esperado_anon text; reales_auth text; reales_anon text; col text;
begin
  perform zz.admin();
  for t, esperado_auth in select * from (values
      ('cambios_registro', 'SELECT'), ('temporizador_activo', 'SELECT'), ('focus_sesiones', 'SELECT'), ('descansos', 'SELECT'),
      ('habitos_config_versiones', 'SELECT'), ('habito_temporizadores', 'SELECT'), ('habito_segmentos', 'SELECT'),
      ('habito_tiempo', 'SELECT'), ('habito_tiempo_historial', 'SELECT'), ('operaciones', 'SELECT'), ('habitos_config', 'SELECT'),
      ('preferencias_usuario', 'DELETE,INSERT,SELECT,UPDATE'), ('objetivos_atencion', 'DELETE,INSERT,SELECT,UPDATE')) as v(a, b)
  loop
    select coalesce(string_agg(x.privilege_type, ',' order by x.privilege_type), '') into reales_auth
      from pg_class c, aclexplode(c.relacl) x where c.oid = ('public.' || t)::regclass and x.grantee = 'authenticated'::regrole;
    select coalesce(string_agg(x.privilege_type, ',' order by x.privilege_type), '') into reales_anon
      from pg_class c, aclexplode(c.relacl) x where c.oid = ('public.' || t)::regclass and x.grantee = 'anon'::regrole;
    if reales_auth <> esperado_auth then malos := malos || t || ': authenticated=' || reales_auth || ' (esperado ' || esperado_auth || '); '; end if;
    if reales_anon <> '' then malos := malos || t || ': anon=' || reales_anon || ' (esperado ninguno); '; end if;
  end loop;
  perform zz.reg('ACL-01 aclexplode: authenticated solo tiene lo esperado y anon ningún privilegio en las 13 tablas nuevas', malos = '', nullif(malos, ''));

  select string_agg(t.t || '.' || p.p, ', ') into malos
    from (values ('cambios_registro'), ('temporizador_activo'), ('focus_sesiones'), ('descansos'), ('habitos_config_versiones'), ('habito_temporizadores'),
                 ('habito_segmentos'), ('habito_tiempo'), ('habito_tiempo_historial'), ('operaciones'), ('habitos_config'), ('preferencias_usuario'), ('objetivos_atencion')) t(t),
         (values ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) p(p),
         (values ('authenticated'), ('anon')) r(rol)
   where has_table_privilege(r.rol, 'public.' || t.t, p.p);
  perform zz.reg('ACL-02 has_table_privilege: ni authenticated ni anon conservan TRUNCATE, REFERENCES ni TRIGGER en las 13 tablas nuevas', malos is null, malos);

  select string_agg(c.relname || '.' || a.attname || '=' || x.privilege_type, ', ' order by c.relname, a.attname) into col
    from pg_attribute a join pg_class c on c.oid = a.attrelid, aclexplode(a.attacl) x
   where c.relnamespace = 'public'::regnamespace and a.attacl is not null and x.grantee = 'authenticated'::regrole;
  perform zz.reg('ACL-03 permisos por columna del cliente: solo habitos_config.modo_registro, habitos_config.nombre y operaciones.notificada (UPDATE)',
    col = 'habitos_config.modo_registro=UPDATE, habitos_config.nombre=UPDATE, operaciones.notificada=UPDATE', col);

  select count(*) into nsr from pg_class c, aclexplode(c.relacl) x where c.oid = 'public.cambios_registro'::regclass and x.grantee = 'service_role'::regrole;
  perform zz.reg('ACL-04 service_role conserva sus privilegios (no se modificó)', nsr >= 7, nsr::text);
exception when others then perform zz.reg('ACL error', false, sqlerrm);
end $$;

-- Tablas heredadas: no se tocaron (conservan los privilegios por defecto del esquema)
do $$ declare n int; begin
  perform zz.admin();
  select count(*) into n from pg_class c, aclexplode(c.relacl) x where c.oid = 'public.pendientes'::regclass and x.grantee = 'authenticated'::regrole and x.privilege_type = 'TRUNCATE';
  perform zz.reg('ACL-05 las tablas heredadas NO se modificaron (pendientes conserva TRUNCATE para authenticated, como antes; fuera del alcance de T-8c)', n = 1, n::text);
end $$;

-- ============ TD: el disparador SECURITY DEFINER escribe con los permisos de su propietario ============
do $$ declare p uuid; n int; usr uuid; st text; fp text; tp text; puede boolean; cfg text[]; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  insert into public.pendientes (texto, frente) values ('td', 'tanku') returning id into p;
  select count(*), max(user_id::text)::uuid into n, usr from public.cambios_registro where registro_id = p and evento = 'creado';
  perform zz.reg('TD-01 insertar un pendiente como cliente deja la fila «creado» escrita por la función definer', n = 1, n::text);
  perform zz.reg('TD-04 el user_id del historial es el de la fila, no otro', usr = zz.u1(), usr::text);
  begin insert into public.cambios_registro (tabla, registro_id, evento) values ('pendientes', gen_random_uuid(), 'creado'); perform zz.reg('TD-03 cliente no puede insertar', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('TD-03 en el mismo escenario el cliente no puede insertar (42501) y el disparador sí (TD-01)', st = '42501' and n = 1, st); end;
  perform zz.admin();
  select pg_get_userbyid(pr.proowner), pg_get_userbyid(c.relowner), has_table_privilege(pr.proowner, 'public.cambios_registro', 'INSERT'), pr.proconfig
    into fp, tp, puede, cfg
    from pg_proc pr, pg_class c where pr.proname = 'registrar_cambios' and pr.pronamespace = 'public'::regnamespace and c.oid = 'public.cambios_registro'::regclass;
  perform zz.reg('TD-02 propietario de la función = propietario de la tabla y tiene INSERT', fp = tp and puede, fp || '/' || tp || '/' || puede);
  perform zz.reg('TD-10 search_path vacío en la función definer', 'search_path=""' = any(cfg), cfg::text);
  perform zz.como(zz.u1());
  begin perform public.registrar_cambios(); perform zz.reg('TD-09 registrar_cambios invocable como RPC', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('TD-09 el cliente no puede invocar registrar_cambios (sin EXECUTE) y el disparador igual funciona', st = '42501' and n = 1, st); end;
end $$;

do $$ declare m uuid; n int; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  insert into public.metas (titulo, frente) values ('m', 'tanku') returning id into m;
  insert into public.hitos (meta_id, titulo) values (m, 'h1'), (m, 'h2');
  delete from public.metas where id = m;
  select count(*) into n from public.cambios_registro where tabla = 'hitos' and evento = 'eliminado';
  perform zz.reg('TD-11 cascada: borrar una meta deja una fila «eliminado» por hito, escritas por la función definer', n = 2, n::text);
end $$;

do $$ declare p uuid; a int; b int; begin
  perform zz.limpiar(); perform zz.como(zz.u1());
  insert into public.pendientes (texto, frente) values ('td12', 'tanku') returning id into p;
  perform zz.admin(); select count(*) into a from public.cambios_registro;
  update public.pendientes set hecho = true where id = p;               -- administrador, sin identidad
  select count(*) into b from public.cambios_registro;
  perform zz.reg('TD-12 cambios sin identidad (administrador) no se registran (límite documentado)', a = b, a || '/' || b);
  perform zz.como(zz.u2()); select count(*) into a from public.cambios_registro;
  perform zz.reg('TD-13 aislamiento: otro usuario no ve filas del historial de U1', a = 0, a::text);
end $$;

select caso, ok, detalle from zz.res order by id;
