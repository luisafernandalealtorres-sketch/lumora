# Fase 3: diseño técnico detallado (v1.11.1)

Fecha: 9 nov 2026. Corresponde a la especificación v1.11.1 (consolida la v1.11; la v1.11 se conserva sin cambios), a las aprobaciones P1 a P15 y a las decisiones técnicas T-1 a T-13, **salvo T-9, que sigue pendiente** (T-6, T-7b-1, T-7b-3 y T-8c aprobadas en v1.11). La v1.8 y la v1.9 se conservan sin cambios. La revisión correctiva v1.10 no modificó la lógica del SQL de aplicación. Aprobaciones (`docs/DECISIONES-FASE-3-v1.11.1.md`).
**Solo documentación.** Nada de lo descrito se ha ejecutado. El SQL está en `docs/MIGRACIONES-FASE-3-v1.11.md` y los escenarios de prueba en `docs/PRUEBAS-FASE-3-v1.11.md`.
Lo marcado **(T-n)** es una decisión técnica **aprobada el 9 nov (§12)**, salvo **T-9, que sigue pendiente**. Lo marcado **(P7)** incluye partes no aprobadas (T-9).

---

## 1. Alcance y estado

| Entregable | Estado |
|---|---|
| Esquema aditivo, relaciones, restricciones | Diseñado (P1 aprobado). SQL redactado y **validado en PostgreSQL 16 local desechable** (`docs/VALIDACION-LOCAL-FASE-3-v1.11.md`); **no ejecutado en Supabase**. La v1.9 añade T-7 y T-8b, **no revalidados** localmente (T-8b sí se validó como variante antes de incorporarse). La ejecución queda condicionada a la etapa 0 (roles y permisos) |
| Exclusividad del temporizador (`temporizador_activo`) | Diseñada (P2 aprobado) |
| Disparadores de historial | Diseñados (P4 aprobado) |
| Funciones RPC de Focus, descansos y hábitos | Diseñadas y redactadas |
| Reconciliación sin conexión (`operaciones_aplicar`) | **Solo diseño y escenarios.** Algoritmo definitivo y valores de reloj no aprobados (P7) |
| Obligaciones e indicadores | Diseño de dominio (P6, P12) |

## 2. Principios de diseño

1. **Aditivo y no destructivo.** Solo se agregan columnas, tablas, índices, funciones y disparadores. No se modifica, renombra ni elimina nada existente. Las columnas nuevas de tablas heredadas son nulables o con valor por defecto.
2. **Los módulos heredados no se tocan** y siguen funcionando con sus consultas e inserciones actuales (§14).
3. **Nada se borra.** Las cancelaciones, los reemplazos manuales, las operaciones rechazadas y los cambios de fecha dejan rastro.
4. **Garantías en la base de datos**, no solo en la interfaz: exclusividad, punto único, idempotencia, unicidad por ocurrencia.
5. **Mismo patrón de seguridad** que lo existente: RLS por `user_id` con `(select auth.uid())`. Excepciones justificadas en §5.
6. **Reversibles.** Cada etapa tiene reversión suave (desactivar, sin perder datos) y reversión dura (borrar, solo tras exportar).
7. **Zona horaria** America/Bogota para toda decisión de fecha local.

## 3. Mapa de relaciones

```
auth.users
  ├─< pendientes ──< cambios_registro (por registro_id, sin FK: el historial sobrevive al borrado)
  │        ▲
  │        └── focus_sesiones.pendiente_id (SET NULL)
  ├─< hitos ──────< cambios_registro
  ├─ preferencias_usuario (1:1)
  ├─ temporizador_activo (0..1 por usuario; ref_id apunta a UNA de:)
  │        ├── focus_sesiones
  │        ├── descansos
  │        └── habito_temporizadores
  ├─< focus_sesiones ──< descansos (sesion_origen_id, SET NULL)
  ├─< operaciones (diario: idempotencia, secuencias, conflictos)
  ├─< objetivos_atencion (semana, frente)
  └─< habitos_config ─┬─< habitos_config_versiones (vigencia hacia delante)
                      ├─< habito_temporizadores ─< habito_segmentos
                      └─< habito_tiempo ─< habito_tiempo_historial

Intactas: habitos, habito_registros (Salud), metas, frentes y el resto.
```

## 4. Catálogo de tablas

DDL completo en `docs/MIGRACIONES-FASE-3-v1.11.md`.

### 4.1 Columnas aditivas (etapa 1)
| Tabla | Columna | Detalle |
|---|---|---|
| `pendientes` | `prioridad` | `text NOT NULL DEFAULT 'media'`, `CHECK` en alta/media/baja (P5) |
| `pendientes` | `orden` | `integer` nulable |
| `pendientes` | `fijado_dia` | `date` nulable: «fijado manualmente» (D3-10) |
| `hitos` | `prioridad` | igual que en pendientes |
| `hitos` | `hecho_en` | `timestamptz` nulable, sellada por disparador |

### 4.2 Tablas nuevas
| Tabla | Propósito | Claves y restricciones destacadas |
|---|---|---|
| `cambios_registro` | Historial de `pendientes` e `hitos` | Solo lectura para el cliente; lo escribe el disparador `SECURITY DEFINER` (T-8b). Sin FK a los registros |
| `preferencias_usuario` | Preferencias de Focus | PK `user_id`; rangos con `CHECK`; sin fila = valores iniciales |
| `temporizador_activo` | Bloqueo global | **PK `user_id`**: una fila por usuario |
| `focus_sesiones` | Sesiones de Focus | `CHECK` de coherencia puntos/estado/fechas; índice único parcial de una sola sesión activa |
| `descansos` | Descansos y su decisión | `CHECK` de coherencia por estado |
| `operaciones` | Diario de operaciones | PK `(user_id, op_id)`; único `(user_id, dispositivo_id, seq)` |
| `objetivos_atencion` | Objetivos semanales | PK `(user_id, semana_inicio, frente_id)`; `semana_inicio` debe ser lunes; las semanas anteriores a la actual son inmutables por disparador (T-7) |
| `habitos_config` | Identidad del hábito nuevo | `modo_registro`, `archivado_desde` |
| `habitos_config_versiones` | Programación con vigencia | PK `(habito_id, vigente_desde)`; sin fecha de fin guardada: la versión rige hasta la siguiente |
| `habito_temporizadores` | Temporizadores de hábito | Estados y `CHECK` análogos a Focus |
| `habito_segmentos` | Tramos partidos por fecha local | Único `(temporizador_id, inicio)`; `acreditado`; `reemplazado_en` |
| `habito_tiempo` | Total vigente por ocurrencia | PK `(habito_id, fecha)`; `manual_s`, `temporizador_s`, `fuente` |
| `habito_tiempo_historial` | Historial sin borrado | Solo lectura; se escribe únicamente desde las funciones RPC |

Todo tiempo se guarda en **segundos enteros**. Los frentes de diseño se guardan como texto con `CHECK` en `tanku, ticketcode, personal, salud, familia, otros`; cambiar la lista exigiría una migración (el mapa de slugs sigue en `frentesMap.js`).

### 4.3 Relaciones y decisiones de integridad
- Sin FK de `cambios_registro` a `pendientes`/`hitos`: el historial debe sobrevivir al borrado del compromiso.
- `focus_sesiones.pendiente_id` y `descansos.sesion_origen_id`: `ON DELETE SET NULL`.
- `habito_*` hacia `habitos_config`: sin acción de borrado; los hábitos se **archivan**, nunca se borran.
- `habito_temporizadores` no depende de `focus_sesiones`: los registros siguen **independientes** (A5).
- `temporizador_activo.ref_id` no tiene FK (apunta a tres tablas posibles). La coherencia la garantizan las funciones RPC y el índice único parcial de `focus_sesiones`.

## 5. Seguridad

### 5.1 RLS y privilegios por tabla
| Tipo | Tablas | Política |
|---|---|---|
| CRUD del propietario (patrón `propios`) | `preferencias_usuario`, `objetivos_atencion` | `ALL`, `authenticated`, `(select auth.uid()) = user_id` |
| Lectura + actualización limitada | `habitos_config` (solo `nombre` y `modo_registro`) | `SELECT` y `UPDATE` con permisos por columna |
| Solo lectura (escritura por RPC) | `temporizador_activo`, `focus_sesiones`, `descansos`, `habitos_config_versiones`, `habito_temporizadores`, `habito_segmentos`, `habito_tiempo`, `habito_tiempo_historial` | `SELECT`; se revocan INSERT/UPDATE/DELETE a `authenticated` y `anon` |
| Solo lectura + marcar notificada | `operaciones` | `SELECT`; `UPDATE` solo de la columna `notificada` |
| Solo lectura (historial; escribe el disparador definer) | `cambios_registro` | `SELECT`; INSERT, UPDATE y DELETE revocados al cliente y sin política (T-8b). Con el SQL actual ese cliente responde **`permission denied`** (no «0 filas»). **Resuelto en v1.11 (T-8c):** `REVOKE ALL` y concesión explícita; sin `TRUNCATE`, `REFERENCES` ni `TRIGGER` para `anon` ni `authenticated` |

Las excepciones al patrón `propios` protegen la **integridad del historial y de la exclusividad**: un error de interfaz no puede borrar la fila de bloqueo ni reescribir el historial (T-1, T-8).

### 5.2 Funciones `SECURITY DEFINER` (T-1)
Las funciones RPC que escriben en tablas protegidas se definen con:
- `SECURITY DEFINER` y `SET search_path = ''` (todo calificado con `public.`).
- Identidad obtenida solo de `auth.uid()`; si es nula, se rechaza.
- **Comprobación de propiedad de cada identificador recibido** (sesión, pendiente, hábito, temporizador). Es obligatorio: una función definer omite RLS y un identificador ajeno pasaría la clave foránea.
- `REVOKE EXECUTE` de `PUBLIC` y `anon`; `GRANT EXECUTE` a `authenticated`.
- Las funciones auxiliares internas (`_uid`, `_prefs`, `_journal`…) no son ejecutables por `authenticated`.

Alternativa descartada (T-1 aprobado): funciones `SECURITY INVOKER` con políticas de escritura. Es más simple, pero permitiría que el cliente borre la fila de bloqueo directamente.

**Condición de ejecución (T-1):** antes de ejecutar cualquier etapa en Supabase se verifica, solo con lectura, que el rol propietario omita RLS, que `authenticated` y `anon` no lo hagan, la pertenencia de roles, los privilegios por defecto y la definición de `auth.uid()` (etapa 0 de `docs/MIGRACIONES-FASE-3-v1.11.md`). Si un criterio falla no se ejecuta nada. Posible aviso del asesor de seguridad de Supabase por funciones definer ejecutables por `authenticated`: esperado, aún no verificado.

### 5.3 Autenticación y middleware
No se modifican. La sincronización va del navegador a Supabase con el cliente existente, igual que los módulos actuales.

## 6. Disparadores

### 6.1 `registrar_cambios` (P4)
Disparador `AFTER INSERT OR UPDATE OR DELETE`, por fila, sobre `pendientes` e `hitos`. **Función `SECURITY DEFINER` (T-8b)** con `search_path` vacío y sin permiso de ejecución para el cliente: escribe en `cambios_registro` con permisos del propietario y solo con el `user_id` de la fila modificada. El cliente no tiene política ni permiso de `INSERT`, `UPDATE` ni `DELETE` sobre el historial. **Dependencia del propietario (v1.10):** la función escribe con los privilegios de **su propietario**, que debe ser el propietario de `cambios_registro` y conservar `INSERT`; además la tabla **no** debe tener RLS forzado (el propietario omite RLS por serlo, o por `BYPASSRLS`). Si falla cualquiera de estas condiciones, las escrituras de los módulos heredados fallarían dentro del disparador. Lo comprueban la etapa 0 (criterios 3 y 11), la verificación 1.V y los controles negativos TD-05 a TD-08 de `docs/MATRIZ-PRUEBAS-T7-T8B-FASE-3-v1.11.md`.
- **INSERT:** una fila `creado` con la instantánea completa (`contexto`).
- **UPDATE:** una fila `actualizado` por cada campo seguido que cambie. Pendientes: `hecho`, `hecho_en`, `fecha_limite`, `prioridad`. Hitos: `hecho`, `hecho_en`, `fecha`, `prioridad`.
- **DELETE:** una fila `eliminado` con la instantánea. También se dispara en borrados en cascada (borrar una meta borra sus hitos).
- **Sin usuario autenticado** (`auth.uid()` nulo: operaciones del panel, de servicio o borrado de usuario) la función no registra. Así el borrado de un usuario no falla por la clave foránea (T-8).
- Los cambios hechos por el panel de Supabase o con la clave de servicio **no quedan en el historial**. Se declara como límite.

### 6.2 `hitos_sellar_hecho_en`
`BEFORE INSERT OR UPDATE` sobre `hitos`: al marcar `hecho` informa `hecho_en = now()` si estaba vacío; al desmarcar lo vacía (igual que hace hoy `Pendientes.js` con los pendientes). El historial conserva el valor anterior.

### 6.3 Orden
El disparador `BEFORE` sella `hecho_en` antes de que el `AFTER` registre el cambio, así el historial incluye la fecha real.

### 6.4 `objetivos_semana_cerrada` (T-7)
`BEFORE INSERT OR UPDATE OR DELETE` sobre `objetivos_atencion`, por fila, `SECURITY INVOKER`:
- Calcula el lunes de la semana actual en America/Bogota.
- Rechaza con `semana_cerrada` insertar, modificar o borrar filas cuya `semana_inicio` sea anterior a ese lunes, y mover una fila hacia una semana anterior. La semana en curso y las futuras se pueden editar.
- **No actúa sin usuario autenticado** (mantenimiento, borrado del usuario por cascada), igual que `registrar_cambios`, para no impedir el borrado de un usuario.
- Corre antes que `objetivos_tocar` (orden alfabético de los disparadores `BEFORE`).
- **Disparador nuevo, sin validación local todavía.**
- **`auth.uid()` NULL (v1.10, análisis):** sin identidad el disparador no actúa. Eso ocurre en el contexto administrativo (editor SQL, migraciones), `service_role`, `anon`, identidades sin `sub` y el servicio de autenticación. Para `anon` y para identidades sin `sub` **no hay hueco**, porque RLS exige `auth.uid() = user_id` y con NULL esa condición niega. Solo los roles que omiten RLS (administrativo y `service_role`) pueden modificar semanas cerradas: es intencional.
- **Resuelto en v1.11 (T-7b-1 y T-7b-3):** `objetivos_semana_cerrada` no actúa cuando `pg_trigger_depth() > 1` (la excepción vale para cualquier disparador anidado) y el lunes se calcula con `lunes_semana_bogota(instante)`. Antes era un riesgo: una sesión que conserve la identidad del usuario y le borre la cuenta (por ejemplo una futura función «borrar mi cuenta» definer) hace que la cascada borre filas de semanas pasadas **con identidad no nula** y falle con `semana_cerrada`. Opciones T-7b-1 a T-7b-4 en `docs/MATRIZ-PRUEBAS-T7-T8B-FASE-3-v1.11.md` §2.7. **La lógica no se modificó.**
- **Sentencias masivas:** `UPDATE` o `DELETE` sin filtro que incluyan semanas pasadas fallan por completo (atómico); el cliente debe filtrar `semana_inicio >= lunes actual`.

## 7. Funciones RPC

Todas reciben `p_op_id` (generado en el dispositivo), `p_dispositivo_id` y `p_seq`, y registran la operación en `operaciones`. Una repetición con el mismo `p_op_id` devuelve el resultado anterior sin repetir efectos. Un reintento **simultáneo** espera: `_op_existente` toma un bloqueo consultivo por `(usuario, op_id)`. El registro manual y el cierre de tramo toman además un bloqueo por `(hábito, fecha)` para que el historial registre el valor anterior real (validación local, CT-04 y CT-07).

| Función | Efecto | Errores |
|---|---|---|
| `focus_iniciar` | Toma el bloqueo, crea la sesión con la duración de las preferencias. Registra la omisión implícita del descanso largo (P9) | `temporizador_ocupado`, `pendiente_invalido`, `parametro_invalido` |
| `focus_pausar` / `focus_reanudar` | Acumula el tramo; ajusta el bloqueo. Repetir sobre el mismo estado se registra como `fusionada` | `sesion_no_encontrada`, `transicion_invalida` |
| `focus_completar` | Calcula el tiempo efectivo. `completada` con 1 punto si alcanza la duración (con tolerancia, T-2); si no, `parcial` sin punto. Libera el bloqueo | `sesion_no_encontrada` |
| `focus_cancelar` | Estado `cancelada`, sin puntos. Libera el bloqueo (P3) | `sesion_no_encontrada` |
| `descanso_iniciar` / `_pausar` / `_reanudar` / `_completar` | Igual que Focus. Ocupa el bloqueo | `temporizador_ocupado`, … |
| `descanso_omitir` | Registra la decisión de omitir (corto o largo) | `parametro_invalido` |
| `descanso_cancelar` | Cierra el descanso como `omitido` (motivo `cancelado`). Libera el bloqueo | … |
| `habito_crear` / `habito_programar` / `habito_archivar` | Alta de hábito (idempotente por `op_id`), nueva versión de programación (solo desde hoy en adelante), archivado | `fecha_no_permitida`, `version_existente`, `parametro_invalido` |
| `habito_timer_iniciar` / `_pausar` / `_reanudar` / `_finalizar` / `_cancelar` | Temporizador de hábito. Al pausar o finalizar parte el tramo por fecha local y acumula (§8.3) | `temporizador_ocupado`, … |
| `habito_registrar_manual` | Reemplaza el total vigente de la ocurrencia. Conserva historial y marca los segmentos como reemplazados | `sin_ocurrencia`, `fecha_no_permitida` |
| `operaciones_aplicar` | **No incluida:** reconciliación sin conexión, a la espera de T-9 y del algoritmo aprobado (§10) | — |

**Excepciones y rollback (v1.9).** Cuando una función RPC lanza una excepción, PostgreSQL revierte **toda la transacción**: no queda efecto alguno ni fila en `operaciones`. Es el comportamiento correcto para el modo en línea (el cliente ve el error), pero no para el modo sin conexión, donde nada puede descartarse en silencio. La etapa 4 deberá procesar cada operación dentro de una subtransacción con captura de excepción y registrar las operaciones rechazadas (`rechazada` o `conflicto`) con su motivo.

## 8. Máquinas de estado

### 8.1 Sesión de Focus
```
(inicio) ──iniciar──▶ en_curso ◀──reanudar── pausada
                         │ pausar ─────────────▲
                         ├─ completar ─▶ completada (1 punto)   si tiempo ≥ objetivo − tolerancia
                         ├─ completar ─▶ parcial    (0 puntos)  si no
                         └─ cancelar  ─▶ cancelada  (0 puntos)
   También se puede completar o cancelar desde pausada.
   Estados finales: definitivos. Bloqueo: ocupado en en_curso y pausada; libre en finales.
```
Tiempo efectivo = `acumulado_s` + (ahora − `tramo_inicio`) si está corriendo. La hora de referencia es la del servidor.

### 8.2 Descanso
`en_curso ↔ pausado → completado`, o `omitido` (por decisión, por inicio de Focus o por cancelación). Mientras está `en_curso` o `pausado` ocupa el bloqueo (D3-18).

### 8.3 Temporizador de hábito
`en_curso ↔ pausado → finalizado`, o `cancelado`. Cada vez que se cierra un tramo (pausa o finalización) se parte en **segmentos por día local** de America/Bogota:
- Cada segmento guarda su fecha, inicio, fin y segundos.
- `acreditado` es verdadero solo si ese día tiene ocurrencia programada (P8).
- Los segmentos acreditados suman a `habito_tiempo.temporizador_s` y generan una fila de historial.
- Cancelar descarta únicamente el tramo en curso; lo ya cerrado queda (T-3).

### 8.4 Contador de ciclos (P9)
No se guarda. Es el número de sesiones `completada` con `finalizado_en` posterior al último descanso `largo` en estado `completado` u `omitido`.
- Parciales y canceladas no cuentan.
- Cambiar de día no lo reinicia.
- Al iniciar un Focus con el contador en N o más y sin descanso largo resuelto, se inserta un descanso largo `omitido` con motivo `inicio_focus`, y el contador vuelve a 0.
- Omitir el descanso corto no afecta al contador.
- Si en el cuarto ciclo la sugerencia larga reemplaza a la corta está pendiente (T-12).

### 8.5 Un registro manual de hábito (B2, D3-15b)
```
total vigente = coalesce(manual_s, 0) + temporizador_s
registro manual X   →  manual_s = X, temporizador_s = 0, fuente = manual
                       (segmentos anteriores de esa fecha: reemplazado_en = ahora)
segmento posterior  →  temporizador_s += segundos, fuente = temporizador
cada cambio         →  una fila en habito_tiempo_historial (valor anterior, nuevo, fuente, dispositivo, op_id)
```

## 9. Obligaciones e indicadores (dominio, P6 y P12)

Se implementan como funciones puras en `lib/domain` alimentadas por consultas simples.

### 9.1 Línea de tiempo de un compromiso
Se reconstruye desde `cambios_registro`: instantánea de creación y cambios de `fecha_limite` (o `fecha`), `hecho`, `hecho_en` y `prioridad`.

### 9.2 Evaluación (obligación)
- Cada **fecha límite efectiva** `d`, vigente durante un intervalo `[t_k, t_k+1)`, define una evaluación. Todas pertenecen al **mismo compromiso**.
- `d` **llega** al terminar el día `d` en America/Bogota (`A(d)` = 00:00 del día siguiente). «Vence hoy» sigue abierto; «vencido» empieza al día siguiente.
- Si la fecha se cambia **antes** de `A(d)`, esa fecha no genera evaluación.
- Si se cambia **después** de `A(d)`, la evaluación existe y su resultado queda congelado en ese instante.
- **Resultado:** `cumplida` si el compromiso se completó dentro del intervalo vigente (`a tiempo` si antes de `A(d)`, `tardía` si después, con su fecha y hora reales); `incumplida` si llegó `A(d)` sin completarse en ese intervalo; `abierta` mientras no llegue.
- Un cumplimiento tardío se atribuye al **período de la fecha `d`**.
- Si el compromiso ya estaba completado cuando se le asignó la fecha, el cumplimiento cuenta desde ese instante.

Ejemplo (P6): vence el lunes (`d1`) y no se completa; el martes se reprograma al viernes (`d2`). Evaluación 1: `incumplida`, período del lunes, congelada el martes. Evaluación 2 (`d2`): se completa el jueves, `cumplida a tiempo`, período del viernes. Ambas con el mismo `registro_id`.

### 9.3 Peso y elegibilidad
- Peso 3, 2, 1 según la prioridad que tenía la obligación **en su fecha de vencimiento** (T-6). **Interpretación aprobada (T-6, v1.11):** la vigente al cierre del día de la fecha límite (00:00 de America/Bogota del día siguiente), reconstruida desde `cambios_registro`. Consecuencias en §9.6.
- Sin fecha: no hay evaluaciones (A2, D3-1).
- **Elegibilidad en períodos abiertos [v1.11.1, D3-25 — APROBADA]:** una obligación es elegible si `d ≤ hoy`. El estado `abierta` (vence hoy) se conserva hasta A(d), pero **en el indicador** suma su peso al denominador y no al numerador, marcada «provisional»; al cierre pasa a `incumplida` (o `cumplida_tardia`) con la prioridad vigente al cierre (T-6). Las fechas futuras no cuentan. Ver `docs/DECISION-D3-25-EXECUTION-VENCE-HOY.md`.
- **Filtro de frente (`?frente=`) [v1.11.1, D3-27 y D3-28 — APROBADAS]:** aplica solo a Balance; Execution y Wellbeing no se filtran porque compromisos y hábitos no tienen frente de diseño definido.
- `T` y `M` suman pesos de evaluaciones elegibles del período; `E = 0,6T + 0,4M` con las reglas de parcialidad aprobadas.
- Un período cerrado puede cambiar si se completa tarde un compromiso (aceptado).
- **Eliminar un compromiso (T-4, opción B):** las obligaciones cuya fecha de vencimiento ya llegó permanecen en Execution, con el peso, el frente y las fechas de la instantánea registrada en `cambios_registro`; las obligaciones futuras se descartan.
- **Desmarcar un cumplimiento (T-5, opción C):** se reevalúa el estado actual de la obligación vigente con el último estado de `hecho` dentro de su intervalo. Las obligaciones sustituidas por un aplazamiento (D3-22) conservan su historial y su resultado congelado: desmarcar no las reabre.
- El historial se conserva en ambos casos.

### 9.4 Balance
Con los objetivos de la semana (`objetivos_atencion`):
- Sin filas para la semana: «Sin objetivo»; se muestran los puntos aparte.
- Diario: objetivo ÷ 7. Semana cerrada: objetivo completo. Semana o mes en curso: prorrateo hasta hoy inclusive (D3-19a). Mes: suma de fracciones diarias; semanas parciales aportan solo sus días del mes.
- Puntos: `focus_sesiones.puntos` por `frente_id` y fecha de `finalizado_en` en America/Bogota.
- `B = 100·Σ[g·min(1, a/g)] / Σg`; frentes con objetivo 0 excluidos.

### 9.5 Wellbeing
- Ocurrencias derivadas por calendario: una por fecha desde `vigente_desde` de la versión aplicable, según frecuencia y días, sin pasar de `archivado_desde`.
- `W = 100·Σ min(realizado, objetivo) / Σ objetivo`; sin ocurrencias elegibles: «Sin datos»; ocurrencia sin tiempo: 0 real.
- El día en curso se incluye y se marca «día en curso» (D3-3).

### 9.6 T-6: prioridad vigente al cierre del día de vencimiento (**aprobada en v1.11**)

**Regla aprobada:** el peso de una obligación es el de la **última prioridad registrada antes de las 00:00 de America/Bogota del día siguiente a la fecha límite** (la vigente al cierre del día de vencimiento). Se reconstruye desde `cambios_registro` con `public.prioridad_en_cierre(tabla, registro_id, fecha_limite)`. Un cambio **exactamente** a las 00:00 Bogotá (05:00:00 UTC) del día siguiente cuenta como **posterior**. Respaldo documentado cuando no hay historial: instantánea de creación → instantánea de eliminación → prioridad actual de la fila → «media». **La fórmula de Execution no cambia.**

| # | Consecuencia | Efecto |
|---|---|---|
| 1 | Prioridad cambiada **antes** del cierre del día de vencimiento | Cuenta el último valor anterior al cierre (T6-01 a T6-03, T6-05a) |
| 2 | Prioridad cambiada **después** del cierre | **No cambia** el peso histórico de esa obligación (T6-04, T6-05b, T6-05c, T6-08) |
| 3 | Obligación **abierta** (la fecha aún no llega) | Peso provisional con la prioridad actual; puede cambiar hasta el cierre. Execution del día y de la semana en curso **fluctúa** |
| 4 | Aplazamiento (D3-22) | La obligación original **conserva** su peso; la nueva toma la prioridad vigente al cierre de **su** fecha |
| 5 | Cumplimiento tardío (D3-2) | Usa la prioridad al cierre de la fecha límite, no la del momento de completar |
| 6 | Desmarcar (T-5) | La obligación reevaluada conserva el mismo peso |
| 7 | Eliminar el compromiso (T-4) | Usa la instantánea de eliminación y el historial previo (T6-11) |
| 8 | Hitos | Igual, con su prioridad propia (T6-13) |
| 9 | Cambios sin identidad (administrador, `service_role`) | No quedan en el historial: se usa el último valor conocido; el peso puede ser incorrecto |
| 10 | Compromisos anteriores a la etapa 1 | El relleno inicial los registra con prioridad `media`: no hay prioridad histórica real |
| 11 | Reproducibilidad | Determinista porque el historial es inmutable para el cliente (T-8b) (T6-08) |
| 12 | Períodos cerrados | Estables frente a cambios de prioridad posteriores, **no** frente a completar tarde ni desmarcar |
| 13 | Zona horaria | El cierre es a las 00:00 Bogotá del día siguiente (UTC-5 todo el año) |

**Ejemplo numérico (validado, T6-17 y T6-18).** Dos compromisos del lunes: A (alta, 3) cumplido; B (media, 2) incumplido.
- Si B se baja a «baja» el lunes a las 23:00, su peso es 1: `T = 3 / (3 + 1) = 75 %`.
- Si B se baja a «baja» el martes, su peso sigue siendo 2: `T = 3 / (3 + 2) = 60 %`.

Las alternativas B a E analizadas en la v1.10 quedan descartadas por la aprobación de la alternativa A.
## 10. Cola sin conexión y reconciliación (P7)

### 10.1 Aprobado
- Cola persistente en IndexedDB, aislada por usuario, sin dependencia nueva.
- `op_id` único; secuencia por dispositivo; dependencias causales; detección de concurrencia.
- Conservación de operaciones rechazadas, fusionadas o conflictivas; resolución explícita; sin descartes silenciosos.
- Protección contra duplicidad de puntos y de registros de hábitos.

### 10.2 Estructura de la cola (cliente)
- Base `cola-<userId>` con almacén `operaciones` (clave `op_id`) y almacén `meta` (id del dispositivo, contador de secuencia).
- El contador se incrementa dentro de la misma transacción que guarda la operación.
- Cada operación guarda: `op_id`, `dispositivo_id`, `seq`, `depende_de` (última operación conocida sobre el mismo objetivo), `version_base` (versión del objetivo que vio el dispositivo), tipo, datos y la hora del dispositivo.
- Al volver la conexión, al recuperar el foco y de forma periódica mientras haya pendientes, se envían en orden.
- Si la sesión de autenticación caduca, la cola se conserva y se reanuda al iniciar sesión el mismo usuario. Un usuario distinto no ve ni recibe esa cola.

### 10.3 Orden de aplicación en el servidor (P7)
1. **Dependencias causales:** una operación se aplica solo cuando se han aplicado sus dependencias. Si falta una, queda `pendiente_dependencia`.
2. **Secuencia por dispositivo:** las operaciones de un mismo dispositivo se aplican en orden de `seq`.
3. **Concurrencia:** dos operaciones sobre el mismo objetivo de dispositivos distintos son concurrentes si ninguna depende de la otra, es decir, si la `version_base` de una es anterior a un cambio ya aplicado que no se deriva de ella. Se resuelven con reglas explícitas.
4. **Hora ajustada:** criterio auxiliar. Nunca reordena operaciones con dependencia causal entre sí.
5. **Sin resolución segura:** se conserva el conflicto, se aplica la política conservadora y se notifica.

### 10.4 Reglas por transición concurrente (propuesta, **no aprobada**)
| Concurrencia | Propuesta |
|---|---|
| Pausar ∥ pausar | Se fusionan |
| Pausar ∥ reanudar | Orden causal si existe. Si no, hora ajustada confiable. Si no es confiable, pausar (conservador) y se notifica |
| Pausar (A) ∥ completar (B) | Se aplican las pausas anteriores al completar según causalidad u hora ajustada confiable. Las posteriores se rechazan con registro |
| Completar ∥ completar | Gana una sola; la otra queda `duplicada`. Un único punto |
| Completar ∥ cancelar | Estado final definitivo. Gana la causalmente anterior; si no hay causalidad, la de hora ajustada confiable; si tampoco, la primera aplicada. La otra queda como `conflicto` y se notifica |
| Dos registros manuales de la misma ocurrencia | Vale el de causalidad o hora ajustada más tardía; el otro queda en historial como sustituido. Nunca se suman |
| Registro manual ∥ segmentos de temporizador | Los segmentos anteriores al manual quedan reemplazados; los posteriores se suman |

### 10.5 Hora ajustada (T-9: **pendiente**, no se implementan umbrales hasta la simulación)
- Se estimaría el desfase al sincronizar comparando la hora del dispositivo con la del servidor.
- Candidatos para la cota de desfase confiable: 30 s, 60 s, 120 s, 300 s. Candidatos para la tolerancia hacia el futuro: 5 s, 30 s, 120 s.
- Los valores propuestos antes (5 min y 2 min) **no están justificados**: una cota de 5 min iguala la duración de un descanso corto y no permitiría distinguir su orden. Se decidirán por simulación (`docs/PRUEBAS-FASE-3-v1.11.md` §13).

### 10.6 Notificación de conflictos
`operaciones` conserva `resultado`, `motivo` y `notificada`. La interfaz lista las no notificadas (rechazadas, fusionadas, conflictos) y el usuario las marca como vistas. Nada se descarta en silencio.

### 10.7 Límites
- Borrar los datos del navegador antes de sincronizar pierde lo pendiente (se advierte).
- No se inician temporizadores sin conexión. Los registros manuales de hábitos sí se encolan (D3-13).
- `operaciones_aplicar` queda diferida hasta resolver T-9 y aprobar el algoritmo. Debe capturar la excepción de cada operación y registrar las rechazadas (ver §7: las excepciones de RPC hacen rollback y no dejan fila).

## 11. Cambios previstos en la aplicación (no implementados)

| Módulo | Contenido |
|---|---|
| `lib/domain/temporizador.js` | Máquina de estados pura (Focus, descanso, hábito) |
| `lib/domain/ciclos.js` | Contador derivado y sugerencia de descanso |
| `lib/domain/obligaciones.js` | Línea de tiempo y evaluaciones (§9) |
| `lib/domain/execution.js`, `balance.js`, `wellbeing.js` | Fórmulas y estados «Sin datos», «Sin objetivo», «En curso» |
| `lib/domain/reconciliacion.js` | Puro, con los escenarios de §13 de las pruebas |
| `lib/cola/` | Cola IndexedDB y sincronización (cliente) |
| `components/shell/TemporizadorGlobal.js` | Montado en `AppShell`; barra superior en escritorio y franja sobre la barra inferior en móvil, desplazando el botón del asistente |
| `app/(app)/page.js` | Home con `Pendientes` heredado sin cambios, bloques secundarios de agenda, correos y resumen con estado honesto |
| `lib/domain/navegacion.js` | «Mi día» pasa a «Home» (y sus pruebas) |

Sincronización sin Realtime (D3-8): refresco al recuperar el foco y periódico mientras haya temporizador (intervalo candidato: 20 s).

## 12. Decisiones técnicas T-1 a T-13 (estado v1.9)

Aprobadas el 9 nov 2026 (`docs/DECISIONES-FASE-3-v1.11.1.md` §1.10). El análisis previo está en `docs/REVISION-DECISIONES-T-FASE-3-v1.11.md`.

| ID | Decisión | Estado |
|---|---|---|
| T-1 | `SECURITY DEFINER` con todas las salvaguardas; ejecución en Supabase condicionada a verificar roles y permisos (etapa 0) | **Aprobada** |
| T-2 | Tolerancia de 2 s para «completada» frente a «parcial» | **Aprobada** |
| T-3 | Cancelar un temporizador de hábito descarta solo el segmento en curso | **Aprobada** |
| T-4 | Las obligaciones cuya fecha ya llegó permanecen en Execution; las futuras se descartan (opción B) | **Aprobada** |
| T-5 | Desmarcar reevalúa la obligación vigente; las sustituidas por aplazamientos conservan su historial (opción C) | **Aprobada** |
| T-6 | Prioridad que tenía la obligación en su fecha de vencimiento | **Aprobada (v1.11)**: vigente al cierre del día de vencimiento en America/Bogota |
| T-7 | Objetivos de semanas anteriores inmutables (disparador en la etapa 3) | **Aprobada** (lógica sin cambios en la v1.10) |
| T-7b | `auth.uid()` NULL y borrado de usuario en cascada con identidad | **T-7b-1 y T-7b-3 aprobadas (v1.11)** |
| T-8 / T-8b | Historial de solo lectura para el cliente (definer, sin `INSERT`) | **Aprobada** |
| T-8c | Retirar `TRUNCATE`, `REFERENCES` y `TRIGGER` residuales al cliente en las tablas de solo lectura | **Aprobada (v1.11)** |
| T-9 | Parámetros y algoritmo de reloj (P7) | **PENDIENTE**: no se implementan umbrales hasta la simulación |
| T-10 | Avisos y sonido activados por defecto, informando cuando el navegador no los permita | **Aprobada** |
| T-11 | Validación local | Ejecutada antes; no implicó aprobar el SQL |
| T-12 | Tras cuatro ciclos completos, el descanso largo tiene prioridad sobre el corto | **Aprobada** |
| T-13 | `modo_registro` principal; manual siempre disponible, rechazado sin ocurrencia | **Aprobada** |
| Req. | `habito_crear` idempotente con `p_op_id`, `p_dispositivo_id` y `p_seq` | **Aprobada** |

---
## 13. Riesgos

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | El SQL está validado solo en PostgreSQL local, no en Supabase | Pruebas con `ROLLBACK` en Supabase (P13, con autorización) antes de ejecutar |
| R2 | Una función `SECURITY DEFINER` que no comprueba propiedad expone datos ajenos | Comprobación obligatoria en cada identificador y prueba de aislamiento entre usuarios |
| R3 | Los disparadores no capturan cambios hechos con la clave de servicio | Declarado; ninguna app usa esa clave hoy |
| R4 | Dos llamadas simultáneas con el mismo `op_id` producían un `temporizador_ocupado` aparente | **Resuelto** con el bloqueo consultivo por `(usuario, op_id)`; validado en CT-04 y CT-09 |
| R5 | Reloj del dispositivo desajustado altera el orden sin conexión | Orden causal primero (P7); valores de reloj sin aprobar |
| R6 | Pérdida de la cola si se borran los datos del navegador | Advertencia en la interfaz; límite documentado |
| R7 | Sin interfaz de fechas ni prioridad, Execution queda en «Sin datos» | Esperado hasta la 3.4 |
| R8 | Dependencia del tipo `text` para los frentes de diseño | Constante en código más `CHECK`; cambios futuros requieren migración |
| R9 | Un `ALTER TABLE` bloquea brevemente la tabla | Con 0 filas es instantáneo; la columna con valor por defecto constante no reescribe la tabla |
| R10 | Cambiar «Mi día» por «Home» rompe pruebas del shell | Actualizar `navegacion.test.mjs` y `busqueda.test.mjs` en 3.1 |
| R11 | El historial de `pendientes` crece con cada cambio | Volumen personal; sin purga automática; índice por registro |
| R12 | Desmarcar o eliminar un compromiso cambia retroactivamente un período | Resuelto por T-4 (las obligaciones llegadas permanecen) y T-5 (reevaluación acotada a la obligación vigente) |
| R13 | El disparador de T-7 podría impedir el borrado de un usuario por cascada | No actúa sin usuario autenticado. **Sin validación local todavía** |
| R14 | Una excepción de RPC hace rollback y no deja fila en `operaciones` | La etapa 4 debe capturarla por operación y registrar la rechazada |
| R15 | Los cambios T-7 y T-8b de la v1.9 no se han revalidado | Revalidar en local antes de cualquier ejecución (requiere autorización) |
| R16 | Las funciones definer dependen de que el rol propietario omita RLS | Etapa 0 de verificación previa en Supabase; si falla, no se ejecuta |
| R17 | El disparador definer del historial depende del propietario de la función, de su privilegio `INSERT` y de que no haya RLS forzado | Etapa 0 (criterios 3 y 11), verificación 1.V y controles TD-05 a TD-08 |
| R18 | El borrado de un usuario con la identidad del propio usuario fallaba por T-7 | **Cerrado** (T-7b-1; T7-61 y T7-62) |
| R19 | Privilegios residuales `TRUNCATE`, `REFERENCES` y `TRIGGER` para el cliente | **Cerrado** (T-8c; ACL-01 a ACL-05) |
| R20 | La interpretación de T-6 cambia los resultados históricos según la alternativa elegida | Confirmación del usuario (§9.6) |
| R21 | El criterio de `auth.uid()` de la etapa 0 se comprobaba por la definición | Rediseñado: comprobación de comportamiento (0.9); límite: simula los claims |

## 14. Compatibilidad con módulos heredados (lista de comprobación)

| Operación heredada | Efecto del diseño | Resultado esperado |
|---|---|---|
| `pendientes` insert `{texto, frente, meta_id}` | `prioridad` toma `'media'`; el disparador registra `creado` | Funciona igual |
| `pendientes` update `{hecho, hecho_en}` | Se registran los cambios | Funciona igual |
| `pendientes` delete | Se registra `eliminado` con instantánea | Funciona igual |
| `hitos` insert `{meta_id, titulo}` | `prioridad` `'media'`; `hecho_en` nulo | Funciona igual |
| `hitos` update `{hecho}` | El disparador sella `hecho_en`; se registra | Funciona igual, con `hecho_en` nuevo |
| `metas` delete (cascada a hitos) | Se registran los hitos eliminados | Funciona igual |
| Salud: `habitos` insert y `habito_registros` upsert/delete | Tablas **no modificadas** | Idéntico |
| Panel: `pendientes` `select('frente,hecho,hecho_en')` | Sin cambios | Idéntico |
| `select('*')` de pendientes e hitos | Devuelve columnas extra | Los módulos las ignoran |
| Mi día (`/`) | Home incorpora `Pendientes` sin modificarlo | Sin pérdida |
