# Pruebas de reversión de la etapa 3 (v1.11) CON TEMPORIZADORES ACTIVOS, en un PostgreSQL DESECHABLE (válido para 16.15 y 17.11).
# NO se conecta a Supabase, no usa credenciales ni variables de producción. Requiere un clúster ya iniciado en un puerto alternativo
# (por ejemplo 54341), escuchando solo en 127.0.0.1, con superusuario `supabase_admin` y mensajes en inglés:
#   initdb -D <carpeta> -U supabase_admin --auth=trust -E UTF8
#   pg_ctl -D <carpeta> -o "-p 54341 -c listen_addresses=127.0.0.1 -c shared_preload_libraries=pg_stat_statements -c lc_messages=C" start
# Uso:  .\ejecutar_reversion_temporizadores.ps1 -Bin <bin de PostgreSQL> -Port 54341 -Work <carpeta-temporal> -Repo <raíz del repositorio>
# Deja resultados-reversion-temporizadores.csv en la carpeta de trabajo. Complementa a ejecutar_validacion.ps1 (que prueba las reversiones SIN temporizadores activos).
param(
  [Parameter(Mandatory)] [string]$Bin,
  [Parameter(Mandatory)] [int]$Port,
  [Parameter(Mandatory)] [string]$Work,
  [Parameter(Mandatory)] [string]$Repo
)
$ErrorActionPreference = 'Continue'
$env:PGCLIENTENCODING = 'UTF8'
if ($Port -eq 5432) { throw 'Puerto 5432 es el habitual del servicio PostgreSQL: use uno alternativo.' }
$sqlDir = Join-Path $Repo 'docs\sql\v1.11'
$tst = Join-Path $Repo 'docs\validacion-local-v1.11-pg17'
$h = @('-h', '127.0.0.1', '-p', "$Port")
$tab = [string][char]9
$Resultados = New-Object System.Collections.Generic.List[object]
function Adm($sql) { (& "$Bin\psql.exe" @h -U supabase_admin -d postgres -q -c $sql 2>&1 | Out-String).Trim() }
function Aplicar($db, $archivo) { (& "$Bin\psql.exe" @h -U postgres -d $db -v ON_ERROR_STOP=1 -q -f $archivo 2>&1 | Out-String).Trim() }
function Anota($suite, $id, $estado, $det) { $script:Resultados.Add([pscustomobject]@{ Suite = $suite; Id = $id; Estado = $estado; Detalle = $det }) }
function Correr($suite, $db, $archivo) {
  $out = (& "$Bin\psql.exe" @h -U postgres -d $db -q -A -F $tab -t -f $archivo 2>&1 | Out-String)
  $n = 0
  foreach ($l in ($out -split "`r?`n")) {
    $p = $l -split $tab
    if ($p.Count -ge 3 -and $p[0] -ne '' -and ($p[1] -eq 't' -or $p[1] -eq 'f' -or $p[1] -eq '')) {
      $estado = switch ($p[1]) { 't' { 'PASS' } 'f' { 'FAIL' } default { 'NOT RUN' } }
      Anota $suite $p[0] $estado (($p[2..($p.Count - 1)]) -join ' '); $n++
    }
  }
  $err = ($out -split "`r?`n") | Where-Object { $_ -match 'ERROR:' -and $_ -notmatch 'permission denied' }
  if ($err) { Anota $suite "$suite/errores" 'FAIL' (($err | Select-Object -First 5) -join ' || ') }
  Anota $suite "$suite/filas" 'INFO' "$n resultados leídos de $(Split-Path $archivo -Leaf)"
  Adm 'select 1' | Out-Null
}
function Preparar($db) {
  Adm "drop database if exists $db with (force)" | Out-Null
  Adm "create database $db template fixture owner postgres" | Out-Null
}
function Montar($db, $suite) {
  foreach ($e in 'etapa1_aplicar', 'etapa2_aplicar', 'etapa3_aplicar') {
    $r = Aplicar $db "$sqlDir\$e.sql"; if ($r) { Anota $suite "$suite/$e" 'FAIL' $r } else { Anota $suite "$suite/$e" 'PASS' 'aplicada sin errores' }
  }
  foreach ($f in '10_utilidades.sql', '81_ayudantes_reversion.sql', '82_semilla_reversion_temporizadores.sql') {
    $r = Aplicar $db "$tst\$f"; if ($r) { Anota $suite "$suite/$f" 'FAIL' $r } else { Anota $suite "$suite/$f" 'PASS' 'aplicado sin errores' }
  }
}
function Revertir($db, $suite, $archivo) {
  $r = Aplicar $db "$sqlDir\$archivo"
  if ($r) { Anota $suite $archivo 'FAIL' $r } else { Anota $suite $archivo 'PASS' 'aplicada sin errores' }
}

# ---------- 0. Entorno
Anota 'entorno' 'version' 'INFO' (Adm 'select version()')
Anota 'entorno' 'puerto' 'INFO' (Adm 'show port')
Anota 'entorno' 'etapa3_aplicar.sql SHA-256 (no debe cambiar)' 'INFO' ((Get-FileHash "$sqlDir\etapa3_aplicar.sql" -Algorithm SHA256).Hash.ToLower())

# ---------- 1. Plantilla (roles reales + esquema heredado)
foreach ($d in 'rev_suave', 'rev_dura', 'fixture') { Adm "drop database if exists $d with (force)" | Out-Null }
foreach ($r in 'sb_other', 'postgres', 'supabase_auth_admin', 'supabase_privileged_role', 'authenticator', 'service_role', 'authenticated', 'anon') { Adm "drop role if exists $r" | Out-Null }
$o = (& "$Bin\psql.exe" @h -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q -f "$tst\00_roles.sql" 2>&1 | Out-String).Trim()
Anota 'plantilla' 'roles' $(if ($o) { 'FAIL' } else { 'PASS' }) $o
$o = (& "$Bin\psql.exe" @h -U supabase_admin -d fixture -v ON_ERROR_STOP=1 -q -f "$tst\01a_auth_extensiones_real.sql" 2>&1 | Out-String).Trim()
Anota 'plantilla' 'esquema auth, extensiones y privilegios por defecto (reales)' $(if ($o) { 'FAIL' } else { 'PASS' }) $o
$o = Aplicar 'fixture' "$tst\01_fixture.sql"
Anota 'plantilla' 'esquema heredado (réplica estructural)' $(if ($o) { 'FAIL' } else { 'PASS' }) $o

# ---------- 2. Reversión SUAVE con temporizadores de hábito activos
Preparar 'rev_suave'; Montar 'rev_suave' 'suave'
Revertir 'rev_suave' 'reversión suave con temporizadores activos' 'etapa3_reversion_suave.sql'
Correr 'reversión suave con temporizadores activos' 'rev_suave' "$tst\83_comprobar_reversion_suave.sql"
# repetir la suave (ya sin temporizadores activos): no debe fallar
Revertir 'rev_suave' 'reversión suave repetida' 'etapa3_reversion_suave.sql'
# cadena habitual: suave y luego dura
Revertir 'rev_suave' 'cadena suave y dura' 'etapa3_reversion_dura.sql'
Correr 'cadena suave y dura' 'rev_suave' "$tst\85_comprobar_cadena_suave_dura.sql"

# ---------- 3. Reversión DURA con temporizadores de hábito activos
Preparar 'rev_dura'; Montar 'rev_dura' 'dura'
Revertir 'rev_dura' 'reversión dura con temporizadores activos' 'etapa3_reversion_dura.sql'
Correr 'reversión dura con temporizadores activos' 'rev_dura' "$tst\84_comprobar_reversion_dura.sql"

# ---------- 4. Resumen
$Resultados | Export-Csv -NoTypeInformation -Encoding UTF8 -Path "$Work\resultados-reversion-temporizadores.csv"
$tot = $Resultados | Where-Object { $_.Estado -in 'PASS', 'FAIL', 'NOT RUN' }
"RESUMEN: PASS=$(($tot | Where-Object Estado -eq 'PASS').Count) FAIL=$(($tot | Where-Object Estado -eq 'FAIL').Count) NOT RUN=$(($tot | Where-Object Estado -eq 'NOT RUN').Count)"
$Resultados | Where-Object { $_.Estado -in 'FAIL', 'NOT RUN' } | ForEach-Object { "$($_.Estado) | $($_.Suite) | $($_.Id) | $($_.Detalle)" }
