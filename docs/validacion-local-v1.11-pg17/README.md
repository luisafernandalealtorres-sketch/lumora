# Validación local de la Fase 3 (v1.11) en PostgreSQL 17.11

Reproduce el entorno **real** observado en la etapa 0 (proyecto de Supabase, PostgreSQL 17.11) en un clúster **local y desechable**. **No se conecta a Supabase** ni usa credenciales.

Diferencias respecto de `docs/validacion-local-v1.11` (PostgreSQL 16):

| Archivo | Cambio |
|---|---|
| `00_roles.sql` | `postgres` es propietario **no superusuario** con `bypassrls` y las pertenencias reales (anon, authenticated, authenticator, service_role, supabase_privileged_role, pg_*). El superusuario del clúster es `supabase_admin` |
| `01a_auth_extensiones_real.sql` | Esquema `auth` de `supabase_admin`, `auth.uid()` real (propietario `supabase_auth_admin`), extensiones pgcrypto, uuid-ossp y pg_stat_statements, y privilegios por defecto reales. Incluye `USAGE` de `supabase_auth_admin` en `auth` (las claves foráneas hacia `auth.users` las comprueba su propietario) |
| `01_fixture.sql` | Sin la parte de `auth`; el esquema `public` conserva su propietario por defecto (`pg_database_owner`) |
| `96_pg17_privilegios.sql` | **Nuevo.** MAINTAIN, privilegios exactos de tabla y de columna, EXECUTE de funciones, SECURITY DEFINER y disparadores |
| `ejecutar_validacion.ps1` | Administrador `supabase_admin`, propietario `postgres`; ejecuta también la suite 96 (dos veces: base principal y tercera aplicación) |
| resto de `.sql` y `95_concurrencia.ps1` | `sb_owner` se sustituye por `postgres` |

## Cómo ejecutarla
1. Binarios de PostgreSQL 17.11 (por ejemplo, los oficiales `postgresql-17.11-1-windows-x64-binaries.zip`; no hace falta instalarlos).
2. Clúster nuevo, en `127.0.0.1` y un puerto alternativo, con el superusuario `supabase_admin` y mensajes en inglés (las pruebas buscan texto en inglés):
   `initdb -D <carpeta> -U supabase_admin --auth=trust -E UTF8` y
   `pg_ctl -D <carpeta> -o "-p 54341 -c listen_addresses=127.0.0.1 -c shared_preload_libraries=pg_stat_statements -c lc_messages=C" start`.
3. `powershell -File ejecutar_validacion.ps1 -Bin <bin de PostgreSQL 17> -Port 54341 -Work <carpeta temporal> -Repo <raíz del repositorio>`.
4. Deja `resultados.csv` en la carpeta de trabajo. Al terminar: `pg_ctl stop -m fast` y borrar la carpeta.

## Pruebas de reversión con temporizadores activos (etapa 3)

`ejecutar_validacion.ps1` prueba las reversiones **sin** temporizadores activos. Estas pruebas cubren el caso que dejaba un bloqueo huérfano en `temporizador_activo` y bloqueaba Focus. Valen para **PostgreSQL 16.15 y 17.11** (el fixture reproduce el entorno real y funciona en ambas versiones):

| Archivo | Qué hace |
|---|---|
| `81_ayudantes_reversion.sql` | Ayudantes (`zz.hab`, `zz.privs_etapa2`, tabla `zz.antes`) |
| `82_semilla_reversion_temporizadores.sql` | u1: hábito en curso (600 s) y un objetivo; u3: hábito pausado (300 s); u2: Focus en curso; u4: descanso en curso |
| `83_comprobar_reversion_suave.sql` | Tras la suave: bloqueos de hábito limpiados, tiempo acreditado y conservado, datos conservados, Focus y descansos intactos, Focus iniciable, privilegios de edición revocados y lectura conservada |
| `84_comprobar_reversion_dura.sql` | Tras la dura: sin bloqueos huérfanos, tablas y funciones eliminadas, Focus y descansos intactos, Focus iniciable |
| `85_comprobar_cadena_suave_dura.sql` | Cadena habitual: suave y luego dura |
| `ejecutar_reversion_temporizadores.ps1` | Ejecutor (mismo modo de uso que `ejecutar_validacion.ps1`; deja `resultados-reversion-temporizadores.csv`) |

Uso: igual que arriba, con `powershell -File ejecutar_reversion_temporizadores.ps1 -Bin <bin de PostgreSQL> -Port 54341 -Work <carpeta temporal> -Repo <raíz del repositorio>`.

- `resultados-reversion-temporizadores-pg16.15.csv`: corrida en 16.15 (61 PASS, 0 FAIL). **La corrida en 17.11 está pendiente.**
- Contra las reversiones antiguas (antes de la corrección) estas mismas pruebas dan 19 FAIL: detectan el defecto.
- Comportamiento esperado y pérdida de datos de cada reversión: `docs/MIGRACIONES-FASE-3-v1.11.md`, §3.S, §3.D y §3.R.

`resultados.csv` es la corrida final en 17.11 (497 PASS, 0 FAIL, 2 NOT RUN). `resultados-pg16-recorrida-con-correccion.csv` es la corrida de `validacion-local-v1.11` en 16.15 con el SQL ya corregido (404 PASS, 0 FAIL, 2 NOT RUN).
