delete from zz.res;
do $$ declare h uuid; begin
  perform zz.limpiar(); perform zz.admin();
  h := zz.hab(zz.u1(), 'manual', 'diaria', '{}'::smallint[], zz.hoy() - 30);
  perform zz.como(zz.u2());
  begin perform public.habito_programar(h, 'diaria', '{}'::smallint[], 1800, zz.hoy() + 1); perform zz.reg('X-12a habito_programar ajeno', false, 'no falló');
  exception when others then perform zz.reg('X-12a habito_programar ajeno -> habito_invalido', sqlerrm = 'habito_invalido', sqlerrm); end;
  begin perform public.habito_archivar(h); perform zz.reg('X-12b habito_archivar ajeno', false, 'no falló');
  exception when others then perform zz.reg('X-12b habito_archivar ajeno -> habito_invalido', sqlerrm = 'habito_invalido', sqlerrm); end;
  begin perform public.descanso_pausar(gen_random_uuid(), zz.d2(), zz.sq(), gen_random_uuid()); perform zz.reg('X-12c descanso inexistente', false, 'no falló');
  exception when others then perform zz.reg('X-12c descanso inexistente -> descanso_no_encontrado', sqlerrm = 'descanso_no_encontrado', sqlerrm); end;
  perform zz.admin();
  perform zz.reg('X-12d el hábito de U1 quedó intacto', (select archivado_desde from public.habitos_config where id = h) is null and (select count(*) from public.habitos_config_versiones where habito_id = h) = 1, null);
end $$;
-- Función definer con search_path vacío: un objeto homónimo en otro esquema no la afecta
do $$ begin
  perform zz.admin();
  create schema if not exists atacante;
  create or replace function atacante.now() returns timestamptz language sql as 'select ''1999-01-01''::timestamptz';
  perform set_config('search_path', 'atacante, public', true);
  perform zz.como(zz.u1());
  perform set_config('search_path', 'atacante, public', true);
  perform zz.reg('X-08b search_path del llamante manipulado no altera now()', (public.focus_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'productivity', 'tanku')).iniciado_en > '2000-01-01', null);
end $$;
select caso, ok, detalle from zz.res order by id;
