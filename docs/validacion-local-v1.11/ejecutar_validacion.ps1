# Validación local completa de la Fase 3 (v1.11) en un PostgreSQL 16 DESECHABLE.
# NO se conecta a Supabase, no usa credenciales ni variables de producción. Requiere un clúster ya iniciado en un puerto
# alternativo (por ejemplo 54331) y escucha solo en 127.0.0.1.
# Uso:  .\ejecutar_validacion.ps1 -Bin "C:\Program Files\PostgreSQL\16\bin" -Port 54331 -Work <carpeta-temporal> -Repo <repo>
param(
  [Parameter(Mandatory)] [string]$Bin,
  [Parameter(Mandatory)] [int]$Port,
  [Parameter(Mandatory)] [string]$Work,
  [Parameter(Mandatory)] [string]$Repo
)
$ErrorActionPreference = 'Continue'
$env:PGCLIENTENCODING = 'UTF8'
$bin = $Bin; $port = $Port; $work = $Work
if ($Port -eq 5432) { throw 'Puerto 5432 es el habitual del servicio PostgreSQL: use uno alternativo.' }
$docs = Join-Path $Repo 'docs'
$sqlDir = Join-Path $docs 'sql\v1.11'
$tst = Join-Path $docs 'validacion-local-v1.11'
$h = @('-h', '127.0.0.1', '-p', "$Port")
$tab = [string][char]9
$Resultados = New-Object System.Collections.Generic.List[object]

function Adm($sql) { (& "$bin\psql.exe" @h -U postgres -q -c $sql 2>&1 | Out-String).Trim() }
function Aplicar($db, $archivo) { (& "$bin\psql.exe" @h -U sb_owner -d $db -v ON_ERROR_STOP=1 -q -f $archivo 2>&1 | Out-String).Trim() }
function Q($db, $sql) { (& "$bin\psql.exe" @h -U sb_owner -d $db -Atc $sql 2>&1 | Out-String).Trim() }
function Anota($suite, $id, $estado, $det) { $script:Resultados.Add([pscustomobject]@{ Suite = $suite; Id = $id; Estado = $estado; Detalle = $det }) }
function Correr($suite, $db, $archivo, $usuario = 'sb_owner') {
  $out = (& "$bin\psql.exe" @h -U $usuario -d $db -q -A -F $tab -t -f $archivo 2>&1 | Out-String)
  $n = 0
  foreach ($l in ($out -split "`r?`n")) {
    $p = $l -split $tab
    if ($p.Count -ge 3 -and $p[0] -ne '' -and ($p[1] -eq 't' -or $p[1] -eq 'f' -or $p[1] -eq '')) {
      $estado = switch ($p[1]) { 't' { 'PASS' } 'f' { 'FAIL' } default { 'NOT RUN' } }
      Anota $suite $p[0] $estado (($p[2..($p.Count - 1)]) -join ' ')
      $n++
    }
  }
  $err = ($out -split "`r?`n") | Where-Object { $_ -match 'ERROR:' -and $_ -notmatch 'semana_cerrada|permission denied|temporizador_ocupado|transicion_invalida' }
  if ($err) { Anota $suite "$suite/errores" 'INFO' (($err | Select-Object -First 5) -join ' || ') }
  Anota $suite "$suite/filas" 'INFO' "$n resultados leídos de $(Split-Path $archivo -Leaf)"
  Adm "select 1" | Out-Null
}
function Limpiar-Res($db) { Q $db 'delete from zz.res' | Out-Null }
function Preparar($db) {
  Adm "drop database if exists $db" | Out-Null
  Adm "create database $db template fixture owner sb_owner" | Out-Null
}
function Etapas($db, $suite) {
  foreach ($e in 'etapa1_aplicar', 'etapa2_aplicar', 'etapa3_aplicar') {
    $r = Aplicar $db "$sqlDir\$e.sql"
    if ($r) { Anota $suite "$suite/$e" 'FAIL' $r } else { Anota $suite "$suite/$e" 'PASS' 'aplicada sin errores' }
  }
}
function Volcado($db, $archivo) {
  & "$bin\pg_dump.exe" @h -U sb_owner -s -d $db -f $archivo 2>&1 | Out-Null
  (Get-Content $archivo | Where-Object { $_ -notmatch '^\s*--' -and $_ -notmatch '^\\(un)?restrict' -and $_.Trim() -ne '' })
}

# ---------- 0. Entorno
Anota 'entorno' 'version' 'INFO' (Adm "select version()")
Anota 'entorno' 'puerto' 'INFO' (Adm "show port")
Anota 'entorno' 'escucha' 'INFO' (Adm "show listen_addresses")
Anota 'entorno' 'directorio' 'INFO' (Adm "show data_directory")

# ---------- 1. Plantilla (roles + esquema heredado)
foreach ($d in 'main', 'rev_suave', 'rev_dura', 'fixture') { Adm "drop database if exists $d with (force)" | Out-Null }
foreach ($r in 'sb_other', 'sb_owner', 'service_role', 'authenticated', 'anon') { Adm "drop role if exists $r" | Out-Null }
$o = (& "$bin\psql.exe" @h -U postgres -v ON_ERROR_STOP=1 -q -f "$tst\00_roles.sql" 2>&1 | Out-String).Trim()
Anota 'plantilla' 'roles' $(if ($o) { 'FAIL' } else { 'PASS' }) $o
$o = (& "$bin\psql.exe" @h -U sb_owner -d fixture -v ON_ERROR_STOP=1 -q -f "$tst\01_fixture.sql" 2>&1 | Out-String).Trim()
Anota 'plantilla' 'esquema heredado (réplica estructural)' $(if ($o) { 'FAIL' } else { 'PASS' }) $o
$esquemaInicial = Volcado 'fixture' "$work\fixture.dump.sql"

# ---------- 2. Base principal: etapas 1, 2 y 3 + utilidades
Preparar 'main'
Etapas 'main' 'principal'
$o = Aplicar 'main' "$tst\10_utilidades.sql"; Anota 'principal' 'utilidades de prueba' $(if ($o) { 'FAIL' } else { 'PASS' }) $o

$suites = @(
  @('etapa1', '20_pruebas_etapa1.sql'), @('etapa2', '30_pruebas_etapa2.sql'), @('etapa3', '40_pruebas_etapa3.sql'),
  @('regresion heredada', '50_regresion_heredada.sql'), @('seguridad extra', '60_seguridad_extra.sql'),
  @('historial prioridad', '70_historial_prioridad.sql'), @('historial no insertable', '71_historial_no_insertable.sql'),
  @('T-6', '90_t6_prioridad_cierre.sql'), @('T-7', '91_t7_objetivos.sql'), @('T-8b/T-8c', '92_t8_privilegios.sql')
)
foreach ($s in $suites) { Limpiar-Res 'main'; Correr $s[0] 'main' "$tst\$($s[1])" }

# T-7b-3: comparación SQL vs JavaScript
Limpiar-Res 'main'
$csv = "$work\muestra_lunes.csv"
& "$bin\psql.exe" @h -U sb_owner -d main -q -A -t -f "$tst\93_frontera_lunes_muestra.sql" 2>$null | Set-Content $csv -Encoding UTF8
$js = (& node "$tst\93_comparar_con_js.mjs" (Join-Path $Repo 'web\lib\domain\fechas.js') $csv 2>&1 | Out-String).Trim()
$ok = $LASTEXITCODE -eq 0
Anota 'T-7b-3' 'T7-44 comparación SQL vs inicioSemana de JavaScript (instantes horarios 2019-2029 y fronteras)' $(if ($ok) { 'PASS' } else { 'FAIL' }) $js

# Controles negativos (superusuario)
Limpiar-Res 'main'
Correr 'controles negativos TD' 'main' "$tst\94_controles_negativos_td.sql" 'postgres'

# ---------- 3. Concurrencia
$dbc = 'main'
Adm "select 1" | Out-Null
Q 'main' 'delete from zz.res' | Out-Null
. "$tst\95_concurrencia.ps1"
foreach ($c in $resultadosCT) { Anota 'concurrencia' $c.Id $(if ($c.Ok) { 'PASS' } else { 'FAIL' }) $c.Detalle }

# ---------- 4. Reversión suave con datos
Preparar 'rev_suave'
Etapas 'rev_suave' 'reversión suave'
Aplicar 'rev_suave' "$tst\10_utilidades.sql" | Out-Null
Aplicar 'rev_suave' "$tst\80_datos_reversion.sql" | Out-Null
$cnt = "select (select count(*) from public.cambios_registro)||'/'||(select count(*) from public.focus_sesiones)||'/'||(select count(*) from public.operaciones)||'/'||(select count(*) from public.habitos_config)||'/'||(select count(*) from public.pendientes)"
$antes = Q 'rev_suave' $cnt
foreach ($e in 'etapa3_reversion_suave', 'etapa2_reversion_suave', 'etapa1_reversion_suave') {
  $r = Aplicar 'rev_suave' "$sqlDir\$e.sql"; Anota 'reversión suave' $e $(if ($r) { 'FAIL' } else { 'PASS' }) $(if ($r) { $r } else { 'aplicada sin errores' })
}
$despues = Q 'rev_suave' $cnt
Anota 'reversión suave' 'R-01 conservación de datos (historial/sesiones/operaciones/hábitos/pendientes)' $(if ($antes -eq $despues -and $antes) { 'PASS' } else { 'FAIL' }) "antes=$antes después=$despues"
Limpiar-Res 'rev_suave'
Correr 'reversión suave' 'rev_suave' "$tst\81_rpc_tras_reversion.sql"
# regresión heredada con la reversión suave aplicada
$out = (& "$bin\psql.exe" @h -U sb_owner -d rev_suave -q -A -F $tab -t -f "$tst\50_regresion_heredada.sql" 2>&1 | Out-String)
$res = @{}
foreach ($l in ($out -split "`r?`n")) { $p = $l -split $tab; if ($p.Count -ge 3 -and $p[0] -ne '') { $res[$p[0].Split(' ')[0]] = $p[1] } }
foreach ($k in 'L-01/02', 'L-03/10', 'L-06/07', 'L-07b', 'L-09a', 'L-09b', 'L-09c', 'L-09d') { Anota 'reversión suave' "heredado $k" $(if ($res[$k] -eq 't') { 'PASS' } else { 'FAIL' }) "resultado=$($res[$k])" }
Anota 'reversión suave' 'heredado L-04/05 (hecho_en de hitos sin disparador)' $(if ($res['L-04/05'] -eq 'f') { 'PASS' } else { 'FAIL' }) "ESPERADO que falle con la reversión suave (el disparador está desactivado): resultado=$($res['L-04/05'])"
Anota 'reversión suave' 'heredado L-08 (habito_crear revocado)' $(if (-not $res.ContainsKey('L-08')) { 'PASS' } else { 'FAIL' }) "ESPERADO que el bloque aborte (permiso denegado): presente=$($res.ContainsKey('L-08'))"

# ---------- 5. Reversión dura, comparación de esquema y repetibilidad
Preparar 'rev_dura'
Etapas 'rev_dura' 'reversión dura'
foreach ($e in 'etapa3_reversion_dura', 'etapa2_reversion_dura', 'etapa1_reversion_dura') {
  $r = Aplicar 'rev_dura' "$sqlDir\$e.sql"; Anota 'reversión dura' $e $(if ($r) { 'FAIL' } else { 'PASS' }) $(if ($r) { $r } else { 'aplicada sin errores' })
}
$d1 = Volcado 'rev_dura' "$work\rev_dura1.dump.sql"
$dif = Compare-Object $esquemaInicial $d1
Anota 'reversión dura' 'R-02 esquema tras la reversión dura = esquema inicial (pg_dump -s con privilegios)' $(if (-not $dif) { 'PASS' } else { 'FAIL' }) $(if ($dif) { ($dif | Select-Object -First 6 | ForEach-Object { "$($_.SideIndicator) $($_.InputObject)" }) -join ' || ' } else { 'idéntico' })
$resid = Q 'rev_dura' "select (select count(*) from pg_class where relnamespace='public'::regnamespace and relname not in ('frentes','metas','pendientes','hitos','habitos','habito_registros') and relkind in ('r','S','v','i') and relname !~ '_(pkey|key|idx|fkey|check)$' and relname !~ '^(frentes|metas|pendientes|hitos|habitos|habito_registros)_') || '/' || (select count(*) from pg_proc where pronamespace='public'::regnamespace) || '/' || (select count(*) from pg_trigger where not tgisinternal)"
Anota 'reversión dura' 'R-02b objetos residuales (tablas o secuencias ajenas / funciones / disparadores) = 0/0/0' $(if ($resid -eq '0/0/0') { 'PASS' } else { 'FAIL' }) $resid
$colRes = Q 'rev_dura' "select count(*) from pg_attribute a join pg_class c on c.oid=a.attrelid where c.relnamespace='public'::regnamespace and c.relname in ('pendientes','hitos') and a.attnum>0 and not a.attisdropped and a.attname in ('prioridad','orden','fijado_dia') or (c.relname='hitos' and a.attname='hecho_en' and a.attnum>0 and not a.attisdropped)"
Anota 'reversión dura' 'R-02c columnas aditivas eliminadas de pendientes e hitos' $(if ($colRes -eq '0') { 'PASS' } else { 'FAIL' }) "columnas residuales=$colRes"
# R-04 reaplicar tras revertir y R-05 repetibilidad (aplicar, revertir, aplicar, revertir)
Etapas 'rev_dura' 'repetibilidad (2.ª aplicación)'
Anota 'repetibilidad' 'R-04 reaplicar las tres etapas tras la reversión dura' $(if (-not ($Resultados | Where-Object { $_.Suite -eq 'repetibilidad (2.ª aplicación)' -and $_.Estado -eq 'FAIL' })) { 'PASS' } else { 'FAIL' }) 'ver detalle de etapas'
foreach ($e in 'etapa3_reversion_dura', 'etapa2_reversion_dura', 'etapa1_reversion_dura') { Aplicar 'rev_dura' "$sqlDir\$e.sql" | Out-Null }
$d2 = Volcado 'rev_dura' "$work\rev_dura2.dump.sql"
$dif2 = Compare-Object $esquemaInicial $d2
Anota 'repetibilidad' 'R-05 segunda reversión dura: esquema = inicial' $(if (-not $dif2) { 'PASS' } else { 'FAIL' }) $(if ($dif2) { ($dif2 | Select-Object -First 4 | ForEach-Object { "$($_.SideIndicator) $($_.InputObject)" }) -join ' || ' } else { 'idéntico' })
# 3.ª aplicación desde cero + las pruebas de etapa 1, 2 y 3 sobre ella
Etapas 'rev_dura' 'repetibilidad (3.ª aplicación)'
Aplicar 'rev_dura' "$tst\10_utilidades.sql" | Out-Null
foreach ($s in @(@('repetibilidad: etapa1', '20_pruebas_etapa1.sql'), @('repetibilidad: etapa2', '30_pruebas_etapa2.sql'), @('repetibilidad: etapa3', '40_pruebas_etapa3.sql'))) { Limpiar-Res 'rev_dura'; Correr $s[0] 'rev_dura' "$tst\$($s[1])" }

# ---------- 6. Resumen
$Resultados | Export-Csv -NoTypeInformation -Encoding UTF8 -Path "$work\resultados.csv"
$tot = $Resultados | Where-Object { $_.Estado -in 'PASS', 'FAIL', 'NOT RUN' }
"RESUMEN: PASS=$(($tot | Where-Object Estado -eq 'PASS').Count) FAIL=$(($tot | Where-Object Estado -eq 'FAIL').Count) NOT RUN=$(($tot | Where-Object Estado -eq 'NOT RUN').Count)"
$Resultados | Where-Object { $_.Estado -in 'FAIL', 'NOT RUN' } | ForEach-Object { "$($_.Estado) | $($_.Suite) | $($_.Id) | $($_.Detalle)" }
$Resultados | Where-Object { $_.Estado -eq 'INFO' -and $_.Id -match 'errores' } | ForEach-Object { "INFO | $($_.Suite) | $($_.Detalle)" }
