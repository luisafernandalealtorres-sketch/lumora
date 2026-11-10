do $$ declare s public.focus_sesiones; hb public.habitos_config; begin
  perform zz.como(zz.u1());
  insert into public.pendientes (texto, frente) values ('p1','tanku'), ('p2','salud');
  s := public.focus_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'productivity','tanku');
  s := public.focus_cancelar(gen_random_uuid(), zz.d1(), zz.sq(), s.id);
  hb := public.habito_crear(gen_random_uuid(), zz.d1(), zz.sq(), 'Correr','manual','diaria','{}'::smallint[],2700);
end $$;
