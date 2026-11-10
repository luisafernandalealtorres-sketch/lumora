# Validación local de la Fase 3 (v1.11)

Pruebas reproducibles del SQL de `docs/sql/v1.11/` en un PostgreSQL 16 **desechable**. **No se conectan a Supabase** ni usan credenciales.

1. Crear un clúster nuevo en un puerto alternativo (no el 5432) escuchando solo en `127.0.0.1`:
   `initdb -D <carpeta> -U postgres --auth=trust -E UTF8` y `pg_ctl -D <carpeta> -o "-p 54331 -c listen_addresses=127.0.0.1" start`.
2. Ejecutar: `powershell -File ejecutar_validacion.ps1 -Bin <bin de PostgreSQL 16> -Port 54331 -Work <carpeta temporal> -Repo <raíz del repositorio>`.
3. El ejecutor deja `resultados.csv` (PASS / FAIL / NOT RUN por ID) en la carpeta de trabajo.
4. Al terminar: `pg_ctl -D <carpeta> stop -m fast` y borrar la carpeta.

Requiere Node para `93_comparar_con_js.mjs` (solo lee `web/lib/domain/fechas.js`). `resultados.csv` de esta carpeta es el de la corrida final documentada en `docs/VALIDACION-LOCAL-FASE-3-v1.11.md`.
