# Fase 3: escenarios de prueba (v1.8)

Fecha: 9 nov 2026. Corresponde a `docs/DISENO-TECNICO-FASE-3-v1.8.md` y `docs/MIGRACIONES-FASE-3-v1.8.md`.

> **ESTADO:** la capa B (PostgreSQL local desechable) **se ejecutó el 9 nov 2026**; resultados en `docs/VALIDACION-LOCAL-FASE-3-v1.8.md`. Las capas C (Supabase con `ROLLBACK`) y D (regresión real) **no se han ejecutado**.
> - P13 aprueba la **estrategia** de transacciones con `ROLLBACK`, pero **no autoriza ejecutarla**.
> - No se ha realizado ninguna prueba contra Supabase.
> - Los escenarios de este documento son el diseño; los resultados reales de la capa B están en el informe de validación.

---

## 1. Cómo se ejecutarían (cuando el usuario lo autorice)

| Capa | Qué prueba | Dónde corre | Toca Supabase |
|---|---|---|---|
| A. Dominio puro | Máquina de estados, ciclos, obligaciones, indicadores, reconciliación | `node:test` en `web/tests` (P12) | No |
| B. SQL en base local desechable (T-11) | Restricciones, disparadores, funciones, RLS simulada | PGlite o Postgres local, con `auth.uid()` simulado | **No** |
| C. SQL en Supabase con `ROLLBACK` (P13) | Lo mismo, contra el motor real | Una transacción que termina en `ROLLBACK` | **Sí, sin persistir nada** |
| D. Regresión de módulos heredados | Que nada existente cambie | Pruebas manuales con la sesión del usuario y las consultas existentes | Lectura y escritura reales: requiere autorización aparte |
| E. Simulación de reloj | Justificar la cota y la tolerancia (P7) | Script de simulación local | No |

Orden recomendado: A → E → B → C → D. C y D solo después de que B pase.

### 1.1 Plantilla de la transacción con `ROLLBACK` (capa C)
```sql
begin;
  -- Identidad simulada: un usuario existente (las filas de prueba no persisten).
  select set_config('request.jwt.claims', '{"sub":"<uuid-del-usuario>","role":"authenticated"}', true);
  set local role authenticated;

  -- ... escenarios de este documento ...

rollback;   -- Nada de lo anterior se conserva.
```
Límites: una sola conexión, así que **no** reproduce carreras reales entre dos transacciones simultáneas. La capa B con Postgres local y dos conexiones sí puede (escenario T-07). Si la capa C se usara con el usuario real, las filas transitorias son del usuario y desaparecen al final.

### 1.2 Reglas de las pruebas
- Cada escenario indica el resultado esperado y qué decisión lo respalda.
- Ningún escenario escribe datos persistentes.
- Un escenario que falla se documenta; no se ajusta el SQL sin volver a aprobación.

---

## 2. Exclusividad del temporizador (P2, D3-15a, D3-18)

| ID | Escenario | Pasos | Resultado esperado |
|---|---|---|---|
| T-01 | Iniciar un Focus sin nada activo | `focus_iniciar` | Sesión `en_curso`; una fila en `temporizador_activo` (`focus`, `corriendo`) |
| T-02 | Iniciar un segundo Focus | `focus_iniciar` dos veces con `op_id` distintos | La segunda falla con `temporizador_ocupado` y detalle de la activa |
| T-03 | Pausar conserva el bloqueo | Iniciar, pausar, iniciar otro | Falla con `temporizador_ocupado`; el bloqueo queda `pausado` |
| T-04 | Temporizador de hábito con Focus pausado | Focus pausado + `habito_timer_iniciar` | `temporizador_ocupado` |
| T-05 | Descanso ocupa el bloqueo | `descanso_iniciar` + `focus_iniciar` | `temporizador_ocupado` |
| T-06 | Completar libera | Completar y luego iniciar otro | El segundo inicia; el bloqueo se recrea |
| T-07 | Carrera de dos inicios simultáneos | Dos conexiones llaman a `focus_iniciar` a la vez | Exactamente una gana; la otra recibe `temporizador_ocupado`. **Solo reproducible con dos conexiones (capa B)** |
| T-08 | Cancelar libera | Iniciar, cancelar, iniciar | Funciona |
| T-09 | Borrado directo del bloqueo | `delete from temporizador_activo` como `authenticated` | Rechazado por permisos |
| T-10 | Escritura directa en sesiones | `insert`/`update` en `focus_sesiones` como `authenticated` | Rechazado por permisos |
| T-11 | Redundancia del índice único parcial | Intentar dos sesiones `en_curso` por inserción como propietario | Rechazado por `focus_sesiones_una_activa` |
| T-12 | Omitir un descanso no ocupa el bloqueo | `descanso_omitir` con un Focus activo | Se registra; no toca el bloqueo |

## 3. Estados, tiempo y puntos (P3, D3-16)

| ID | Escenario | Pasos | Esperado |
|---|---|---|---|
| S-01 | Completar al alcanzar la duración | Sesión de 30 min con tiempo efectivo 1800 s | `completada`, `puntos = 1` |
| S-02 | Completar antes de tiempo | Efectivo 600 s | `parcial`, `puntos = 0` |
| S-03 | Frontera de tolerancia (T-2) | Efectivo 1797, 1798, 1799, 1800 s | 1797 `parcial`; 1798, 1799, 1800 `completada` |
| S-04 | Cancelar | `focus_cancelar` | `cancelada`, `puntos = 0`, fila **conservada**, bloqueo liberado |
| S-05 | Pausa conserva el tiempo | Correr 10 min, pausar, reanudar, completar | El tiempo efectivo no cuenta la pausa |
| S-06 | Completar desde pausada | Pausar y completar | Permitido |
| S-07 | Estado final definitivo | Completar y luego pausar | `transicion_invalida` |
| S-08 | Completar tras cancelar | Cancelar y completar | Se devuelve la sesión `cancelada`; operación `conflicto`/`ya_cancelada` |
| S-09 | Cancelar tras completar | Completar y cancelar | Sesión intacta; `conflicto`/`ya_finalizada` |
| S-10 | Restricción de puntos | Forzar `puntos = 1` en una `parcial` como propietario del esquema | Rechazado por `focus_puntos_coherentes` |
| S-11 | Duración de las preferencias | Con y sin fila en `preferencias_usuario` | Con fila usa sus minutos; sin fila, 30 min |
| S-12 | Frente inválido | `frente_id = 'x'` | `parametro_invalido` |
| S-13 | Sesión desde un pendiente | `p_pendiente_id` propio | Se asocia |
| S-14 | Pendiente de otro usuario | `p_pendiente_id` ajeno | `pendiente_invalido` |

## 4. Ciclos y descansos (P9, D3-21a/b)

| ID | Escenario | Esperado |
|---|---|---|
| C-01 | Cuatro sesiones completadas | El contador derivado vale 4; la interfaz sugiere descanso largo |
| C-02 | Parciales y canceladas | No incrementan el contador |
| C-03 | Descanso largo completado | El contador vuelve a 0 |
| C-04 | Descanso largo omitido por el usuario | Contador 0; fila `omitido`, motivo `usuario` |
| C-05 | Iniciar Focus con 4 ciclos y sin decidir | Se inserta un descanso largo `omitido`, motivo `inicio_focus`; contador 0 |
| C-06 | Cambio de día | El contador no se reinicia |
| C-07 | Omitir el descanso corto | No afecta al contador |
| C-08 | Iniciar Focus con 3 ciclos | No se inserta omisión |
| C-09 | Cancelar un descanso largo en curso | `omitido`, motivo `cancelado`; cuenta como decisión sobre el largo; contador 0 |
| C-10 | Descanso pausado | Ocupa el bloqueo hasta completarse u omitirse |
| C-11 | Completar un descanso antes de tiempo | `completado` igualmente |
| C-12 | Iniciar un hábito con descanso largo pendiente de decisión | No cuenta como omitir (solo aplica a Focus, P9) |

## 5. Historial y disparadores (P4, P5)

| ID | Escenario | Esperado |
|---|---|---|
| H-01 | Insertar pendiente `{texto, frente, meta_id}` (módulo heredado) | Inserta; `prioridad = 'media'`; una fila `creado` |
| H-02 | Marcar `hecho` con `hecho_en` (como `Pendientes.js`) | Dos filas `actualizado` (`hecho`, `hecho_en`) |
| H-03 | Desmarcar (`hecho_en = null`) | Filas con valor anterior; el historial conserva el `hecho_en` previo |
| H-04 | Cambiar `fecha_limite` dos veces | Dos filas con anterior y nuevo |
| H-05 | Borrar un pendiente | Fila `eliminado` con instantánea; el historial sobrevive |
| H-06 | Insertar hito `{meta_id, titulo}` | Inserta; `prioridad = 'media'`; `hecho_en` nulo |
| H-07 | Marcar un hito (`hecho = true`, sin `hecho_en`) | El disparador sella `hecho_en = now()`; historial refleja el cambio |
| H-08 | Desmarcar un hito | `hecho_en` nulo; historial con el valor anterior |
| H-09 | Borrar una meta con hitos | Cada hito borrado en cascada deja `eliminado` |
| H-10 | Cambio sin usuario autenticado | No se registra, y no falla |
| H-11 | Borrar el usuario | La cascada no falla |
| H-12 | Intentar `update`/`delete` en `cambios_registro` | Afectan 0 filas y no dan error (la política RLS los filtra). Verificado en la prueba local |
| H-13 | Relleno inicial con filas existentes | Una fila `creado` por registro, con `cambiado_en = creado_en` |
| H-14 | Actualización que no cambia campos seguidos (por ejemplo `texto`) | No registra nada |
| H-15 | Prioridad inválida | Rechazada por `CHECK` |
| H-16 | Reversión suave | Con los disparadores desactivados, las inserciones heredadas siguen funcionando |

## 6. Obligaciones (P6, D3-2, D3-20, D3-22): dominio puro

Entrada: líneas de tiempo reconstruidas del historial. «Llega» = 00:00 del día siguiente en America/Bogota.

| ID | Escenario | Esperado |
|---|---|---|
| O-01 | **Ejemplo P6:** vence lun, sin completar; mar se reprograma a vie; completa jue | Eval. 1 lunes `incumplida` (período del lunes). Eval. 2 viernes `cumplida a tiempo`. Mismo `registro_id` |
| O-02 | Vence lun, completa mar sin reprogramar | `cumplida tardía` en el período del lunes; conserva fecha y hora reales |
| O-03 | Cambio de fecha antes de que llegue | La fecha anterior no genera evaluación |
| O-04 | Cambio de fecha después de vencer, y no se completa nunca | Eval. original `incumplida`; la nueva `incumplida` al llegar |
| O-05 | Dos reprogramaciones tras vencer | Una evaluación por fecha que llegó; el historial completo |
| O-06 | Vence hoy | `abierta`; no cuenta como vencida |
| O-07 | Sin fecha | Sin evaluaciones; excluido (A2, D3-1) |
| O-08 | Se asigna fecha pasada a un pendiente ya completado | Cuenta desde ese instante como `cumplida` |
| O-09 | Cambio de prioridad antes y después de llegar la fecha | Peso = prioridad vigente al llegar (T-6) |
| O-10 | Hito con `hecho_en` sellado por el disparador | Misma lógica que un pendiente |
| O-11 | Hito sin fecha | Excluido |
| O-12 | Desmarcar tras cumplirse (T-5) | Se conserva el evento; resultado según la decisión T-5 |
| O-13 | Eliminar un compromiso con obligación incumplida (T-4) | Historial conservado; efecto en Execution según T-4 |
| O-14 | Período cerrado cambia al completar tarde | Esperado y aceptado; Execution del período cerrado se recalcula |
| O-15 | Frontera de día: completa a las 23:59:59 y a las 00:00:00 | A tiempo en el primer caso; tardía en el segundo |
| O-16 | Identidad: contar evaluaciones por compromiso | Nunca aparecen dos compromisos distintos para un aplazamiento |

## 7. Idempotencia y operaciones (P7 aprobado)

| ID | Escenario | Esperado |
|---|---|---|
| I-01 | Mismo `op_id` dos veces en `focus_iniciar` | Misma sesión; ninguna fila nueva |
| I-02 | Mismo `op_id` dos veces en `focus_completar` | Un solo punto |
| I-03 | Mismo `(dispositivo_id, seq)` con `op_id` distinto | Rechazado por unicidad |
| I-04 | Completar la misma sesión desde dos `op_id` | Un punto; la segunda queda `duplicada` |
| I-05 | Pausar dos veces | La segunda `fusionada` |
| I-06 | Reanudar una sesión en curso | `fusionada` |
| I-07 | Retry tras un fallo de red con el mismo `op_id` | Devuelve el resultado almacenado |
| I-08 | Registro manual repetido con el mismo `op_id` | Un solo cambio de historial |
| I-09 | Marcar `notificada` | Permitido; cualquier otra columna de `operaciones` se rechaza |
| I-10 | Llamada duplicada simultánea (R4) | El cliente recibe un `temporizador_ocupado` aparente y, al reintentar, el resultado almacenado |

## 8. Hábitos y Wellbeing (P8, B2, D3-15, D3-23)

| ID | Escenario | Esperado |
|---|---|---|
| W-01 | Correr lun/mié/vie, 45 min; calendario de una semana | Ocurrencias solo esos días |
| W-02 | Leer todos los días, 60 min | Una por día |
| W-03 | **Ejemplo D3-23:** viernes programado, sábado no; temporizador 30 min el viernes antes de medianoche y 30 el sábado | Segmento viernes `acreditado`, 1800 s; segmento sábado conservado, `acreditado = false`; `habito_tiempo` solo del viernes |
| W-04 | Tramo que cruza medianoche con ambos días programados | Dos segmentos, cada uno a su fecha |
| W-05 | Tramo que cruza dos medianoches | Tres segmentos |
| W-06 | Registro manual reemplaza lo acumulado | `manual_s = X`, `temporizador_s = 0`; segmentos anteriores con `reemplazado_en`; historial con anterior y nuevo |
| W-07 | Temporizador tras un manual (D3-15b) | Acumula sobre el manual; total = manual + nuevo |
| W-08 | Manual en fecha sin ocurrencia | `sin_ocurrencia` (T-13) |
| W-09 | Manual en fecha futura | `fecha_no_permitida` |
| W-10 | Nueva programación con vigencia pasada | `fecha_no_permitida` |
| W-11 | Nueva programación desde mañana | Las ocurrencias anteriores no cambian |
| W-12 | Misma fecha de vigencia dos veces | `version_existente` |
| W-13 | Hábito archivado | Sin ocurrencias desde `archivado_desde`; el historial intacto |
| W-14 | Cancelar un temporizador con tramos ya cerrados (T-3) | Los tramos cerrados quedan acreditados; el tramo en curso se descarta |
| W-15 | Iniciar el temporizador de un hábito en modo manual | `modo_no_temporizador` (T-13) |
| W-16 | Hábito ajeno | `habito_invalido` |
| W-17 | Temporizador de hábito mientras hay un Focus activo | `temporizador_ocupado` |
| W-18 | Wellbeing: 45 de 45 min = 100 %; 60 de 45 = 100 % (tope); 0 registrado = 0 % real | Cálculo del dominio |
| W-19 | Sin ocurrencias elegibles | «Sin datos» |
| W-20 | Día en curso | Incluido y marcado «día en curso» (D3-3) |
| W-21 | Hora del dispositivo irrelevante | El tiempo de hábitos usa solo la hora del servidor |

## 9. Indicadores (dominio puro, P12)

| ID | Escenario | Esperado |
|---|---|---|
| F-01 | Execution con T y M | `E = 0,6T + 0,4M` |
| F-02 | Solo T o solo M | Parcial |
| F-03 | Ninguno | «Sin datos» |
| F-04 | Pesos 3/2/1 | Cumplimiento ponderado |
| F-05 | Balance sin filas de objetivos para la semana | «Sin objetivo»; puntos aparte; sin porcentaje |
| F-06 | Balance semana cerrada | Objetivo completo |
| F-07 | Balance semana en curso (miércoles) | Objetivo prorrateado a 3 de 7 días |
| F-08 | Balance diario | Objetivo semanal ÷ 7 |
| F-09 | Balance mensual con semanas que cruzan el mes | Solo los días del mes; mes en curso hasta hoy |
| F-10 | Mes con semanas parcialmente configuradas | Solo los días con objetivos aportan al denominador |
| F-11 | Exceso en un frente | No compensa déficits |
| F-12 | Frente con objetivo 0 | Excluido |
| F-13 | Sesión parcial o cancelada | No suma puntos |
| F-14 | Sesiones de hábito | No suman puntos de atención |
| F-15 | Productivity y Enjoyment | Ambas suman a Balance; ninguna suma directamente a Execution (D3-7) |
| F-16 | Frente fuera del mapa (`Sin asignar`) | No entra en Balance |

## 10. Seguridad y aislamiento (RLS, T-1)

Requieren un segundo usuario simulado.

| ID | Escenario | Esperado |
|---|---|---|
| X-01 | Leer filas de otro usuario en cada tabla nueva | Ninguna fila |
| X-02 | Pasar un `sesion_id` ajeno a las funciones | `sesion_no_encontrada` |
| X-03 | Pasar un `habito_id` o `temporizador_id` ajeno | `habito_invalido` / `temporizador_no_encontrado` |
| X-04 | Pasar un `pendiente_id` ajeno | `pendiente_invalido` |
| X-05 | Llamar a las funciones como `anon` | Sin permiso |
| X-06 | Llamar a `_uid`, `_prefs`, `_journal`, `_cerrar_tramo` como `authenticated` | Sin permiso |
| X-07 | Llamar sin sesión (`auth.uid()` nulo) | `no_autenticado` |
| X-08 | Inyectar un `search_path` malicioso | Sin efecto (`search_path` vacío) |
| X-09 | Actualizar columnas de `habitos_config` distintas de `nombre` y `modo_registro` | Rechazado |
| X-10 | Cada tabla nueva con RLS activo | Verificado por consulta de catálogo |
| X-11 | Un usuario crea una fila `objetivos_atencion` para otro usuario | Rechazado por la política |

## 11. Regresión de módulos heredados (D)

| ID | Módulo | Operación | Esperado |
|---|---|---|---|
| L-01 | Mi día / Home | Crear, marcar y borrar un pendiente | Igual que hoy |
| L-02 | Mi día / Home | Pendiente con meta | Igual |
| L-03 | Panel | Consulta `pendientes` (`frente, hecho, hecho_en`) | Igual |
| L-04 | Metas | Crear meta, hito, marcar y borrar | Igual; el hito marcado tiene `hecho_en` |
| L-05 | Metas | Borrar meta con hitos | Igual |
| L-06 | Salud | Crear hábito heredado | Igual; no aparece ningún hábito nuevo |
| L-07 | Salud | Marcar y desmarcar (`upsert`/`delete` en `habito_registros`) | Igual |
| L-08 | Salud | Un hábito nuevo (`habitos_config`) no aparece en Salud | Cierto |
| L-09 | Finanzas, Gastos, Jornada, Biblioteca, Cerebro | Operaciones habituales | Sin cambios |
| L-10 | `select('*')` de pendientes e hitos | Columnas extra | Los módulos no fallan |
| L-11 | Login y middleware | Sin cambios | Igual |
| L-12 | Las 330 pruebas existentes | `npm test` | Pasan sin modificar |

## 12. Reversión

| ID | Escenario | Esperado |
|---|---|---|
| R-01 | Aplicar la etapa N y su reversión suave | Datos intactos; la aplicación heredada funciona |
| R-02 | Aplicar y revertir en duro dentro de una transacción con `ROLLBACK` | Los objetos desaparecen sin error; las tablas heredadas vuelven a su esquema original |
| R-03 | Reversión de la etapa 2 con la etapa 3 aplicada | Falla (y la transacción se revierte sin borrar nada) por el disparador `objetivos_tocar`, que depende de `_tocar_actualizado_en`. Verificado en la prueba local |
| R-04 | Reaplicar tras revertir | Funciona |
| R-05 | Comparación de `information_schema` antes y después de aplicar y revertir | Idéntica |

---

## 13. Reconciliación sin conexión (P7): escenarios y justificación de valores

El algoritmo definitivo y los valores de reloj **no están aprobados**. Estos escenarios sirven para justificarlos. Aplican el orden aprobado: dependencias causales, secuencia por dispositivo, reglas para la concurrencia, hora ajustada solo como auxiliar.

### 13.1 Escenarios

| ID | Escenario | Qué se verifica |
|---|---|---|
| OF-01 | A pausa a las 10:10 y B completa a las 10:20, ambos sin conexión; **B sincroniza primero** | La llegada tardía de la pausa no se rechaza por orden de llegada. El tiempo efectivo descuenta la pausa anterior al completar |
| OF-02 | La operación de B depende de una de A, pero el reloj de B atrasa 6 minutos | **La dependencia causal prevalece**: se aplica A primero aunque su hora ajustada sea posterior |
| OF-03 | Llega una operación cuya dependencia aún no se recibió | Queda `pendiente_dependencia` y se aplica al llegar la dependencia |
| OF-04 | Reenvío completo de la cola tras un corte | Todo `duplicada`; un solo punto; sin cambios dobles |
| OF-05 | Mismo `(dispositivo, seq)` con otro `op_id` | `rechazada`, conservada y notificada |
| OF-06 | Completar ∥ cancelar, relojes confiables | Gana la causalmente anterior o, sin causalidad, la de hora ajustada más temprana. La otra `conflicto` y se notifica |
| OF-07 | Completar ∥ cancelar, un reloj no confiable | Gana la primera aplicada; el conflicto se conserva y se notifica |
| OF-08 | Dos registros manuales de la misma ocurrencia desde dos dispositivos | Vale el más tardío según causalidad u hora confiable; el otro queda como sustituido. Nunca se suman |
| OF-09 | Registro manual ∥ segmentos de temporizador | Segmentos anteriores reemplazados; posteriores suman |
| OF-10 | La sesión de autenticación caduca estando sin conexión | La cola se conserva y se reanuda tras iniciar sesión |
| OF-11 | Otro usuario inicia sesión en el mismo navegador | No recibe ni ve la cola ajena |
| OF-12 | El usuario borra los datos del navegador con la cola pendiente | Se advirtió; se pierde lo no sincronizado; nada se corrompe |
| OF-13 | Estimación del desfase con latencia asimétrica | La cota no se contamina por la latencia |
| OF-14 | Operación sobre una sesión ya finalizada desde otro dispositivo en línea | `conflicto`; sin puntos duplicados |
| OF-15 | Hora de una operación 3 minutos en el futuro respecto del servidor | Se marca «hora ajustada» según la tolerancia |
| OF-16 | Temporizador de hábito finalizado sin conexión a las 00:30 con un tramo desde las 23:50 | Dos segmentos por día local; sin duplicar al sincronizar |
| OF-17 | Dos pausas del mismo dispositivo en orden de `seq` | Se aplican en orden, sin reordenar por hora |
| OF-18 | Descanso en curso y operación de Focus desde otro dispositivo sin conexión | El inicio de Focus sin conexión **no existe** (D3-13); cualquier operación se rechaza con registro |

### 13.2 Simulación para justificar la cota y la tolerancia

**Modelo.** Cada caso genera una línea de tiempo verdadera de una sesión con eventos de dos dispositivos, un desfase de reloj por dispositivo y un intervalo sin conexión. Se aplica el algoritmo candidato y se compara con la verdad.

**Variables:**
- Desfase de reloj: 0, ±10 s, ±30 s, ±1 min, ±2 min, ±5 min, ±10 min.
- Duración de la actividad: 5, 25, 30 y 60 min.
- Intervalo sin conexión: 1 min, 10 min, 1 h, 8 h.
- Pares de operaciones concurrentes: los de la tabla de §10.4 del diseño.

**Valores candidatos:**
- Cota de desfase confiable: 30 s, 60 s, 120 s, 300 s.
- Tolerancia hacia el futuro: 5 s, 30 s, 120 s.

**Métricas:**
- M1: ganador equivocado (frente a la verdad causal).
- M2: segundos de tiempo mal atribuidos.
- M3: conflictos notificados que eran evitables.
- M4: notificaciones por semana de uso típico.

**Criterio de decisión propuesto (no aprobado):** elegir el valor más pequeño que mantenga M1 por debajo de un umbral y M3 aceptable; los umbrales los define el usuario.

**Razonamiento previo.** Una cota de 5 min es igual a la duración de un descanso corto: con ella no se podría confiar en la hora ajustada para ordenar acciones sobre un descanso. Una cota muy baja (30 s) puede marcar como no confiables relojes normales y generar más notificaciones. Por eso los candidatos incluyen valores menores a 5 min y la elección queda pendiente de los resultados.

**Datos reales.** Antes de decidir, conviene medir el desfase real de los dispositivos del usuario cuando la aplicación esté en uso. No se ha medido nada.

---

## 14. Criterios para dar por superada cada capa

| Capa | Criterio |
|---|---|
| A | Todos los escenarios de dominio pasan; las 330 pruebas existentes siguen pasando |
| B | Todos los escenarios SQL pasan en una base local desechable, incluida la carrera T-07 |
| C | Los escenarios de §2 a §12 pasan en Supabase y la transacción termina en `ROLLBACK` sin dejar nada |
| D | Regresión de §11 sin diferencias, con el usuario presente |
| E | Resultados de simulación presentados y valores aprobados por el usuario |

Ninguna capa se ejecuta sin autorización expresa.
