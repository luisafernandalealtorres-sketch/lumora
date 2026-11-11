-- Semilla de las pruebas de reversión con temporizadores activos. Se ejecuta con las etapas 1, 2 y 3 aplicadas.
--   u1: temporizador de hábito EN CURSO con 600 s de tramo abierto, más un objetivo semanal.
--   u3: temporizador de hábito PAUSADO con 300 s ya cerrados.
--   u2: Focus EN CURSO.      u4: descanso EN CURSO.
-- Guarda en zz.antes lo que las comprobaciones comparan después: filas de Focus y descanso (md5), conteos, tiempo previo y privilegios de la etapa 2.
insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'u3@prueba.local'), ('44444444-4444-4444-4444-444444444444', 'u4@prueba.local') on conflict do nothing;
do $$ declare u3 uuid := '33333333-3333-3333-3333-333333333333'; u4 uuid := '44444444-4444-4444-4444-444444444444';
  h1 uuid; h3 uuid; t public.habito_temporizadores; s public.focus_sesiones; d public.descansos; hoy date := (now() at time zone 'America/Bogota')::date; begin
  perform zz.limpiar(); perform zz.admin();
  delete from zz.antes;
  h1 := zz.hab(zz.u1(), 'temporizador', 'diaria', '{}'::smallint[], hoy - 60);
  h3 := zz.hab(u3, 'temporizador', 'diaria', '{}'::smallint[], hoy - 60);
  perform zz.como(zz.u1()); t := public.habito_timer_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), h1);
  insert into public.objetivos_atencion (semana_inicio, frente_id, puntos) values (public.lunes_semana_bogota(now()), 'tanku', 10);   -- edición del cliente, permitida antes de revertir
  perform zz.admin(); update public.habito_temporizadores set tramo_inicio = now() - interval '600 seconds' where id = t.id;
  perform zz.como(u3); t := public.habito_timer_iniciar(gen_random_uuid(), zz.d2(), zz.sq(), h3);
  perform zz.admin(); update public.habito_temporizadores set tramo_inicio = now() - interval '300 seconds' where id = t.id; perform zz.como(u3);
  t := public.habito_timer_pausar(gen_random_uuid(), zz.d2(), zz.sq(), t.id);
  perform zz.como(zz.u2()); s := public.focus_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'productivity', 'tanku');
  perform zz.como(u4); d := public.descanso_iniciar(gen_random_uuid(), zz.d2(), zz.sq(), 'corto');
  perform zz.admin();
  insert into zz.antes values
    ('lock_u2', (select md5(a::text) from public.temporizador_activo a where a.user_id = zz.u2())),
    ('lock_u4', (select md5(a::text) from public.temporizador_activo a where a.user_id = u4)),
    ('focus_u2', (select md5(f::text) from public.focus_sesiones f where f.user_id = zz.u2())),
    ('descanso_u4', (select md5(x::text) from public.descansos x where x.user_id = u4)),
    ('seg_u3', (select coalesce(sum(segundos), 0)::text from public.habito_segmentos where user_id = u3)),
    ('bloqueos_habito', (select count(*)::text from public.temporizador_activo where tipo = 'habito')),
    ('bloqueos_otros', (select count(*)::text from public.temporizador_activo where tipo <> 'habito')),
    ('n_habitos', (select count(*)::text from public.habitos_config)),
    ('n_versiones', (select count(*)::text from public.habitos_config_versiones)),
    ('n_objetivos', (select count(*)::text from public.objetivos_atencion)),
    ('n_temporizadores', (select count(*)::text from public.habito_temporizadores)),
    ('privs_etapa2', zz.privs_etapa2());
end $$;
