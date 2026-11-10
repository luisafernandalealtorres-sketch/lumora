# Fase 3: informe de validación local del SQL (v1.11)

Fecha: 9 nov 2026. Base: `docs/MIGRACIONES-FASE-3-v1.11.md` y `docs/sql/v1.11/`. Resultados por ID: `docs/validacion-local-v1.11/resultados.csv`. La v1.8, la v1.9 y la v1.10 se conservan sin cambios.

> **No se ejecutó nada en Supabase.** No se usaron credenciales, variables de entorno ni datos del proyecto. Toda la validación corrió en un PostgreSQL 16 **desechable**, en un puerto alternativo y con una réplica estructural de las tablas heredadas. Aprobada la validación, **no** queda autorizada ninguna ejecución en Supabase.

## 1. Resultado global

| Estado | Cantidad |
|---|---|
| **PASS** | **404** |
| **FAIL** | **0** |
| **NOT RUN** | **2** (T7-42, T7-59; justificadas en §7) |
| INFO (entorno y conteos) | 19 |

La corrida final se hizo **desde cero** (clúster limpio, roles, plantilla, etapas 1 a 3, todas las suites, reversiones y reaplicación). Criterios de aceptación de la tarea: ninguna prueba obligatoria falla; la reversión suave conserva los datos; la reversión dura no deja objetos; los módulos heredados siguen escribiendo; el cliente no escribe directamente en tablas de solo lectura; la cascada autorizada de borrado no se bloquea; una semana pasada no se modifica con una operación directa del cliente; el resultado histórico de T-6 no cambia por cambios posteriores. **Todos se cumplen** con lo observado (§4 a §6).

## 2. Entorno (registro)

| Elemento | Valor |
|---|---|
| Versión | PostgreSQL 16.15, compiled by Visual C++ build 1944, 64-bit (binarios del equipo, **clúster nuevo**) |
| Puerto | **54331** (no el 5432 del servicio habitual, que no se tocó; el ejecutor aborta si se le pasa 5432) |
| Escucha | `127.0.0.1` solamente (`-c listen_addresses=127.0.0.1`) |
| Datos | Carpeta temporal de la sesión, creada con `initdb` y borrada al final |
| Autenticación | `trust` solo en local (clúster desechable); sin contraseñas ni credenciales de Supabase |
| Conexiones | `max_connections = 100`; zona `log_timezone = America/Bogota` |
| Bases | `fixture` (plantilla), `main`, `rev_suave`, `rev_dura` |
| Roles emulados | `anon`, `authenticated`, `service_role`, `sb_owner` (propietario con BYPASSRLS, miembro de los otros), `sb_other` |
| `auth.uid()` | Función de prueba que lee `request.jwt.claims` (emula PostgREST) |
| Esquema heredado | Réplica estructural (`01_fixture.sql`) |

Comandos (reproducibles; ver `docs/validacion-local-v1.11/README` y el ejecutor):

```bash
initdb -D <carpeta> -U postgres --auth=trust -E UTF8
pg_ctl -D <carpeta> -o "-p 54331 -c listen_addresses=127.0.0.1" start
powershell -File docs/validacion-local-v1.11/ejecutar_validacion.ps1 -Bin <bin> -Port 54331 -Work <temporal> -Repo <repo>
pg_ctl -D <carpeta> stop -m fast   # y borrar la carpeta
```

## 3. Resultados por suite

| Suite | Script | Resultado |
|---|---|---|
| Plantilla (roles y esquema heredado) | `00_roles.sql`, `01_fixture.sql` | 2/2 PASS |
| Aplicación de etapas 1, 2 y 3 sobre la base limpia | `etapaN_aplicar.sql` | 3/3 PASS |
| Etapa 1 (columnas, historial, T-6 base) | `20_pruebas_etapa1.sql` | 19/19 PASS |
| Etapa 2 (preferencias, temporizador, Focus, descansos, `operaciones`) | `30_pruebas_etapa2.sql` | 54/54 PASS |
| Etapa 3 (objetivos, hábitos, T-7) | `40_pruebas_etapa3.sql` | 37/37 PASS |
| Regresión de módulos heredados | `50_regresion_heredada.sql` | 10/10 PASS |
| Seguridad adicional | `60_seguridad_extra.sql` | 5/5 PASS |
| Historial de prioridad | `70_*`, `71_*` | 3/3 PASS |
| **T-6** prioridad al cierre | `90_t6_prioridad_cierre.sql` | **21/21 PASS** |
| **T-7 / T-7b-1** objetivos semanales | `91_t7_objetivos.sql` | **50 PASS + 2 NOT RUN** |
| **T-8b / T-8c** privilegios | `92_t8_privilegios.sql` | **33/33 PASS** |
| **T-7b-3** frontera del lunes (comparación con JavaScript) | `93_*` | 1/1 PASS |
| Controles negativos del disparador definer | `94_controles_negativos_td.sql` | 8/8 PASS |
| Concurrencia (dos conexiones `psql` independientes) | `95_concurrencia.ps1` | **11/11 PASS** |
| Reversión suave (datos conservados) | `80_*`, `81_*` | 19/19 PASS |
| Reversión dura (orden inverso, esquema idéntico) | ejecutor | 9/9 PASS |
| Reaplicación desde cero (2.ª y 3.ª aplicación) y repetibilidad | ejecutor | 3 + 3 + 2 + 19 + 54 + 37 PASS |

## 4. Resultados de las decisiones nuevas

### 4.1 T-6 (prioridad vigente al cierre del día de vencimiento)

Corte: 00:00 America/Bogota del día siguiente. T6-01 (antes del vencimiento, cuenta), T6-02 (durante, cuenta), T6-03 (23:00 Bogotá, cuenta), T6-04 (día siguiente, no cuenta), T6-05a/b/c (04:59:59.999 UTC cuenta; 05:00:00 UTC y 05:00:00.001 UTC no cuentan), T6-06 (varios cambios), T6-07 (mismo instante, gana el último por `seq`), T6-08 (reproducible: lecturas iguales, un cambio posterior no altera el resultado histórico), T6-09 a T6-12 (respaldos: creación, fila actual, eliminación, «media»), T6-13 (hitos), T6-14 (aislamiento entre usuarios), T6-15 (parámetros inválidos), T6-16 (bisiesto y cambio de año), **T6-17 = 75 %** y **T6-18 = 60 %** (ejemplos de `DISENO-TECNICO` §9.6). **Todos PASS.** La fórmula de Execution no se modificó.

### 4.2 T-7 y T-7b-1 (objetivos y disparadores anidados)

Cubiertos INSERT, UPDATE, DELETE y UPSERT sobre semanas pasada, actual y futura (T7-01 a T7-17), atomicidad de operaciones masivas (T7-20 a T7-23b), contexto sin identidad, `service_role`, `anon`, identidad rota y otro usuario (T7-50 a T7-58), y la cascada de borrado de usuario:

- **T7-60** administrador (`auth.uid()` NULL): la cascada funciona.
- **T7-61** conservando la identidad del propio usuario: **la cascada funciona** (antes fallaba con `semana_cerrada`).
- **T7-62** con la identidad de otro usuario: la cascada funciona.
- **T7-63** profundidad observada: 1 en borrado directo; 2 en cascada.
- **T7-66/T7-66b** el usuario autenticado **no** puede borrar directamente semanas pasadas y la fila sigue existiendo.
- **T7-67 (límite documentado):** la excepción por `pg_trigger_depth() > 1` vale para **cualquier** disparador anidado; un disparador ajeno que borre filas de semanas pasadas no es bloqueado. Está documentado en `DISENO-TECNICO` §6.4 y `MIGRACIONES` etapa 3.
- **T7-65** `TRUNCATE` por el cliente: 42501. **T7-64** `TRUNCATE` por el propietario: permitido (no dispara disparadores de fila; vía administrativa).

### 4.3 T-7b-3 (lunes con función de instante)

`lunes_semana_bogota(instante)`: **T7-40** (19 fronteras: domingo 23:59:59.999, lunes 00:00, lunes 04:59:59.999 UTC, lunes 05:00:00 UTC, bisiestos, cambio de año), **T7-41** (17 520 instantes horarios de 2026 y 2027: siempre lunes, entre 0 y 6 días atrás), **T7-43** (el disparador usa la función con `now()`), **T7-44** (79 234 instantes entre 2019 y 2029 comparados con `inicioSemana` de `web/lib/domain/fechas.js`: **0 diferencias**).

### 4.4 T-8c (higiene de privilegios)

**ACL-01** (`aclexplode`: `authenticated` solo tiene lo esperado y `anon` nada en las 13 tablas nuevas), **ACL-02** (`has_table_privilege`: sin `TRUNCATE`, `REFERENCES` ni `TRIGGER` para `anon` ni `authenticated`), **ACL-03** (columnas: solo `habitos_config.modo_registro`, `habitos_config.nombre` y `operaciones.notificada`, UPDATE), **ACL-04** (`service_role` no se modificó), **ACL-05** (las tablas heredadas no se tocaron). Más el conjunto H-12 (SELECT propio y aislado; INSERT, UPDATE y DELETE directos = 42501) y TD-01 a TD-10: el disparador definer sigue escribiendo, las funciones RPC `SECURITY DEFINER` siguen funcionando con los privilegios del propietario y los módulos heredados siguen escribiendo. Controles negativos TD-05 (propietario sin `INSERT`), TD-06 (propietario distinto) y TD-07 (RLS forzado sin BYPASSRLS) **fallan como se espera (42501)**, y TD-05b, TD-06b, TD-08 y TD-08b restauran el funcionamiento.

## 5. Concurrencia

Dos conexiones `psql` independientes, con la primera manteniendo la transacción abierta (3 s) y la segunda lanzada 1 s después:

| ID | Resultado |
|---|---|
| CT-01 | Dos Focus simultáneos, A confirma: B espera (≥ 1,5 s) y recibe `temporizador_ocupado`; 1 sesión y 1 bloqueo. PASS |
| CT-02 | A revierte: B inicia (espera ≈ 2,2 s); 1 sesión y 1 bloqueo. PASS |
| CT-03 | Completar la misma sesión desde dos conexiones: 1 punto, 1 aplicada, 1 duplicada, bloqueo liberado. PASS |
| CT-04 | Mismo `op_id` en simultáneo: ambas reciben la misma sesión; 1 sesión y 1 operación. PASS |
| CT-05 | Pausar (A) y completar (B): estado final «completada», 1 punto, 1800 s. PASS |
| CT-06 | Focus (A) y temporizador de hábito (B): exclusividad entre tablas. PASS |
| CT-07 | Dos registros manuales simultáneos: historial `null→1000 ; 1000→2000`, vigente 2000. PASS |
| CT-08 | Cerrar tramo (A) y registro manual (B): `null→600(temporizador) ; 600→1500(manual)`. PASS |
| CT-09 | `habito_crear` con el mismo `op_id`: 1 hábito, 1 versión, 1 operación. PASS |
| CT-10 | T-7 bajo concurrencia: el borrado de la semana pasada sigue rechazado mientras otra conexión inserta la actual. PASS |
| CT-11 | Dos upserts de preferencias: una sola fila, gana el último confirmado (45). PASS |

## 6. Reversión, comparación de esquemas y repetibilidad

- **Reversión suave** (desactivación sin pérdida): R-01 datos conservados (conteos idénticos antes/después: historial, sesiones, operaciones, objetivos, hábitos); R-01a/R-01b las RPC quedan denegadas (42501); regresión heredada posterior L-01 a L-09 PASS (L-04/L-05 esperado: sin el disparador de `hecho_en`).
- **Reversión dura** en orden inverso (etapa 3, 2, 1): **R-02** esquema `pg_dump -s` **idéntico** al inicial; **R-02b** objetos residuales 0/0/0 (tablas o secuencias ajenas, funciones, disparadores); **R-02c** columnas aditivas de `pendientes` e `hitos` eliminadas.
- **Reaplicación desde cero** (R-04) y segunda reversión dura (**R-05**, esquema idéntico): repetible. Las suites de las tres etapas pasan de nuevo tras la reaplicación.

## 7. Qué no se validó (NOT RUN) y por qué

- **T7-42** cambio de semana en tiempo real: no se manipula el reloj del sistema. Las fronteras se cubren con T7-40, T7-41 y la comparación con JavaScript (T7-44).
- **T7-59** alteración de claims desde la API: PostgREST no expone `set_config` y ninguna función de la Fase 3 altera los claims (revisión de código).
- Fuera de alcance por instrucción: etapa 4 (`operaciones_aplicar`), **T-9** (reconciliación sin conexión y umbrales de reloj), comportamiento real de PostgREST/JWT y roles reales de Supabase (requieren la etapa 0 y autorización).

## 8. Defectos encontrados y corregidos

Los defectos 1 a 6 fueron de las **pruebas** y del ejecutor; el 7 fue de la reversión dura del SQL (detectado al redactarla). Todos corregidos y verificados con una corrida completa desde cero:

| # | Defecto | Corrección |
|---|---|---|
| 1 | El script de concurrencia sobrescribía la variable `$h` del ejecutor (argumentos de conexión), dejando `psql` colgado | Variable renombrada a `$hh` |
| 2 | El ejecutor no borraba las bases de corridas anteriores antes de eliminar los roles; fallaba al recrear roles | Se eliminan `main`, `rev_suave`, `rev_dura` y `fixture` (`with (force)`) antes de los roles |
| 3 | ACL-04 usaba una variable `record` sin asignar | Variable entera |
| 4 | TD-10 comparaba el texto del arreglo, que escapa las comillas | Comparación con `= any(cfg)` |
| 5 | T7-44: el CSV llevaba BOM y JavaScript recibía fechas `NaN` | El comparador elimina el BOM |
| 6 | TD-05: el control negativo no fallaba porque `sb_owner` hereda `INSERT` de `service_role` (miembro con herencia) | Se retira `INSERT` también a `service_role` durante el control y se restaura (riesgo registrado como R-H) |
| 7 | (v1.11 SQL) La reversión dura de la etapa 3 eliminaba la función del disparador antes de la tabla que lo posee | Orden corregido: primero la tabla, luego las funciones (R-02 lo confirma) |

## 9. Trazabilidad de decisiones

| Decisión | Archivo y sección | SQL / función | Prueba | Resultado observado |
|---|---|---|---|---|
| **T-6** | `DISENO-TECNICO` §9.6; `ESPECIFICACION` §5.2 | `public.prioridad_en_cierre` (etapa 1) | T6-01 a T6-18 | 21/21 PASS (75 % y 60 %) |
| **T-7b-1** | `DISENO-TECNICO` §6.4; `MATRIZ-PRUEBAS-T7-T8B` | `objetivos_semana_cerrada` con `pg_trigger_depth() > 1` | T7-60 a T7-63, T7-66, T7-67, CT-10 | PASS; límite documentado en T7-67 |
| **T-7b-3** | `DISENO-TECNICO` §6.4 | `public.lunes_semana_bogota(timestamptz)` | T7-40, T7-41, T7-43, T7-44 | PASS; 79 234 instantes, 0 diferencias con JavaScript |
| **T-8c** | `DISENO-TECNICO` §5.1 | `revoke all` + `grant` explícitos (etapas 1 a 3) | ACL-01 a ACL-05, H-12, TD-01 a TD-10, controles TD-05 a TD-08 | 33/33 (ACL, H-12, TD) + 8/8 (controles) PASS |
| T-9 | `DECISIONES` pendiente 7 | No implementado | — | **Pendiente** (no se resolvió por inferencia) |

## 10. Aislamiento y destrucción del entorno

El clúster desechable escuchó solo en `127.0.0.1:54331`, no usó el servicio `postgresql-x64-16` ni el puerto 5432, ni credenciales ni variables de Supabase. Al terminar se detiene el servidor y se borra su carpeta de datos (ver el informe final de la tarea para la confirmación). Los scripts se conservan en `docs/validacion-local-v1.11/` y el SQL extraído en `docs/sql/v1.11/`.
