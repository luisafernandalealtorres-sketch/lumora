# Fase 3: revisión detallada de las decisiones técnicas T-1 a T-13 (v1.10)

Fecha: 9 nov 2026. Base: `docs/DECISIONES-FASE-3-v1.10.md` §2, `docs/DISENO-TECNICO-FASE-3-v1.10.md` §12 y los resultados de `docs/VALIDACION-LOCAL-FASE-3-v1.10.md`.

> **Estado v1.10:** el 9 nov 2026 el usuario **aprobó T-1 a T-13, salvo T-9** (pendiente hasta realizar la simulación del reloj). En la revisión correctiva v1.10 la **interpretación de T-6 volvió a quedar pendiente de su confirmación**, y se añadieron las propuestas **T-7b** y **T-8c** (§6). Este documento conserva el análisis previo a la aprobación (la v1.8 está intacta); la columna «Estado» ya está actualizada. Registro oficial: `docs/DECISIONES-FASE-3-v1.10.md` §1.10. Aprobar no equivale a ejecutar: nada se ha ejecutado en Supabase.
> La evidencia citada (pruebas T-xx, S-xx, CT-xx…) proviene de la validación en PostgreSQL local desechable. **No se ha ejecutado nada en Supabase.**

---

## 1. Matriz resumen

| ID | Tema | Recomendación | Estado | Bloquea |
|---|---|---|---|---|
| T-1 | Escrituras solo por RPC `SECURITY DEFINER` endurecido | Aprobar, con las salvaguardas de §3 | **Aprobada (v1.9)** | Etapas 2 y 3 |
| T-2 | Tolerancia de 2 s para «completada» frente a «parcial» | Aprobar | **Aprobada (v1.9)** | Etapa 2 |
| T-3 | Cancelar un temporizador de hábito descarta solo el tramo en curso | Aprobar | **Aprobada (v1.9)** | Etapa 3 |
| T-4 | Eliminar un compromiso con obligaciones ya incumplidas | Opción B: las obligaciones llegadas se conservan | **Aprobada (v1.9)** | Subfase 3.3 |
| T-5 | Desmarcar un cumplimiento ya atribuido | Reevaluar con el estado vigente; congelar las obligaciones reemplazadas | **Aprobada (v1.9)** | Subfase 3.3 |
| T-6 | Prioridad usada en una obligación | La vigente cuando llega la fecha | **Regla aprobada; interpretación PENDIENTE (v1.10)** | Subfase 3.3 |
| T-7 | Objetivos de semanas cerradas inmutables | Aprobar y agregar el disparador | **Aprobada (v1.9)** | Etapa 3 |
| T-8 | `cambios_registro` solo lectura e inserción; sin registro sin usuario | Aprobar | **Aprobada (v1.9)** | Etapa 1 |
| T-9 | Parámetros y algoritmo de reloj (P7) | Decidir tras la simulación | Pendiente | Etapa 4 |
| T-10 | Valores por defecto de avisos y sonido | Ambos activados | **Aprobada (v1.9)** | Etapa 2 |
| T-11 | Validación local del SQL | **Ejecutada** bajo tu autorización del 9 nov | Ejecutada, sin implicar aprobación | — |
| T-12 | Cuarto ciclo: la sugerencia larga reemplaza a la corta | Sí | **Aprobada (v1.9)** | Subfase 3.2 (interfaz) |
| T-13 | `modo_registro` y registro manual en fecha sin ocurrencia | Aprobar, con la mejora de §3 (T-13) | **Aprobada (v1.9)** | Etapa 3 |
| Req. | `habito_crear` idempotente por `op_id` | Implementado en el SQL y validado localmente | **Aprobada (v1.9)** | Etapa 3 |

### Orden recomendado para decidir (histórico: ya decidido salvo T-9)
1. **Antes de ejecutar la etapa 1:** T-8.
2. **Antes de la etapa 2:** T-1, T-2, T-10 (y la firma de `habito_crear` si quieres revisarla ahora).
3. **Antes de la etapa 3:** T-3, T-7, T-13 y el requisito de idempotencia.
4. **Antes de la subfase 3.3 (cálculos):** T-4, T-5, T-6. Son decisiones funcionales; no cambian el SQL de las etapas 1 a 3.
5. **Antes de la etapa 4:** T-9, después de la simulación.
6. **En su subfase:** T-12.

---

## 2. Dependencias entre decisiones

```
T-1 ── condiciona ──▶ T-8 (qué tablas son de solo lectura), T-13 (reglas dentro de las RPC), T-2, T-3
T-4 ◀── depende de ──▶ T-5 ◀── depende de ──▶ T-6      (las tres definen cómo se reconstruyen las obligaciones)
T-4, T-5, T-6 ── se apoyan en ──▶ P4 (historial) + T-8 (historial inmodificable) + P6 (identidad única)
T-9 ── bloquea ──▶ etapa 4 ── completa ──▶ P7
T-7 ── requiere ──▶ un disparador nuevo en la etapa 3
```

---

## 3. Detalle por decisión

### T-1. Seguridad de las funciones `SECURITY DEFINER` (atención especial)

| Campo | Contenido |
|---|---|
| **Problema que resuelve** | Que un error de la interfaz o un cliente no puedan borrar el bloqueo del temporizador, reescribir sesiones o falsificar el historial. Las tablas sensibles quedan de solo lectura para el cliente y toda escritura pasa por funciones que validan reglas |
| **Recomendación** | Aprobar, con las salvaguardas siguientes, todas implementadas y probadas localmente |
| **Impacto en arquitectura y datos** | Toda escritura de Focus, descansos, hábitos nuevos y operaciones se hará con `supabase.rpc(...)`. La lectura sigue siendo `select`. `objetivos_atencion` y `preferencias_usuario` conservan el patrón `propios` de CRUD directo. Los módulos heredados no cambian |
| **Riesgos de seguridad e integridad** | (1) Una función definer **omite RLS**: si no comprueba la propiedad de un identificador, daría acceso a datos ajenos. (2) Un `search_path` manipulable permitiría sustituir funciones. (3) Funciones expuestas a `anon`. (4) Con definer, los errores de lógica tienen más alcance que con invoker. (5) Supabase suele avisar de funciones definer ejecutables por `authenticated` en el esquema expuesto: **esperado, no verificado** |
| **Salvaguardas incluidas** | `SET search_path = ''` y todo calificado con `public.`; identidad solo de `auth.uid()` (`_uid()` rechaza si es nula); comprobación de propiedad de **cada** identificador recibido (sesión, pendiente, hábito, temporizador, descanso); sin SQL dinámico; `REVOKE EXECUTE` de `PUBLIC` y `anon`, `GRANT` solo a `authenticated`; auxiliares internas sin permiso para `authenticated`; funciones de disparador sin permiso de ejecución; permisos por columna en `operaciones` y `habitos_config` |
| **Evidencia local** | X-01, X-02, X-03a/b, X-04 (pendiente ajeno), X-05, X-05b, X-06a/b, X-07, X-08 (`search_path` fijado en las 26 funciones definer), X-09, X-10, X-11, X-12a/b/c/d, T-09, T-10a/b/c, I-09 |
| **Dependencias** | T-8 (qué es de solo lectura), T-13, T-2, T-3, requisito de idempotencia |
| **Si se aprueba** | Las etapas 2 y 3 se pueden preparar para su ejecución. La interfaz de 3.2 se escribe contra las RPC |
| **Si se rechaza** | Habría que pasar a funciones `SECURITY INVOKER` con políticas de escritura. Es más simple, pero el cliente podría borrar la fila de bloqueo o editar sesiones directamente; la unicidad por clave primaria se mantendría, pero la integridad de estados y puntos dependería de la interfaz |
| **Pendiente de verificar en Supabase** | Que el rol propietario omita RLS como en la prueba local; el comportamiento de PostgREST con estas funciones; los avisos del asesor de seguridad |

### T-2. Tolerancia de 2 s para «completada» frente a «parcial»

| Campo | Contenido |
|---|---|
| **Problema** | El tiempo efectivo se calcula en el servidor en segundos enteros. Sin tolerancia, una sesión que el usuario ve terminada a 0:00 podría quedar en 1799,7 s y registrarse como «parcial» sin punto |
| **Recomendación** | Aprobar 2 s |
| **Impacto** | Una constante en `focus_completar`. Sin cambio de esquema |
| **Riesgos** | Mínimo: una sesión de 1798 s da punto. Si se quiere el criterio estricto, la interfaz debe garantizar que el temporizador llegó a cero |
| **Evidencia** | S-03: 1797 s parcial; 1798, 1799 y 1800 s completada |
| **Dependencias** | D3-16 (parcial o completada), T-1 |
| **Si se aprueba** | Se conserva el SQL |
| **Si se rechaza** | Se pone 0 (o se pasa el valor por preferencia) y se acepta el riesgo de falsos parciales |

### T-3. Cancelar un temporizador de hábito descarta solo el tramo en curso

| Campo | Contenido |
|---|---|
| **Problema** | D3-16 define cancelar para Focus (se descarta la sesión) pero no para hábitos. Si el usuario corrió 20 minutos, pausó y luego canceló, ¿se pierde todo? |
| **Recomendación** | Los tramos ya cerrados (pausas) quedan acreditados; se descarta solo el tramo corriendo |
| **Impacto** | Ninguno adicional: los tramos se acreditan al pausar o finalizar |
| **Riesgos** | Puede sorprender que «cancelar» no deje en cero. Mitigación en la interfaz: texto claro y, si se desea, un registro manual para corregir |
| **Evidencia** | W-14: tramo de 600 s conservado, tramo de 300 s descartado, bloqueo liberado |
| **Dependencias** | B2 (el registro manual reemplaza el total vigente) |
| **Si se aprueba** | Se conserva el SQL |
| **Si se rechaza** | Habría que diferir la acreditación de segmentos hasta finalizar (más estado temporal) o descartar los tramos al cancelar (con pérdida de información) |

### T-4. Eliminación de compromisos y conservación de obligaciones históricas (atención especial)

| Campo | Contenido |
|---|---|
| **Problema** | Los módulos heredados pueden borrar un pendiente (o un hito, directamente o en cascada al borrar una meta). D3-22 dice que el incumplimiento ocurrido no se elimina retroactivamente. ¿Qué ocurre con las obligaciones ya incumplidas de un compromiso eliminado? |
| **Qué ya está resuelto** | La **información no se pierde**: el disparador registra una fila `eliminado` con la instantánea completa (texto, frente, prioridad, fecha límite, estado) y todo el historial previo sigue disponible (sin clave foránea, no depende de que el registro exista). Validado en H-05, H-09 y H-11 |
| **Qué queda por decidir** | Si esas obligaciones **cuentan en Execution** |
| **Opciones** | **A.** Al eliminar, se retira el compromiso de todos los cálculos (pasados y futuros). **B.** Se conservan las obligaciones cuya fecha ya llegó (incumplidas o cumplidas) y solo se descartan las futuras. **C.** Exigir una acción explícita de «retirar» con motivo (requiere interfaz nueva; los módulos heredados seguirían borrando) |
| **Recomendación** | **B** |
| **Razón** | Es coherente con D3-22 («no se borra retroactivamente») y con P6; evita que borrar tareas vencidas mejore el indicador de períodos cerrados; no necesita cambios en los módulos heredados |
| **Impacto en arquitectura y datos** | El cálculo de obligaciones (§9 del diseño) debe leer los eventos `eliminado` y usar la instantánea para el peso, el frente y las fechas. No hay cambio de esquema |
| **Riesgos** | (1) El usuario puede percibir que «borré basura y sigue contando». Mitigación: la acción «retirar» de la opción C en una subfase posterior. (2) Si se borró por error, no hay forma de deshacer desde la aplicación (la instantánea permite reconstruirlo, no hay función de restauración). (3) Los borrados hechos con la clave de servicio o desde el panel de Supabase no quedan en el historial |
| **Dependencias** | T-5, T-6, T-8 (historial inmodificable), P4, D3-22 y P6 |
| **Si se aprueba B** | La información histórica y los períodos cerrados permanecen estables ante borrados |
| **Si se rechaza (A)** | La información sigue conservada, pero los indicadores de períodos pasados cambian al borrar, y se podría «mejorar» Execution borrando incumplimientos |
| **Cuándo decidir** | Antes de la 3.3. No bloquea las etapas 1 a 3 |

### T-5. Desmarcar cumplimientos ya atribuidos y conservar el historial (atención especial)

| Campo | Contenido |
|---|---|
| **Problema** | Un compromiso se marca como hecho y se atribuye a su obligación. Más tarde se desmarca (por error o porque el trabajo se reabrió). ¿Cambia el resultado de esa obligación? |
| **Qué ya está resuelto** | Ninguna información se pierde. `Pendientes.js` borra `hecho_en` al desmarcar, pero el disparador conserva el valor anterior en `cambios_registro` (validado en H-03). Para hitos, `hecho_en` lo sella la base y su desmarcado también queda registrado (H-07, H-08) |
| **Opciones** | **A.** Reevaluar con el estado vigente. **B.** Congelar el resultado en cuanto se cumple. **C.** Híbrida: reevaluar mientras la obligación siga siendo la vigente; congelar las que ya fueron reemplazadas por una nueva fecha (D3-22) |
| **Recomendación** | **C** |
| **Razón** | Si se marcó por error, desmarcar debe corregirlo; es simétrico con D3-2, donde completar tarde ya modifica un período cerrado. Una obligación incumplida y congelada por un aplazamiento no debe reabrirse |
| **Impacto en arquitectura y datos** | El algoritmo de obligaciones (§9) debe interpretar la secuencia de eventos `hecho` y `hecho_en` por compromiso, incluidas las reversiones. No hay cambio de esquema |
| **Riesgos** | (1) Volatilidad: un clic accidental cambia Execution de períodos cerrados. (2) Reabrir y volver a cerrar produce varios eventos; el algoritmo debe usar el último estado dentro del intervalo de cada obligación. (3) Desmarcar un cumplimiento atribuido a una fecha ya reemplazada no tiene efecto sobre la obligación congelada |
| **Dependencias** | T-4, T-6, D3-2, D3-20, P4, T-8 |
| **Si se aprueba C** | Reglas claras y auditables; el historial permite explicar cualquier cambio |
| **Si se rechaza** | Con B, un desmarcado posterior no corrige un error; con A, las obligaciones reemplazadas se podrían reabrir contra D3-22 |
| **Cuándo decidir** | Antes de la 3.3 |

### T-6. Prioridad usada en una obligación

| Campo | Contenido |
|---|---|
| **Problema** | La prioridad puede cambiar en el tiempo; el peso de la obligación debe ser reproducible |
| **Recomendación (interpretación PENDIENTE de confirmación en la v1.10)** | La prioridad vigente cuando llega la fecha límite, reconstruida desde `cambios_registro`. El usuario la aprobó como «la que tenía la obligación en su fecha de vencimiento»; se interpreta como la vigente al terminar el día de la fecha límite |
| **Impacto** | El historial registra `prioridad` (validado en H-15 solo en la restricción; el registro del cambio lo cubre el mismo mecanismo que `fecha_limite`) |
| **Riesgos** | Cambiar la prioridad después de que la obligación llegó no modifica ese resultado; si el historial falta (cambio con clave de servicio), se usa la prioridad actual |
| **Dependencias** | T-4, T-5, P4 |
| **Si se aprueba** | Reproducibilidad de períodos cerrados |
| **Si se rechaza** | Con «prioridad actual al calcular», un cambio de prioridad reescribe todo el pasado |

### T-7. Objetivos de semanas cerradas inmutables

| Campo | Contenido |
|---|---|
| **Problema** | `objetivos_atencion` es CRUD directo. Editar un objetivo de una semana pasada cambia el Balance de esa semana sin dejar rastro |
| **Recomendación** | Aprobar y agregar un disparador que rechace insertar, modificar o borrar filas cuya `semana_inicio` sea anterior al lunes de la semana actual (America/Bogota) |
| **Impacto** | **Incorporado en el SQL de la v1.9** (disparador `objetivos_semana_cerrada`, etapa 3); **sin validación local todavía**. No actúa sin usuario autenticado para no bloquear el borrado de un usuario. Sin cambio de esquema de tablas |
| **Riesgos** | Impide corregir un error de captura de una semana pasada. Mitigación: permitir editar la semana en curso y la siguiente, y avisar |
| **Dependencias** | P15 (interfaz de objetivos en 3.3), D3-19b |
| **Si se aprueba** | El historial de Balance es estable |
| **Si se rechaza** | Las semanas pasadas se pueden reescribir; habría que añadir un historial de cambios de objetivos para conservar la información |

### T-8. `cambios_registro` solo lectura e inserción; sin registro sin usuario

| Campo | Contenido |
|---|---|
| **Problema** | El historial debe ser confiable y el borrado de un usuario no debe fallar |
| **Recomendación** | Aprobar. Es una excepción al patrón `propios` (que permitiría modificar el historial) |
| **Impacto** | Dos políticas (`select`, `insert`); sin políticas de `update` ni `delete` |
| **Riesgos** | (1) El usuario puede insertar filas falsas en su propio historial mediante la API (la política de inserción es necesaria porque el disparador corre con sus permisos). Mitigación posible: que el disparador sea definer y retirar el permiso de inserción al cliente. **Es un hallazgo de esta revisión; no está implementado.** (2) Los cambios hechos con clave de servicio o desde el panel no se registran |
| **Evidencia** | H-10 (sin usuario: no registra y no falla), H-11 (borrar usuario con datos), H-12 (update y delete afectan 0 filas, no producen error), H-16 (aislamiento) |
| **Dependencias** | T-1, P4, T-4, T-5, T-6 |
| **Si se aprueba** | Historial inmodificable por el cliente |
| **Si se rechaza** | Con el patrón `propios`, el cliente podría editar el historial; se perdería la garantía de P4 |
| **Hallazgo confirmado en la prueba local** | El cliente **sí puede** insertar filas en su propio historial (T-8b). No puede hacerlo a nombre de otro usuario (T-8c) |
| **Variante T-8b (aprobada el 9 nov e incorporada al SQL de la v1.9)** | Pasar `registrar_cambios` a `SECURITY DEFINER` (con su `search_path` vacío), eliminar la política `agregar propios` y revocar `INSERT` al cliente. **Validada localmente:** las 16 pruebas de la etapa 1 pasan, el cliente recibe «permission denied» al insertar y borrar un usuario con datos sigue funcionando. **Incorporada en el SQL v1.9**; la versión incorporada **no se ha vuelto a validar** localmente |
| **Consecuencia de T-8b** | Aprobarla cierra la última vía de escritura del cliente sobre el historial. Rechazarla deja el historial como evidencia fiable salvo para quien manipule su propia sesión; para un uso personal, el riesgo es bajo |

### T-9. Parámetros y algoritmo de reloj sin conexión (P7)

| Campo | Contenido |
|---|---|
| **Problema** | La cota de desfase de 5 min y la tolerancia de 2 min no están justificadas |
| **Recomendación** | No fijarlos todavía. Hacer la simulación de `docs/PRUEBAS-FASE-3-v1.10.md` §13 y presentar resultados |
| **Impacto** | Solo la etapa 4. Las etapas 1 a 3 no dependen |
| **Riesgos** | Una cota demasiado grande ordena mal; una demasiado pequeña genera notificaciones de conflicto evitables |
| **Dependencias** | P7, D3-24, T-1 |
| **Si se aprueba una vez simulado** | Se redacta `operaciones_aplicar` |
| **Si se difiere** | La aplicación solo operaría en línea, sin cola sin conexión (cambia P7 y D3-13) |
| **Nota de la validación local** | Las operaciones en línea ya quedan idempotentes y serializadas por bloqueos. Lo no validado es solo la reconciliación sin conexión |

### T-10. Valores por defecto de avisos y sonido

| Campo | Contenido |
|---|---|
| **Problema** | `preferencias_usuario` necesita valores cuando no hay fila |
| **Recomendación** | `avisos = true`, `sonido = true` |
| **Impacto** | Dos valores en una función y en la tabla |
| **Riesgos** | Los navegadores bloquean el sonido hasta que el usuario interactúa y el aviso requiere permiso por dispositivo: el valor activado puede ser inoperante sin avisar. La interfaz debe indicarlo |
| **Dependencias** | D3-11, §4.5 de la especificación |
| **Si se aprueba** | Se conserva el SQL |
| **Si se rechaza** | Se cambia el valor por defecto; sin otro efecto |

### T-11. Validación local del SQL

| Campo | Contenido |
|---|---|
| **Estado** | **Ejecutada** bajo tu autorización del 9 nov (PostgreSQL 16 local, aislado de Supabase). Resultados en `docs/VALIDACION-LOCAL-FASE-3-v1.10.md` |
| **Alcance** | Las tres etapas, sus reversiones, 122 comprobaciones SQL (más 3 de la variante T-8b) y 9 escenarios con dos conexiones simultáneas |
| **Qué no demuestra** | Que funcione igual en Supabase: roles, PostgREST, asesores, versión y extensiones propias. Por eso P13 (transacciones con `ROLLBACK` sobre Supabase) sigue pendiente de tu autorización |
| **Consecuencia** | Que se haya ejecutado no equivale a aprobar el SQL |

### T-12. Cuarto ciclo: la sugerencia larga reemplaza a la corta

| Campo | Contenido |
|---|---|
| **Problema** | §4.4 no dice si, al completar el cuarto ciclo, se sugiere solo el descanso largo o ambos |
| **Recomendación** | Solo el largo |
| **Impacto** | Lógica de la interfaz en 3.2. Sin cambio de esquema |
| **Riesgos** | Ninguno técnico. Con «ambos», el usuario vería dos sugerencias a la vez |
| **Dependencias** | D3-21a, D3-21b, P9 |
| **Si se aprueba** | Una sola sugerencia; el contador se comporta como en C-01 a C-12 |
| **Si se rechaza** | Se muestran ambas; sin efecto en datos |

### T-13. `modo_registro` y registro manual en fecha sin ocurrencia

| Campo | Contenido |
|---|---|
| **Problema** | «Registro: manual o temporizador» no dice si es exclusivo. Y un registro manual en una fecha sin ocurrencia programada no tiene dónde acreditarse |
| **Recomendación** | `modo_registro` es el método principal (solo un hábito en modo temporizador puede iniciar uno); el registro manual está siempre disponible; un manual en fecha sin ocurrencia se **rechaza con aviso** |
| **Impacto** | `habito_timer_iniciar` valida el modo; `habito_registrar_manual` valida la ocurrencia |
| **Riesgos** | **Hallazgo:** cuando una RPC lanza una excepción, la transacción se revierte y **no queda fila en `operaciones`**. Para un registro manual encolado sin conexión y rechazado, la etapa 4 deberá capturar el error y registrar la operación como `rechazada` con su motivo, para no violar «nunca descartar en silencio» |
| **Evidencia** | W-08, W-09, W-15, X-03 |
| **Dependencias** | D3-13, D3-23, P7 |
| **Si se aprueba** | El rechazo es explícito; el usuario puede reprogramar el hábito |
| **Si se rechaza** | Habría que guardar el manual aun sin ocurrencia (sin acreditarlo a Wellbeing), lo que añade filas que el cálculo ignora |

---

## 4. Requisito explícito: idempotencia de `habito_crear` (atención especial)

| Campo | Contenido |
|---|---|
| **Problema** | La versión anterior no recibía `op_id`: reintentar tras un fallo de red creaba un hábito duplicado |
| **Cambio hecho en el SQL del documento** | Nueva firma `habito_crear(p_op_id, p_dispositivo_id, p_seq, p_nombre, p_modo, p_frecuencia, p_dias, p_objetivo_s, p_desde)`. Registra la operación (`habito_crear`, objetivo `habito_config`); repetir el mismo `op_id` devuelve el hábito ya creado |
| **Mecanismo de concurrencia** | `_op_existente` toma un bloqueo consultivo por `(usuario, op_id)`: un reintento simultáneo espera a la primera llamada y recibe su resultado. La prueba lo corrige: antes el segundo recibía un `temporizador_ocupado` aparente |
| **Evidencia** | K-04 (secuencial) y CT-09 (simultáneo: 1 hábito, 1 versión, 1 operación); CT-04 para el mismo mecanismo en Focus |
| **Alcance** | `habito_programar` y `habito_archivar` son idempotentes por naturaleza (la repetición devuelve `version_existente` o el mismo estado). Todas las demás RPC ya usaban `op_id` |
| **Estado** | **Aprobada el 9 nov (v1.9)** e incorporada al SQL; validada localmente en la v1.8 (K-04, CT-09) |

---

## 5. Resumen de lo que esta revisión añadió o cambió

1. Dos defectos reales corregidos en el SQL del documento (condiciones de carrera de historial manual y de reintentos simultáneos).
2. Idempotencia de `habito_crear` por `op_id`.
3. Funciones de disparador sin permiso de ejecución para `anon` y `authenticated`.
4. Dos hallazgos sin implementar, presentados como decisiones: **T-8b** (historial inyectable por el cliente; la variante se validó localmente) y la captura de rechazos de la etapa 4 (T-13).
5. Una omisión del SQL: el disparador de T-7, que se agregaría solo tras tu aprobación.

---

## 6. Hallazgos de la revisión correctiva (v1.10)

| ID | Tema | Estado | Detalle |
|---|---|---|---|
| T-6 | Interpretación de «fecha de vencimiento» | **Pendiente de tu confirmación** | Se conserva la propuesta (prioridad vigente al cierre del día de vencimiento en America/Bogota). Consecuencias históricas y alternativas A a E: `DISENO-TECNICO` §9.6 |
| T-7b | `auth.uid()` NULL y borrado en cascada con identidad | Propuesta sin decidir | La omisión con NULL solo la alcanzan roles que omiten RLS (no es un hueco para el cliente). Riesgo: borrar al usuario con su propia identidad falla. Opciones T-7b-1 a T-7b-4 en `MATRIZ-PRUEBAS-T7-T8B` §2.7. **La lógica de T-7 no se cambió** |
| T-8c | Privilegios residuales del cliente sobre las tablas de solo lectura | Propuesta sin decidir | `REVOKE INSERT, UPDATE, DELETE` no retira `TRUNCATE`, `REFERENCES` ni `TRIGGER`. Propuesta: `REVOKE ALL` + `GRANT SELECT` (`MATRIZ-PRUEBAS-T7-T8B` §3.4). **No aplicada** |
| T-8 | H-12 | Corregida en la documentación | Se espera `permission denied` en `UPDATE` y `DELETE`, no «0 filas» |
| T-1 | Etapa 0 | Rediseñada | El criterio 8 se comprueba por comportamiento y se añaden RLS forzado y el contexto de ejecución (`ANALISIS-ETAPA-0`) |