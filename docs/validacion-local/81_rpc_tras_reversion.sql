do $$ declare st text; begin
  perform zz.como(zz.u1());
  begin perform public.focus_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'productivity','tanku'); perform zz.reg('R-01a RPC tras reversión suave', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('R-01a focus_iniciar denegado tras la reversión suave', st = '42501', st); end;
  begin perform public.habito_crear(gen_random_uuid(), zz.d1(), zz.sq(), 'x','manual','diaria','{}'::smallint[],60); perform zz.reg('R-01b habito_crear', false, 'no falló');
  exception when others then get stacked diagnostics st = returned_sqlstate; perform zz.reg('R-01b habito_crear denegado tras la reversión suave', st = '42501', st); end;
end $$;
select caso, ok, detalle from zz.res where caso like 'R-01%' order by id;
