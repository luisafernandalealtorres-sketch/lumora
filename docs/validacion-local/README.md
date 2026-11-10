# Validación local del SQL de la Fase 3

Material de prueba (no es código de la aplicación). Reproduce la validación de `docs/VALIDACION-LOCAL-FASE-3-v1.8.md` en un PostgreSQL **local y desechable**. **No se conecta a Supabase ni usa credenciales o datos reales.**

## Requisitos
- Un PostgreSQL 16 local (solo binarios: `initdb`, `pg_ctl`, `psql`, `pg_dump`) y Node.js.
- Un clúster **nuevo y separado** (no uses una carpeta `data` existente), en un puerto libre (por ejemplo 54329), escuchando solo en 127.0.0.1.

## Orden
1. `00_roles.sql` como superusuario del clúster nuevo: crea roles que imitan a Supabase y la base `fixture`.
2. Conceder a `sb_owner` la pertenencia a `authenticated`, `anon` y `service_role` (en PostgreSQL 16 no es automática).
3. `01_fixture.sql` como `sb_owner` en `fixture`: réplica estructural del esquema heredado y simulación de `auth.uid()`.
4. `node extraer.mjs`: extrae los bloques SQL de `docs/MIGRACIONES-FASE-3-v1.8.md` (ajusta las rutas del script).
5. Crear una base desde la plantilla `fixture`, aplicar `e1_U`, `e2_U`, `e3_U` y `10_utilidades.sql`.
6. Ejecutar `20_` a `71_` como `sb_owner` con `psql -q -A -F ' | ' -t -f archivo`. Cada prueba imprime `caso | ok | detalle`.
7. `concurrencia.ps1` (PowerShell): arnés de dos conexiones. Ajusta `$bin`, `$root` y el nombre de la base.
8. Reversiones: `e3_S`, `e2_S`, `e1_S` (suaves) y `e3_D`, `e2_D`, `e1_D` (duras) sobre bases separadas.

## Notas
- Las rutas absolutas de los scripts apuntaban a la carpeta temporal de la sesión original; hay que ajustarlas.
- `72_variante_t8b.sql` aplica la variante T-8b (historial no insertable por el cliente) **solo en la base de prueba**.
- Al terminar: detener el servidor y borrar el clúster de prueba.
