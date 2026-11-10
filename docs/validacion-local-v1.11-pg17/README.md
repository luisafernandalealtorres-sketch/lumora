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

`resultados.csv` es la corrida final en 17.11 (497 PASS, 0 FAIL, 2 NOT RUN). `resultados-pg16-recorrida-con-correccion.csv` es la corrida de `validacion-local-v1.11` en 16.15 con el SQL ya corregido (404 PASS, 0 FAIL, 2 NOT RUN).
