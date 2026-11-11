-- Comprobaciones tras la cadena habitual: reversión SUAVE (con temporizadores activos) y, a continuación, la DURA.
-- Se ejecuta sobre la misma base que 83_comprobar_reversion_suave.sql (u1 y u3 ya iniciaron Focus allí).
delete from zz.res;
do $$ declare u3 uuid := '33333333-3333-3333-3333-333333333333'; u4 uuid := '44444444-4444-4444-4444-444444444444'; n int; begin
  perform zz.admin();
  select count(*) into n from unnest(array['habitos_config', 'habitos_config_versiones', 'habito_temporizadores', 'habito_segmentos', 'habito_tiempo', 'habito_tiempo_historial', 'objetivos_atencion']) x where to_regclass('public.' || x) is not null;
  perform zz.reg('RT-C01 tras suave y dura no queda ninguna tabla de la etapa 3', n = 0, 'existentes=' || n);
  perform zz.reg('RT-C02 no queda ningún bloqueo tipo hábito', (select count(*) from public.temporizador_activo where tipo = 'habito') = 0, null);
  perform zz.reg('RT-C03a la sesión de Focus de u2 y el descanso de u4 siguen intactos',
    (select md5(f::text) from public.focus_sesiones f where f.user_id = zz.u2()) = (select valor from zz.antes where clave = 'focus_u2')
    and (select md5(x::text) from public.descansos x where x.user_id = u4) = (select valor from zz.antes where clave = 'descanso_u4'), null);
  perform zz.reg('RT-C03b los bloqueos de Focus y descansos siguen: u2, u4 y las sesiones que iniciaron u1 y u3', (select count(*) from public.temporizador_activo where tipo <> 'habito') = 4, 'bloqueos=' || (select count(*) from public.temporizador_activo where tipo <> 'habito'));
  perform zz.reg('RT-C04 los privilegios de todo lo de Focus no cambiaron', zz.privs_etapa2() = (select valor from zz.antes where clave = 'privs_etapa2'), null);
end $$;
select caso, ok, detalle from zz.res order by id;
