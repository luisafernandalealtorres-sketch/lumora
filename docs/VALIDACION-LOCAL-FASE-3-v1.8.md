# Fase 3: validación del SQL en PostgreSQL local desechable (v1.8)

Fecha: 9 nov 2026. Valida `docs/MIGRACIONES-FASE-3-v1.8.md` (etapas 1 a 3, reversiones).

> **Alcance y límites de lo ejecutado**
> - Todo se ejecutó en un PostgreSQL 16.15 **local, desechable y aislado**, en una carpeta temporal, puerto 54329, sin red hacia Supabase.
> - **No hubo conexión a Supabase, ni credenciales, ni datos reales.** Los datos son sintéticos y creados por las pruebas.
> - No se ejecutó ninguna migración real, no se modificó el código de la aplicación, ni la configuración, autenticación, middleware o tareas programadas. No se hizo commit ni se inició la 3.1.
> - Se usó el PostgreSQL ya instalado en el equipo **solo como binarios**; no se tocó su carpeta `data` ni se instaló nada. El clúster de prueba y sus bases se eliminaron al terminar.
> - **Esto demuestra que el SQL es correcto en PostgreSQL 16 con un entorno que imita a Supabase. No demuestra que funcione igual en Supabase** (§7).

---

## 1. Entorno de prueba

| Elemento | Detalle |
|---|---|
| Motor | PostgreSQL 16.15 (Windows), clúster nuevo con `initdb` |
| Aislamiento | Carpeta temporal de la sesión; `listen_addresses=127.0.0.1`; puerto 54329 |
| Roles | `anon`, `authenticated`, `service_role` (sin inicio de sesión) y `sb_owner`, con `BYPASSRLS` y sin ser superusuario, para imitar al rol propietario de Supabase |
| `auth.uid()` | Función propia que lee `request.jwt.claims` / `request.jwt.claim.sub`, como Supabase |
| Privilegios por defecto | `ALTER DEFAULT PRIVILEGES` que otorgan todo a `anon`, `authenticated` y `service_role` en `public`, como Supabase |
| Esquema heredado | Réplica **estructural** (sin datos) de las tablas `frentes`, `metas`, `pendientes`, `hitos`, `habitos` y `habito_registros`, con sus restricciones, índices y políticas `propios`, tomada de la auditoría 3.0. Las otras 13 tablas heredadas no se replicaron (no interactúan con la Fase 3) |
| Usuarios | Tres usuarios sintéticos en una tabla `auth.users` simulada |
| Tiempo | Los escenarios sensibles al reloj manipulan `tramo_inicio` como propietario o llaman a `_cerrar_tramo` con un instante fijo, porque `now()` es constante dentro de una transacción |

## 2. Cómo se probó

- Se extrajeron los bloques `sql` del documento con un script y se aplicaron **tal cual** en bases creadas desde la plantilla del esquema heredado.
- Cada prueba corre como el rol `authenticated` con una identidad simulada, salvo las que preparan datos o fuerzan estados, que corren como propietario.
- Para concurrencia se usaron **dos procesos `psql` independientes** con transacciones abiertas durante 3 segundos y una segunda conexión que llega 1 segundo después.

## 3. Resultados de las tres etapas

| Grupo | Comprobaciones | Resultado |
|---|---:|---|
| Etapa 1 (historial, prioridad, `hecho_en`, aislamiento) | 16 | 16 verdes |
| Etapa 2 (exclusividad, estados, puntos, ciclos, idempotencia, seguridad) | 54 | 54 verdes |
| Etapa 3 (hábitos, segmentos, manual, objetivos, `habito_crear`, seguridad) | 37 | 37 verdes |
| Regresión de módulos heredados | 10 | 10 verdes |
| Seguridad adicional | 5 | 5 verdes |
| **Total SQL** | **122** | **122 verdes** |
| Variante T-8b | 3 | verdes (con el resultado esperado de «permiso denegado») |

Los tres bloques se aplicaron sin errores de sintaxis ni de ejecución en la primera ejecución. Las correcciones de §6 se hicieron tras las pruebas de concurrencia y la revisión de seguridad.

### 3.1 Cobertura por tema

| Tema | Casos |
|---|---|
| Exclusividad del temporizador (Focus, descanso, hábito, pausado) | T-01 a T-12, T-04b, W-17, C-10 |
| Estados, tiempo y puntos | S-01 a S-14 (incluye la frontera de tolerancia de 2 s) |
| Ciclos y descansos | C-01 a C-12 |
| Historial y disparadores | H-01 a H-17 |
| Idempotencia | I-01 a I-09, K-04 |
| Hábitos, medianoche, manual y vigencia | W-01 a W-17, K-01 a K-04 |
| Objetivos semanales | O-01 a O-04 |
| Seguridad y aislamiento | X-01 a X-12, X-08b |
| Regresión de módulos heredados | L-01 a L-10 |

### 3.2 Ejemplos confirmados
- **D3-23:** viernes programado y sábado no, con un temporizador de 23:30 a 00:30: 1800 s acreditados el viernes; el segmento del sábado (1800 s) se conserva con `acreditado = false` y no genera `habito_tiempo` (W-03).
- **Dos medianoches:** 7200, 86400 y 3600 s en tres fechas (W-05).
- **Manual y temporizador:** el manual reemplaza lo acumulado; un temporizador posterior acumula encima (1200 + 600 = 1800), con historial completo (W-06, W-07).
- **P9:** iniciar un Focus con 4 ciclos y sin decidir registra el descanso largo omitido (motivo `inicio_focus`) y reinicia el contador (C-05).
- **Cancelar:** la sesión cancelada se conserva sin puntos y libera el bloqueo (S-04, T-08).

## 4. Resultados de las pruebas de concurrencia (dos conexiones)

La conexión A mantiene su transacción abierta 3 s; la conexión B llega a 1 s. «B esperó» mide cuánto tardó B en responder: ≈2,2 s indica que B quedó bloqueada hasta el commit de A.

| ID | Escenario | Resultado | B esperó |
|---|---|---|---:|
| CT-01 | Dos Focus simultáneos, A confirma | B recibe `temporizador_ocupado`; 1 sesión, 1 bloqueo | 2,2 s |
| CT-02 | Dos Focus simultáneos, A revierte | B inicia con éxito; 1 sesión, 1 bloqueo | 2,2 s |
| CT-03 | Completar la misma sesión desde dos conexiones (op distintos) | **1 punto**; una `aplicada` y una `duplicada`; bloqueo liberado | 2,2 s |
| CT-04 | Mismo `op_id` en simultáneo | **Corregido:** B recibe la misma sesión; 1 sesión y 1 operación. *Antes:* B recibía un `temporizador_ocupado` falso | 2,2 s |
| CT-05 | Pausar (A) y completar (B) | Estado final `completada`, 1 punto, 1800 s, bloqueo liberado | 2,2 s |
| CT-06 | Focus (A) y temporizador de hábito (B): exclusividad entre tablas | B recibe `temporizador_ocupado`; 1 Focus, 0 temporizadores de hábito, 1 bloqueo | 2,2 s |
| CT-07 | Dos registros manuales de la misma ocurrencia | **Corregido:** historial `null→1000` y `1000→2000`; vigente 2000. *Antes:* `null→1000` y `null→2000` | 2,2 s |
| CT-08 | Cerrar un tramo (A) y registro manual (B) de la misma ocurrencia | Historial `null→600 (temporizador)` y `600→1500 (manual)` | 2,2 s |
| CT-09 | `habito_crear` con el mismo `op_id` en simultáneo | 1 hábito, 1 versión, 1 operación; ambas conexiones reciben el mismo identificador | 2,2 s |

**Lo que no se pudo probar:** carreras de microsegundos (la validación con retardos de segundos prueba el comportamiento de bloqueo, no todas las intercalaciones posibles), ni carga sostenida.

## 5. Reversiones

| ID | Prueba | Resultado |
|---|---|---|
| R-01 | Reversión **suave** de las tres etapas con datos sintéticos (historial, sesión, operaciones, hábito, pendientes) | Los conteos antes y después son idénticos: 2/1/3/1/2. **Sin pérdida de datos** |
| R-01b | RPC tras la reversión suave | `focus_iniciar` y `habito_crear` devuelven permiso denegado (42501) |
| R-01c | Módulos heredados tras la reversión suave | Siguen funcionando (L-01 a L-03, L-06, L-07, L-09). L-04/05 falla por diseño: sin disparador, el hito marcado no recibe `hecho_en` |
| R-02 | Reversión **dura** de las tres etapas, en orden inverso | Sin errores. El esquema resultante es **idéntico** al original (la única diferencia es un identificador aleatorio de `pg_dump`) |
| R-03 | Revertir solo la etapa 2 con la etapa 3 aplicada | Falla y la transacción se revierte sin borrar nada, porque el disparador `objetivos_tocar` depende de `_tocar_actualizado_en`. El impedimento es incidental: las funciones PL/pgSQL no registran dependencias de las funciones que llaman |
| R-04 | Reaplicar las tres etapas tras revertir | Sin errores |
| BF | Relleno inicial con filas existentes (3 pendientes, 1 hito hecho) | 3 + 1 filas `creado`; las 3 filas existentes quedan con prioridad `media`; el hito ya hecho conserva `hecho_en` nulo (no se retrocalcula) |

## 6. Errores encontrados y correcciones

### 6.1 Defectos reales del SQL (corregidos en `docs/MIGRACIONES-FASE-3-v1.8.md`)

| # | Defecto | Cómo se detectó | Corrección | Reverificado |
|---|---|---|---|---|
| E-1 | **Carrera en el registro manual.** Dos escrituras simultáneas de la misma ocurrencia dejaban el historial con `null→2000` en lugar de `1000→2000` | CT-07 | Bloqueo consultivo por `(hábito, fecha)` en `habito_registrar_manual` y en `_cerrar_tramo` | CT-07, CT-08 |
| E-2 | **Reintento simultáneo con el mismo `op_id`.** La segunda llamada recibía un `temporizador_ocupado` falso en vez del resultado almacenado | CT-04 | `_op_existente` pasa de `STABLE` a volátil y toma un bloqueo consultivo por `(usuario, op_id)`: el reintento espera y relee | CT-04, CT-09 |
| E-3 | **`habito_crear` no era idempotente.** | Requisito tuyo | Nueva firma con `p_op_id`, `p_dispositivo_id` y `p_seq`; se registra la operación; la repetición devuelve el hábito. `operaciones` admite `habito_crear` y `habito_config` | K-04, CT-09 |
| E-4 | **Funciones de disparador ejecutables por `anon` y `authenticated`** (por los privilegios por defecto). No son invocables (PostgreSQL lo impide) pero quedaban expuestas | Prueba X-05b | `REVOKE EXECUTE` de `PUBLIC`, `anon` y `authenticated` en las tres funciones de disparador. Se comprobó que los disparadores siguen funcionando | X-05b y las 16 pruebas de la etapa 1 |

### 6.2 Correcciones de la documentación de pruebas
| # | Observación | Estado |
|---|---|---|
| D-1 | `PRUEBAS-FASE-3-v1.8.md` H-12 decía «Rechazado» para `update`/`delete` sobre el historial. En realidad **afectan 0 filas sin dar error** (la política RLS filtra todo) | Corregido en ese documento |
| D-2 | R-03 se describía como «falla por dependencias». Cierto, pero solo por el disparador de la etapa 3 | Aclarado en este informe |

### 6.3 Errores de mis propios scripts de prueba (no del SQL)
Para transparencia: una cadena esperada mal escrita (W-01), un segundo temporizador activo creado a propósito en la misma prueba (violaba la restricción de un temporizador activo, que es la que se quería proteger), un día de la semana que coincidía con un literal (W-11a) y un orden de filas dentro de una misma transacción (W-07). Se corrigieron los scripts; el SQL no cambió por ellos.

### 6.4 Hallazgos que **no** se corrigieron en el SQL (quedan como decisiones)
- **T-8b:** el cliente puede insertar filas en su propio historial. Hay una variante validada (disparador `SECURITY DEFINER` y sin `INSERT` para el cliente).
- **T-7:** el disparador de objetivos de semanas cerradas no está en el SQL.
- **T-13:** una excepción de RPC revierte la transacción y no deja fila en `operaciones`; la etapa 4 deberá registrar los rechazos.
- **Hito ya hecho al aplicar la etapa 1:** `hecho_en` queda nulo (no hay dato de cuándo se completó).

## 7. Riesgos técnicos pendientes (lo que esta validación no demuestra)

| # | Riesgo | Cómo se cerraría |
|---|---|---|
| RP-1 | Supabase puede diferir del entorno local: atributos del rol propietario, `auth.uid()` real, PostgREST y su caché de esquema, versión de PostgreSQL | P13: pruebas con transacciones `ROLLBACK` en Supabase, **con tu autorización**; antes, una consulta de solo lectura a `pg_roles` |
| RP-2 | El asesor de seguridad de Supabase puede avisar de funciones `SECURITY DEFINER` ejecutables por `authenticated` en el esquema expuesto | Aceptar y documentar, o evaluar un esquema privado con funciones envoltorio |
| RP-3 | La reconciliación sin conexión (etapa 4) no está implementada ni validada | T-9 y simulación |
| RP-4 | Las funciones de dominio (obligaciones, indicadores) y la cola de IndexedDB no están implementadas ni probadas | Subfases 3.2 y 3.3 con `node:test` |
| RP-5 | Rendimiento con volumen (el diario `operaciones` y el historial crecen sin purga) | Medir cuando haya datos; definir retención si hace falta |
| RP-6 | Las 13 tablas heredadas no replicadas | Sin interacción con la Fase 3; se comprobaría en la regresión real |
| RP-7 | Conexiones por *pooler* de transacciones: los bloqueos consultivos de transacción son seguros en ese modo, pero no se probó con el pooler de Supabase | Prueba en Supabase |
| RP-8 | Zona horaria: `AT TIME ZONE 'America/Bogota'` exige la base de zonas horarias del servidor | Comprobar en Supabase |
| RP-9 | Una RPC que falla no deja registro en `operaciones` | Etapa 4 |

## 8. Archivos de la validación

Los scripts quedaron en `docs/validacion-local/` (SQL, extractor y arnés de concurrencia) para repetir la validación. Son material de prueba, no código de la aplicación. Su `README.md` explica cómo repetirlos. Los datos y bases se eliminaron.

## 9. Limpieza

Al terminar se detuvo el servidor local y se eliminó el clúster de prueba y sus bases. No queda ningún proceso, servicio ni puerto abierto, y la instalación de PostgreSQL existente no se modificó.
