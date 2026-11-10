# Pruebas de concurrencia con DOS conexiones psql independientes (v1.11). Se dot-source desde ejecutar_validacion.ps1.
# Requiere las variables: $bin, $port, $dbc (base de pruebas ya con etapas y utilidades), $work (carpeta de trabajo).
$u1 = '11111111-1111-1111-1111-111111111111'
$sid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; $hab = 'cccccccc-cccc-cccc-cccc-cccccccccccc'; $tmr = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
$opX = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'; $opH = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
$pre = "select set_config('request.jwt.claims','{`"sub`":`"$u1`",`"role`":`"authenticated`"}', false); set role authenticated;"
$cbase = @('-h', '127.0.0.1', '-p', "$port", '-U', 'postgres', '-d', $dbc, '-q', '-A', '-t')
function Own($sql) { (& "$bin\psql.exe" @cbase -c $sql 2>&1 | Out-String).Trim() }
function Conc($setup, $aSql, $bSql, $aEnd = 'commit', $delay = 1000) {
  Own "select zz.limpiar(); $setup" | Out-Null
  $fa = "$work\conc_a.sql"; $fb = "$work\conc_b.sql"
  Set-Content $fa "$pre`nbegin;`n$aSql`nselect pg_sleep(3);`n$aEnd;" -Encoding UTF8
  Set-Content $fb "$pre`n$bSql" -Encoding UTF8
  $pa = Start-Process "$bin\psql.exe" -ArgumentList ($cbase + @('-f', $fa)) -NoNewWindow -PassThru -RedirectStandardOutput "$work\a.out" -RedirectStandardError "$work\a.err"
  Start-Sleep -Milliseconds $delay
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $pb = Start-Process "$bin\psql.exe" -ArgumentList ($cbase + @('-f', $fb)) -NoNewWindow -PassThru -RedirectStandardOutput "$work\b.out" -RedirectStandardError "$work\b.err"
  $pb.WaitForExit(); $sw.Stop(); $pa.WaitForExit()
  $limpia = { param($f) ((Get-Content $f -ErrorAction SilentlyContinue) | Where-Object { $_ -notmatch '^\{"sub"' -and $_ -ne '' } | ForEach-Object { $_ -replace 'psql:[^ ]*conc_[ab]\.sql:\d+: ', '' }) -join ' | ' }
  [pscustomobject]@{ A = ((& $limpia "$work\a.out") + (& $limpia "$work\a.err")); B = ((& $limpia "$work\b.out") + (& $limpia "$work\b.err")); Ms = [int]$sw.Elapsed.TotalMilliseconds }
}
$resultadosCT = New-Object System.Collections.Generic.List[object]
function Reg($id, $ok, $det) { $script:resultadosCT.Add([pscustomobject]@{ Id = $id; Ok = [bool]$ok; Detalle = $det }) }

$setSes = "insert into public.focus_sesiones (id,user_id,modalidad,frente_id,duracion_objetivo_s,tramo_inicio,acumulado_s) values ('$sid','$u1','productivity','tanku',1800,now(),1800); insert into public.temporizador_activo (user_id,tipo,ref_id,estado) values ('$u1','focus','$sid','corriendo');"
$setHab = "insert into public.habitos_config (id,user_id,nombre,modo_registro) values ('$hab','$u1','h','temporizador'); insert into public.habitos_config_versiones (habito_id,user_id,vigente_desde,frecuencia,dias_semana,objetivo_s) values ('$hab','$u1', zz.hoy()-60,'diaria','{}',2700);"
$setT = $setHab + " insert into public.habito_temporizadores (id,user_id,habito_id,tramo_inicio) values ('$tmr','$u1','$hab', now()-interval '600 seconds'); insert into public.temporizador_activo (user_id,tipo,ref_id,estado) values ('$u1','habito','$tmr','corriendo');"
$ini = { param($n) "select (public.focus_iniciar(gen_random_uuid(), zz.d$n(), zz.sq(), 'productivity','tanku')).estado;" }

$r = Conc '' (& $ini 1) (& $ini 2)
$e = Own "select count(*)||'/'||(select count(*) from public.temporizador_activo) from public.focus_sesiones"
Reg 'CT-01 dos Focus simultÃ¡neos, A confirma: B espera y recibe temporizador_ocupado; 1 sesiÃ³n y 1 bloqueo' (($r.B -match 'temporizador_ocupado') -and $e -eq '1/1' -and $r.Ms -ge 1500) "B=$($r.B) | $e | espera $($r.Ms) ms"
$r = Conc '' (& $ini 1) (& $ini 2) 'rollback'
$e = Own "select count(*)||'/'||(select count(*) from public.temporizador_activo) from public.focus_sesiones"
Reg 'CT-02 dos Focus simultÃ¡neos, A revierte: B inicia; 1 sesiÃ³n y 1 bloqueo' (($r.B -match 'en_curso') -and $e -eq '1/1' -and $r.Ms -ge 1500) "B=$($r.B) | $e | espera $($r.Ms) ms"
$r = Conc $setSes "select (public.focus_completar(gen_random_uuid(), zz.d1(), zz.sq(), '$sid')).estado;" "select (public.focus_completar(gen_random_uuid(), zz.d2(), zz.sq(), '$sid')).estado;"
$e = Own "select sum(puntos)||'/'||(select count(*) from public.operaciones where tipo='focus_completar' and resultado='aplicada')||'/'||(select count(*) from public.operaciones where tipo='focus_completar' and resultado='duplicada')||'/'||(select count(*) from public.temporizador_activo) from public.focus_sesiones"
Reg 'CT-03 completar la misma sesiÃ³n desde dos conexiones: 1 punto, 1 aplicada, 1 duplicada, bloqueo liberado' ($e -eq '1/1/1/0') "$e | A=$($r.A) B=$($r.B)"
$r = Conc '' "select (public.focus_iniciar('$opX', zz.d1(), 5001, 'productivity','tanku')).id;" "select (public.focus_iniciar('$opX', zz.d1(), 5001, 'productivity','tanku')).id;"
$e = Own "select count(*)||'/'||(select count(*) from public.operaciones) from public.focus_sesiones"
Reg 'CT-04 mismo op_id en simultÃ¡neo: ambas conexiones reciben la misma sesiÃ³n; 1 sesiÃ³n y 1 operaciÃ³n' (($r.A -eq $r.B) -and $r.A.Length -gt 10 -and $e -eq '1/1') "A=$($r.A) B=$($r.B) | $e"
$r = Conc $setSes "select (public.focus_pausar(gen_random_uuid(), zz.d1(), zz.sq(), '$sid')).estado;" "select (public.focus_completar(gen_random_uuid(), zz.d2(), zz.sq(), '$sid')).estado;"
$e = Own "select estado||'/'||puntos||'/'||tiempo_efectivo_s||'/'||(select count(*) from public.temporizador_activo) from public.focus_sesiones"
Reg 'CT-05 pausar (A) y completar (B): estado final completada, 1 punto, 1800 s, bloqueo liberado' ($e -eq 'completada/1/1800/0') $e
$r = Conc $setHab "select (public.focus_iniciar(gen_random_uuid(), zz.d1(), zz.sq(), 'productivity','tanku')).estado;" "select (public.habito_timer_iniciar(gen_random_uuid(), zz.d2(), zz.sq(), '$hab')).estado;"
$e = Own "select (select count(*) from public.focus_sesiones)||'/'||(select count(*) from public.habito_temporizadores)||'/'||(select count(*) from public.temporizador_activo)"
Reg 'CT-06 Focus (A) y temporizador de hÃ¡bito (B): exclusividad entre tablas (B ocupado; 1/0/1)' (($r.B -match 'temporizador_ocupado') -and $e -eq '1/0/1') "B=$($r.B) | $e"
$r = Conc $setHab "select (public.habito_registrar_manual(gen_random_uuid(), zz.d1(), zz.sq(), '$hab', zz.hoy()-1, 1000)).manual_s;" "select (public.habito_registrar_manual(gen_random_uuid(), zz.d2(), zz.sq(), '$hab', zz.hoy()-1, 2000)).manual_s;"
$hh = Own "select string_agg(coalesce(valor_anterior_s::text,'null')||'->'||valor_nuevo_s, ' ; ' order by creado_en, valor_nuevo_s) from public.habito_tiempo_historial"
$v = Own "select manual_s from public.habito_tiempo"
Reg 'CT-07 dos registros manuales simultÃ¡neos: historial null->1000 ; 1000->2000 y vigente 2000' (($hh -eq 'null->1000 ; 1000->2000') -and $v -eq '2000') "$hh | vigente=$v"
$r = Conc $setT "select (public.habito_timer_pausar(gen_random_uuid(), zz.d1(), zz.sq(), '$tmr')).estado;" "select (public.habito_registrar_manual(gen_random_uuid(), zz.d2(), zz.sq(), '$hab', zz.hoy(), 1500)).manual_s;"
$hh = Own "select string_agg(coalesce(valor_anterior_s::text,'null')||'->'||valor_nuevo_s||'('||fuente||')', ' ; ' order by valor_nuevo_s) from public.habito_tiempo_historial"
Reg 'CT-08 cerrar tramo (A) y registro manual (B) de la misma ocurrencia: null->600(temporizador) ; 600->1500(manual)' ($hh -eq 'null->600(temporizador) ; 600->1500(manual)') $hh
$r = Conc '' "select (public.habito_crear('$opH', zz.d1(), 7001, 'Leer','manual','diaria','{}'::smallint[],3600)).id;" "select (public.habito_crear('$opH', zz.d1(), 7001, 'Leer','manual','diaria','{}'::smallint[],3600)).id;"
$e = Own "select count(*)||'/'||(select count(*) from public.habitos_config_versiones)||'/'||(select count(*) from public.operaciones) from public.habitos_config"
Reg 'CT-09 habito_crear con el mismo op_id en simultÃ¡neo: 1 hÃ¡bito, 1 versiÃ³n, 1 operaciÃ³n; mismo identificador' (($r.A -eq $r.B) -and $r.A.Length -gt 10 -and $e -eq '1/1/1') "A=$($r.A) B=$($r.B) | $e"
# CT-10 (nuevo, T-7): dos conexiones: A inserta el objetivo de la semana actual y B intenta borrar uno de una semana pasada
$l0 = Own "select zz.l0()"
$r = Conc "select zz.sembrar_obj(zz.l0() - 7);" "insert into public.objetivos_atencion (semana_inicio, frente_id, puntos) values (zz.l0(), 'tanku', 5);" "delete from public.objetivos_atencion where semana_inicio = zz.l0() - 7;"
$e = Own "select count(*)||'/'||(select count(*) from public.objetivos_atencion where semana_inicio = zz.l0() - 7) from public.objetivos_atencion"
Reg 'CT-10 T-7 con concurrencia: el borrado de la semana pasada sigue rechazado mientras otra conexiÃ³n inserta la actual (2 filas, la pasada intacta)' (($r.B -match 'semana_cerrada') -and $e -eq '2/1') "B=$($r.B) | $e"
$r = Conc '' "insert into public.preferencias_usuario (focus_min) values (20) on conflict (user_id) do update set focus_min = excluded.focus_min;" "insert into public.preferencias_usuario (focus_min) values (45) on conflict (user_id) do update set focus_min = excluded.focus_min;"
$e = Own "select count(*)||'/'||max(focus_min) from public.preferencias_usuario"
Reg 'CT-11 dos upserts simultÃ¡neos de preferencias: una sola fila y gana el Ãºltimo confirmado (45)' ($e -eq '1/45') $e
