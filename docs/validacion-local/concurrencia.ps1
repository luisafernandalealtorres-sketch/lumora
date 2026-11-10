$bin='C:\Program Files\PostgreSQL\16\bin'; $root='C:\Users\luisa\AppData\Local\Temp\claude\f2ce733abb43d3b1\a4799f8c-a67c-477e-be79-934b6dadce6c\scratchpad\pgtest'
$env:PGCLIENTENCODING='UTF8'
$u1='11111111-1111-1111-1111-111111111111'
$sid='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
$pre="select set_config('request.jwt.claims','{`"sub`":`"$u1`",`"role`":`"authenticated`"}', false); set role authenticated;"
$base=@('-h','127.0.0.1','-p','54329','-U','sb_owner','-d','full2','-q','-A','-t')
function Own($sql){ & "$bin\psql.exe" @base -c $sql 2>&1 | Out-String }
function Conc($name,$setup,$aSql,$bSql,$aEnd='commit',$delay=1000){
  Own "select zz.limpiar(); $setup" | Out-Null
  $fa="$root\sql\conc_a.sql"; $fb="$root\sql\conc_b.sql"
  Set-Content $fa "$pre`nbegin;`n$aSql`nselect pg_sleep(3);`n$aEnd;" -Encoding UTF8
  Set-Content $fb "$pre`n$bSql" -Encoding UTF8
  $pa=Start-Process "$bin\psql.exe" -ArgumentList ($base+@('-f',$fa)) -NoNewWindow -PassThru -RedirectStandardOutput "$root\a.out" -RedirectStandardError "$root\a.err"
  Start-Sleep -Milliseconds $delay
  $sw=[Diagnostics.Stopwatch]::StartNew()
  $pb=Start-Process "$bin\psql.exe" -ArgumentList ($base+@('-f',$fb)) -NoNewWindow -PassThru -RedirectStandardOutput "$root\b.out" -RedirectStandardError "$root\b.err"
  $pb.WaitForExit(); $sw.Stop(); $pa.WaitForExit()
  $clean={ param($f) ((Get-Content $f -ErrorAction SilentlyContinue) | Where-Object { $_ -notmatch '^\{"sub"' -and $_ -ne '' } | ForEach-Object { $_ -replace 'psql:[^ ]*conc_[ab]\.sql:\d+: ','' }) -join ' | ' }
  "### $name  (B esperÃ³ $([int]$sw.Elapsed.TotalMilliseconds) ms)"
  "A: " + (& $clean "$root\a.out") + (& $clean "$root\a.err")
  "B: " + (& $clean "$root\b.out") + (& $clean "$root\b.err")
}

