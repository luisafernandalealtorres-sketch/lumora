# Fase 3 v1.11: validación local en PostgreSQL 17.11 y comparación con 16

Fecha: 10 nov 2026. Complementa `docs/VALIDACION-LOCAL-FASE-3-v1.11.md` (PostgreSQL 16). **No se ejecutó nada en Supabase** en esta validación: todo es un clúster local desechable (`127.0.0.1:54341`, PostgreSQL **17.11**, binarios oficiales de EDB) y una réplica en 16.15 (`127.0.0.1:54331`). Archivos en `docs/validacion-local-v1.11-pg17/`.

## 1. Resultado

| Entorno | PASS | FAIL | NOT RUN |
|---|---|---|---|
| PostgreSQL 16.15, SQL original (documentado antes) | 404 | 0 | 2 |
| PostgreSQL 17.11, SQL original, con el fixture ya fiel al entorno real | 487 | **10** | 2 |
| PostgreSQL 16.15, SQL **corregido** | **404** | 0 | 2 |
| PostgreSQL 17.11, SQL **corregido** | **497** | **0** | 2 |

Los 2 NOT RUN son los mismos de siempre y están justificados en el propio caso: T7-59 (no alcanzable desde la API) y T7-42 (no se manipula el reloj; las fronteras se cubren con T7-40, T7-41 y T7-44).
Comparación caso por caso, 16 frente a 17: los **406 casos** de 16 tienen el **mismo estado** en 17 (0 diferencias). 17 añade 93: 46 de la suite nueva 96 en la base principal, 46 en la tercera aplicación y 1 de plantilla (el paso 01a).

## 2. Hallazgo real de PostgreSQL 17: `MAINTAIN` (corregido en local)

- **Qué pasa.** PostgreSQL 17 añade el privilegio `MAINTAIN` (VACUUM, ANALYZE, CLUSTER, REINDEX, REFRESH MATERIALIZED VIEW, LOCK TABLE). Los privilegios por defecto del esquema `public` de Supabase (`grant all on tables`) lo incluyen: en el entorno real las ACL ya muestran `arwdDxtm` (la `m` es MAINTAIN). En PostgreSQL 16 no existe.
- **Dónde fallaba.** `etapa2_aplicar.sql` (`preferencias_usuario`) y `etapa3_aplicar.sql` (`objetivos_atencion`) hacían `revoke truncate, references, trigger … from authenticated`. Eso **no quita `MAINTAIN`**: `authenticated` quedaba con `DELETE,INSERT,MAINTAIN,SELECT,UPDATE`. Lo detectaron `ACL-01` (T-8b, que pasaba en 16) y las pruebas nuevas P17-02, P17-03 y P17-04a.
- **Demostración (base desechable en 17).** Con la ACL anterior, `authenticated` pudo ejecutar `VACUUM` y `ANALYZE` sobre la tabla; con la corrección, `VACUUM` se rechaza (`permission denied to vacuum`). Ojo: `LOCK TABLE … ACCESS EXCLUSIVE` ya lo permite `UPDATE`/`DELETE` aunque no exista `MAINTAIN`, así que eso **no** cambia con la corrección.
- **Severidad.** Baja. PostgREST no expone esos comandos; solo sería explotable con SQL directo como `authenticated`. Aun así contradecía la intención declarada de la migración («sin privilegios residuales») y es defensa en profundidad.
- **Corrección** (neutra respecto de la versión; en 16 da el mismo resultado `arwd`):

```sql
revoke all on public.preferencias_usuario from authenticated;
grant select, insert, update, delete on public.preferencias_usuario to authenticated;
-- y lo mismo para public.objetivos_atencion
```

  Aplicada en `docs/sql/v1.11/etapa2_aplicar.sql`, `docs/sql/v1.11/etapa3_aplicar.sql` y `docs/MIGRACIONES-FASE-3-v1.11.md` (la fuente). Las reversiones no cambian: la reversión dura elimina las tablas.
- **No es un revoke de `MAINTAIN` directo** a propósito: `revoke maintain` no existe en 16 y rompería la validación allí.

## 3. Lo que NO era un fallo de la migración (ajustes del entorno local)

| Fallo inicial | Causa | Arreglo |
|---|---|---|
| «permiso denegado al esquema auth» (31 FAIL en la primera corrida) | Las claves foráneas hacia `auth.users` las comprueba el **propietario** de esa tabla (`supabase_auth_admin`), y mi réplica no le daba `USAGE` en `auth` | `01a_auth_extensiones_real.sql` concede `USAGE, CREATE` en `auth` a `supabase_auth_admin` |
| `T7-54/58` | La prueba busca el texto inglés `row-level security`; el clúster 17 emitía mensajes en español (locale de Windows) | `lc_messages = C` en el clúster. El de 16 ya los daba en inglés |

## 4. Condiciones del entorno real reproducidas

| Condición (etapa 0) | Cómo se reprodujo |
|---|---|
| `postgres`: no superusuario, `bypassrls`, `createrole`; propietario de las tablas heredadas | Rol `postgres` así; las migraciones se aplican **como `postgres`**, no como superusuario |
| **Herencia**: `postgres` es miembro de anon, authenticated, authenticator, service_role y `supabase_privileged_role`, pg_monitor, pg_read_all_data, pg_signal_backend, pg_create_subscription | `00_roles.sql`, tal cual la consulta 0.3. Los controles negativos TD-05 a TD-08 pasan con esta herencia real |
| `public` de `pg_database_owner`; `auth` de `supabase_admin`; `auth.uid()` de `supabase_auth_admin` | `01a` y `01_fixture.sql` (sin cambiar el propietario de `public`) |
| `auth.uid()` real (`coalesce(nullif(claim.sub,''), claims->>'sub')`) | Definición copiada de la consulta 0.7b |
| Privilegios por defecto `arwdDxtm` / `X` / `rwU` | `alter default privileges … grant all` para postgres y supabase_admin |
| Extensiones | pgcrypto, uuid-ossp y pg_stat_statements (con `shared_preload_libraries`) |
| Versión | 17.11 confirmada con `select version()` |

## 5. Cobertura de lo pedido

| # | Pedido | Resultado | Evidencia |
|---|---|---|---|
| 1 | Clúster 17.11 desechable | OK | `PostgreSQL 17.11 on x86_64-windows`, puerto 54341, solo 127.0.0.1 |
| 2 | Roles y herencia reales | OK | §4; TD-05 a TD-08 PASS |
| 3 | Extensiones y diferencias del entorno | OK, con salvedad | `supabase_vault` no es de contrib y no se reprodujo (ninguna etapa la usa) |
| 4 | Etapas 1, 2 y 3 | OK | `aplicada sin errores` en las 3 etapas, en base principal y en 3 aplicaciones |
| 5 | 404 pruebas + seguridad, concurrencia, reversión, reaplicación | OK | 404 casos originales con el mismo estado; concurrencia 11/11; reversión suave 19/19; dura 9/9; repetibilidad PASS |
| 6 | `MAINTAIN` en las ACL | **Hallazgo y corrección** | §2; P17-01 a P17-03 PASS tras la corrección |
| 7 | REVOKE/GRANT con los privilegios esperados | OK | P17-04 (13 tablas × anon y authenticated), P17-05 (columnas), P17-06 (22 RPC del cliente) |
| 8 | SECURITY DEFINER y disparadores | OK | P17-07 (27 funciones definer, todas con `search_path = ""` y propietario que omite RLS), P17-08 (6 disparadores habilitados) y las suites funcionales |
| 9 | Reversiones dejan el esquema idéntico | OK | R-02 y R-05: `pg_dump -s` con privilegios idéntico al inicial; R-02b 0/0/0; R-02c 0 columnas residuales; R-01 datos conservados (`2/1/3/1/2`) |

## 6. Comparativo PostgreSQL 16 y 17

| Aspecto | 16.15 | 17.11 |
|---|---|---|
| Privilegio `MAINTAIN` | No existe | Existe y entra en `grant all` |
| ACL de tablas por defecto | `arwdDxt` | `arwdDxtm` |
| `has_table_privilege(…, 'MAINTAIN')` | Error (tipo inválido) | Válido |
| Propietario de `public` en la réplica | `sb_owner` (alterado a mano) | `pg_database_owner` (como el real) |
| Superusuario del clúster | `postgres` | `supabase_admin` (como el real); `postgres` es un rol corriente |
| Mensajes del servidor | Inglés (por defecto de la máquina) | Español hasta fijar `lc_messages = C` |
| `shared_preload_libraries` | vacío | `pg_stat_statements` |
| Resultado con el SQL corregido | 404 PASS / 0 FAIL / 2 NOT RUN | 497 PASS / 0 FAIL / 2 NOT RUN |

## 7. Observaciones y riesgos que quedan

1. **Eventos DDL no verificados.** Supabase suele tener *event triggers* (p. ej. para recargar el caché de PostgREST tras un DDL). La etapa 0 consultó `pg_trigger`, que **no** incluye los de evento. No se reprodujeron aquí y podrían reaccionar a las migraciones. Se comprobaría con una consulta de solo lectura a `pg_event_trigger`, que necesitaría tu autorización aparte.
2. **Privilegios heredados amplios (ya existentes, fuera de la migración).** En el entorno real `anon` y `authenticated` tienen `arwdDxtm` (incluidos `TRUNCATE` y `MAINTAIN`) en `pendientes` e `hitos`, y la etapa 0 muestra el mismo patrón por defecto para todo `public`. Solo RLS y la forma de la API los contienen. La migración no los toca (decisión de v1.11). Merece una revisión propia, no ahora.
3. **Tablas heredadas reales.** El fixture replica las 6 que usa la migración; el real tiene 19 (agenda_hoy, gastos…). La migración no las toca, pero su ACL por defecto es la misma.
4. **PostgREST de extremo a extremo** sigue sin probarse (igual que en la etapa 0).
5. **Colación.** El clúster local usa `Spanish_Colombia.1252`; el real no se consultó. Las migraciones no dependen del orden alfabético.
6. **Forma de aplicar.** Cada etapa trae su propio `BEGIN;` y `COMMIT;` (la etapa 1: líneas 7 y 212) y ninguna usa `CREATE INDEX CONCURRENTLY`. Aquí se aplicaron con `psql -f` y `ON_ERROR_STOP`. Si en Supabase se aplicaran con una herramienta que ya envuelve el SQL en una transacción, el `COMMIT` interno confirmaría antes de tiempo y un fallo a mitad dejaría la etapa a medias. No se ha probado esa vía; habría que decidir cómo se aplicará antes de la etapa 1.

## 8. Recomendación

**Sí estamos listos para plantear la autorización de la etapa 1**, con estas condiciones previas, en este orden:

1. Que apruebes el cambio de SQL de §2 (afecta a las etapas 2 y 3, no a la 1) y que quede **versionado en un commit antes de aplicar nada**, para que lo aplicado sea exactamente lo validado.
2. Idealmente, la consulta de solo lectura a `pg_event_trigger` (§7.1) antes de la etapa 1, porque es el único aspecto del entorno real con DDL que no pudimos reproducir ni observar.
3. Decidir cómo se aplicará (§7.6) para que el `BEGIN;`/`COMMIT;` de cada etapa no choque con la herramienta.
4. Autorizar la etapa 1 sola, con reversión suave y dura preparadas y verificadas (lo están: R-01, R-02, R-05), y revisar su resultado antes de pedir la 2.

La etapa 1 es la de menor alcance: añade columnas e índices a `pendientes` e `hitos`, crea `cambios_registro` y tres disparadores con sus funciones. Hoy esas dos tablas tienen 0 filas, así que el `ALTER TABLE` no tiene qué reescribir. Su suite, la regresión heredada y las reversiones suave y dura pasan en 16 y en 17.
