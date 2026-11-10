# Fase 3: registro de decisiones y contradicciones — v1.8

Fecha: 9 nov 2026. Actualizado con las aprobaciones de la auditoría 3.0 (P1 a P15); corresponde a la especificación v1.8.
Solo documentación. No se tocó código, Supabase, RLS, autenticación ni configuración.

> v1.8 incorpora las aprobaciones de diseño P1 a P15 de la auditoría 3.0, con las precisiones de P6 y P7. **Aprueba diseño, no ejecución:** no autoriza SQL, migraciones, pruebas contra la base de datos ni cambios de código.

## 1. Decisiones aprobadas

### 1.1 Base (especificación v1.0, aprobada)
Objetivo de la fase; tres indicadores independientes sin puntuación global; fórmulas de Execution (E = 0.6T + 0.4M, pesos 3/2/1) y Balance; períodos con semana de lunes a domingo en America/Bogota; indicadores semanales y mensuales recalculados desde registros originales; un punto por sesión completada, sin proporcionalidad; descansos sin puntos; descanso largo sugerido tras 4 ciclos y sin inicio automático; valores iniciales 30/5/20 minutos; IA que propone pero no ejecuta sin aprobación; «Sin datos» nunca cero; sin datos ficticios; restricciones de autenticación, middleware y RLS; seis frentes como dimensión transversal.

### 1.2 Primera tanda (9 nov 2026)
| # | Decisión | Estado |
|---|---|---|
| A1 | Home reemplaza a Mi día en `/`; auditar Mi día; no eliminar funcionalidades ni código sin autorización | Aprobada |
| A2 | Pendientes sin fecha límite quedan excluidos de Execution hasta tener fecha | Aprobada |
| A3 | Hábitos con frecuencia (todos los días o días específicos), duración objetivo (minutos u horas), registro manual o con temporizador; Wellbeing por tiempo con tope 100 % por ocurrencia | Aprobada |
| A4 | Supabase como fuente de verdad de Focus Mode; sincronización entre dispositivos; sesión activa recuperable; persistir inicio, pausas, reanudaciones y finalización; sin sesiones ni puntos duplicados | Aprobada |
| A5 | Focus Mode y temporizadores de hábitos con registros independientes | Aprobada |

### 1.3 Segunda tanda (v1.2)
| # | Decisión | Estado |
|---|---|---|
| B1 | Un solo temporizador activo globalmente (Focus u hábito). Equivale a cerrar D3-5 con la exclusividad global | Aprobada |
| B2 | El temporizador acumula; el registro manual reemplaza el acumulado; se conservan fuente e historial. Equivale a cerrar D3-4 | Aprobada |
| B3 | Modo sin conexión: operaciones pendientes locales, sincronización al reconectar, Supabase como fuente de verdad, resolución de conflictos y prevención de duplicados. Reemplaza a D3-9 | Aprobada |
| B4 | Cada hito con prioridad propia (alta, media, baja; pesos 3, 2, 1), sin heredar de la meta | Aprobada |
| B5 | El centro de control se llama Home y ocupa `/`. Cierra D3-12 | Aprobada |


### 1.4 Tercera tanda (v1.3)
| # | Decisión | Estado |
|---|---|---|
| D3-17a | Balance diario: distribuir proporcionalmente el objetivo semanal entre los siete días (objetivo semanal ÷ 7) | Aprobada |
| D3-17b | Balance mensual: sumar la fracción diaria del objetivo semanal correspondiente a cada día del mes; prorratear semanas que cruzan los límites del mes | Aprobada |
| D3-18 | El temporizador de descanso también ocupa el temporizador global; no se puede iniciar otro temporizador durante el descanso | Aprobada |
| D3-15(b) | Si hay un registro manual de hábito y luego se usa el temporizador, el tiempo del temporizador se acumula sobre el valor manual vigente (C20) | Aprobada |
| D3-14 | Pendientes e hitos creados sin prioridad explícita reciben prioridad «media» por defecto (C21) | Aprobada |


### 1.5 Cuarta tanda (v1.4)
| # | Decisión | Estado |
|---|---|---|
| D3-16 | Completar una sesión antes de su duración la guarda como parcial y no genera punto; cancelar descarta la sesión | Aprobada |
| D3-15(a) | Un temporizador pausado sigue ocupando el temporizador global hasta completar o cancelar | Aprobada |
| D3-21a | Descanso corto sugerido; descanso largo sugerido tras cuatro ciclos. El usuario decide iniciar u omitir cualquiera de los descansos; no hay inicio automático | Aprobada |
| D3-13 | Sin conexión no se pueden iniciar temporizadores; sí se permiten registros manuales de hábitos en la cola local para sincronizar al reconectar | Aprobada |
| D3-15(c) | El tiempo de un temporizador de hábito que cruza medianoche se distribuye entre las ocurrencias de cada fecha, usando America/Bogota como zona horaria | Aprobada |
| D3-2 | Un compromiso completado tarde se atribuye al período de su fecha límite y conserva su fecha real de cumplimiento | Aprobada |
| D3-20 | Execution conserva la fecha real de cumplimiento para distinguir período de atribución y momento efectivo de finalización | Aprobada en su regla funcional; la estrategia técnica de historial/auditoría se define en 3.0 |
| D3-6 | Los nuevos hábitos se gestionan en una interfaz nueva; Salud heredado permanece sin modificaciones | Aprobada |
| D3-8 | No usar Supabase Realtime inicialmente; refrescar al recuperar el foco y mediante sincronización periódica | Aprobada |



### 1.6 Quinta tanda (v1.5)
| # | Decisión | Estado |
|---|---|---|
| D3-21b | Solo las sesiones Focus completas cuentan como ciclo. El contador se reinicia cuando se completa u omite el descanso largo. Las sesiones parciales/canceladas no cuentan; cambiar de día no reinicia el contador | Aprobada |
| D3-22 | Los cambios de fecha límite conservan historial. Si se cambia antes del vencimiento, rige la nueva fecha; si se cambia después, el incumplimiento ocurrido no se elimina retroactivamente | Aprobada |
| D3-23 | El tiempo de hábito que cruza medianoche se divide por fecha local `America/Bogota`; solo se acredita en fechas con ocurrencia programada. El segmento en fecha no programada se ignora, no se traslada. Ejemplo: si viernes está programado y sábado no, el segmento del sábado no se acredita | Aprobada |
| D3-24 | La cola offline registra secuencias y dependencias por dispositivo, detecta concurrencia y la resuelve mediante reglas explícitas; no se decide solo por orden de llegada | Aprobada en el principio funcional; reglas concretas de reconciliación se diseñan y validan en 3.0 |

### 1.7 Sexta tanda (v1.6) — aprobada por el usuario
| ID | Decisión | Estado |
|---|---|---|
| D3-1 | Los hitos sin fecha quedan excluidos de Execution hasta que tengan fecha, igual que los pendientes | Aprobada |
| D3-3 | La ocurrencia de hoy se incluye en Wellbeing diario y se identifica como «día en curso»; no se trata como día cerrado | Aprobada |
| D3-7 | Las sesiones Productivity aportan a Balance, pero no aumentan directamente Execution. Execution sigue midiendo compromisos e hitos | Aprobada |
| D3-10 | La prioridad del día incluye compromisos vencidos, compromisos que vencen hoy y elementos fijados manualmente | Aprobada |
| D3-11 | Focus incluye preferencias mínimas dentro de su propia interfaz en la subfase 3.2; no requiere una pantalla general nueva de ajustes | Aprobada |
| D3-19a | En períodos abiertos, el denominador de Balance se limita al objetivo prorrateado de los días transcurridos y elegibles | Aprobada |
| D3-19b | Una semana sin objetivos configurados muestra «Sin objetivo»; no hereda objetivos de semanas anteriores | Aprobada |

### 1.8 Octava tanda (v1.8): aprobaciones de diseño de la auditoría 3.0
Fuente: `docs/AUDITORIA-3.0.md` §11. Estas aprobaciones son de **diseño**, no de ejecución.

| ID | Decisión | Estado |
|---|---|---|
| P1 | Esquema aditivo de la auditoría. Se prepara el SQL completo; **no se ejecuta** | Aprobada |
| P2 | Exclusividad del temporizador con la tabla `temporizador_activo`, una fila por usuario | Aprobada |
| P3 | Las sesiones canceladas se conservan con estado `cancelada`, sin puntos | Aprobada |
| P4 | Disparadores que registran cambios relevantes de `pendientes` e `hitos` sin modificar los módulos heredados | Aprobada |
| P5 | `prioridad` con `DEFAULT 'media' NOT NULL`, compatible con las inserciones actuales | Aprobada |
| P6 | Modelo de obligaciones. **Precisión:** un compromiso aplazado después de vencer conserva la obligación incumplida en su período original y genera una nueva evaluación para la fecha reprogramada. Ambas evaluaciones mantienen la identidad del compromiso original; no se crean dos compromisos independientes ni se pierde historial. Ejemplo: vence el lunes sin completarse; el martes se reprograma al viernes; el incumplimiento del lunes permanece; la nueva obligación se evalúa el viernes; ambas pertenecen al mismo pendiente. El cumplimiento tardío se atribuye al período de la obligación correspondiente, con fecha y hora reales | Aprobada con precisión |
| P7 | Reconciliación sin conexión | **Aprobación parcial** (ver abajo) |
| P8 | Los segmentos de tiempo de días sin ocurrencia programada se conservan pero no se acreditan | Aprobada |
| P9 | El contador de ciclos se deriva de las sesiones completadas. Si el usuario inicia otro Focus tras la sugerencia de descanso largo, se considera que omitió ese descanso. El reinicio sigue las reglas aprobadas | Aprobada |
| P10 | Correos como bloque secundario de Home; estado honesto para fuentes no conectadas; componente `Pendientes` heredado sin modificar hasta que su reemplazo esté verificado | Aprobada |
| P11 | Actividad reciente con las fuentes propuestas, sin finanzas y sin duplicar registros | Aprobada |
| P12 | Indicadores como funciones puras en `lib/domain`, con pruebas automatizadas | Aprobada |
| P13 | Estrategia de transacciones con `ROLLBACK` para probar restricciones | Aprobada como estrategia; **ejecución no autorizada** |
| P14 | Integración del asistente | Decisión pospuesta a la subfase 3.5 |
| P15 | Interfaz de objetivos semanales por frente dentro de la subfase 3.3 | Aprobada |

#### P7 aprobado
- Cola persistente en IndexedDB, aislada por usuario.
- Identificador único por operación.
- Secuencia por dispositivo y dependencias causales.
- Detección de operaciones concurrentes.
- Conservación de operaciones rechazadas, fusionadas o conflictivas.
- Resolución explícita de conflictos, sin descartar operaciones en silencio.
- Protección contra duplicidad de puntos y de registros de hábitos.

#### Orden aprobado para aplicar operaciones (P7)
1. Se respetan primero las dependencias causales conocidas.
2. Después se aplica la secuencia de operaciones de cada dispositivo.
3. Las operaciones concurrentes se resuelven mediante reglas explícitas.
4. La hora ajustada puede ser criterio auxiliar, pero nunca prevalece sobre una dependencia causal.
5. Los conflictos no resueltos se conservan y se notifican al usuario.

#### P7 no aprobado todavía
- La cota de desfase de reloj de 5 minutos.
- La tolerancia de 2 minutos hacia el futuro.
- El algoritmo definitivo de ordenamiento y de resolución de conflictos.
Deben justificarse con escenarios de prueba antes de una propuesta definitiva (`docs/PRUEBAS-FASE-3-v1.8.md`).

### 1.9 Límites de esta autorización
No se autoriza: ejecutar migraciones ni SQL de escritura; realizar pruebas contra Supabase (incluidas las transacciones con `ROLLBACK`); modificar tablas, columnas, funciones, disparadores, índices o políticas RLS; modificar autenticación, middleware, configuración, tareas programadas ni código de la aplicación; comenzar la subfase 3.1 ni ninguna otra de implementación. La prioridad es preservar los módulos heredados y que ninguna decisión se traduzca en cambios destructivos o pérdida de información.

## 2. Estado de aprobaciones y asuntos técnicos pendientes

No quedan decisiones funcionales pendientes. Las propuestas técnicas **no se consideran aprobadas** hasta que el usuario las apruebe expresamente. Las recomendaciones de este registro no son aprobaciones.

### 2.1 Estado
No quedan decisiones funcionales pendientes de aprobación. Permanecen pendientes:

1. Las partes no aprobadas de P7 (cota de reloj, tolerancia hacia el futuro, algoritmo definitivo).
2. Las decisiones técnicas T-1 a T-13 de `docs/DISENO-TECNICO-FASE-3-v1.8.md` §12.
3. La autorización expresa para ejecutar SQL, migraciones, pruebas contra la base de datos y cambios de código.

| ID | Tema | Recomendación (no aprobada) |
|---|---|---|
| T-1 | Escrituras de tablas sensibles solo mediante funciones RPC `SECURITY DEFINER` endurecidas | Aprobar, con `search_path` vacío, verificación de propietario y permisos revocados a `anon` |
| T-2 | Tolerancia de 2 s para decidir «completada» frente a «parcial» | Aprobar |
| T-3 | Cancelar un temporizador de hábito descarta solo el tramo en curso | Aprobar |
| T-4 | Efecto de eliminar un compromiso sobre obligaciones ya incumplidas | Conservar en historial; decidir si cuentan en Execution |
| T-5 | Desmarcar un cumplimiento ya atribuido | Conservar el evento; la obligación se reevalúa con el estado vigente |
| T-6 | Prioridad usada en una obligación | La vigente cuando llega la fecha límite |
| T-7 | Objetivos de semanas cerradas inmutables | Aprobar |
| T-8 | `cambios_registro` solo con lectura e inserción (excepción al patrón `propios`); sin registro cuando no hay usuario autenticado | Aprobar |
| T-9 | Valores y algoritmo de reloj (P7, no aprobados) | Decidir tras los escenarios de prueba |
| T-10 | Valores por defecto de avisos y sonido | Avisos activados; sonido activado |
| T-11 | Validar el SQL en una base local desechable, sin tocar Supabase | **Ejecutada** el 9 nov con PostgreSQL 16 local, bajo autorización del usuario; no equivale a aprobar el SQL |
| T-12 | En el cuarto ciclo, ¿la sugerencia larga reemplaza a la corta? | Sí, reemplaza |
| T-13 | `modo_registro` como método principal; el registro manual siempre disponible; manual en fecha sin ocurrencia se rechaza con aviso | Aprobar |`n`nDetalle de cada decisión (problema, impacto, riesgos, dependencias y consecuencias): `docs/REVISION-DECISIONES-T-FASE-3-v1.8.md`. Hallazgos de la validación local pendientes de decisión: **T-8b** (historial insertable por el cliente) y el cambio de firma de `habito_crear` por idempotencia.

D3-20 queda funcionalmente resuelta: el período de atribución es el de la fecha límite aplicable y se conserva `hecho_en` (o evento equivalente) como fecha real de cumplimiento. D3-22 obliga a preservar cambios de vencimiento y los incumplimientos ya ocurridos. La 3.0 debe proponer el modelo de eventos y resolver casos de múltiples cambios sin borrar historia.

## 3. Contradicciones detectadas y su resolución

### 3.1 De la primera tanda (v1.1)
| # | Contradicción | Resolución |
|---|---|---|
| C1 | «No eliminar rutas o módulos» y «no modificar módulos heredados sin autorización» frente a Home reemplazando Mi día | La decisión autoriza la ruta `/`. No se borra código ni funcionalidad; la pantalla actual no se retira hasta que sus funciones estén integradas o reubicadas |
| C2 | Wellbeing por conteo de ocurrencias frente a Wellbeing por tiempo | Se reemplaza la fórmula por tiempo con tope por ocurrencia |
| C3 | Hábitos «configurados por el usuario» y modelo actual por conteo (`veces_semana`, `objetivo_dia`) | El modelo no alcanza; se propondrá esquema nuevo con aprobación. Tablas vacías: no hay migración |
| C4 | Persistencia «recuperable» sin fuente definida y localStorage como arranque sugerido | Supabase es la fuente. localStorage nunca decide el estado |
| C5 | Notificaciones «según preferencias» frente a preferencias sincronizadas | Preferencias en Supabase; el permiso del navegador es por dispositivo |
| C6 | «Productivity puede contribuir a la ejecución» frente a una fórmula que solo usa compromisos e hitos | Cerrada en v1.6: Productivity contribuye a Balance, pero no directamente a Execution |
| C7 | «No todo necesita Pomodoro» frente a temporizador de hábitos | Coherente: tiempo de hábitos solo alimenta Wellbeing, nunca puntos de atención |
| C8 | Prioridad manual (§3.5) y pesos por prioridad (§5.2) frente a `pendientes` sin campo de prioridad | El mismo campo sirve a ambos fines. Falta la columna (propuesta de esquema) |
| C9 | Pendientes editables en Mi día frente a Home en `/` | Las funciones de pendientes deben existir en Home antes de retirar la pantalla actual |

### 3.2 De las tandas v1.2 y v1.3
| # | Contradicción | Resolución |
|---|---|---|
| C10 | v1.1: «sin conexión no se inician sesiones» frente a B3 (operaciones pendientes) | Cerrada en v1.4: se encolan cambios de temporizadores ya iniciados online; no se permite iniciar offline y sí se permiten registros manuales de hábitos en cola |
| C11 | v1.1: «no dos sesiones de Focus activas» frente a B1 (un temporizador global) | Se generaliza: un solo temporizador activo, de cualquier tipo, garantizado en el servidor |
| C12 | v1.1: «el registro manual corrige» y «no alterar datos históricos» frente a B2 («reemplaza») | El reemplazo no borra nada: cada cambio queda en un historial con valor anterior, nuevo, fuente, hora y dispositivo |
| C13 | v1.1: «las marcas de tiempo son las del servidor» frente a operaciones hechas sin conexión | Cada operación lleva hora del dispositivo; el servidor la valida contra su hora de recepción y, fuera de tolerancia, usa la suya y lo indica |
| C14 | v1.1: «localStorage no es fuente» frente a una cola local de operaciones | La cola local solo guarda operaciones pendientes. El estado oficial sigue siendo Supabase. Se declara que borrar datos del navegador pierde lo no sincronizado |
| C15 | Pesos por prioridad para hitos, que hoy no tienen prioridad y dependen de una meta | B4: prioridad propia por hito, sin herencia. Falta la columna (propuesta de esquema) |
| C16 | «Registros independientes» (A5) frente a «un solo temporizador global» (B1) | No chocan: los registros son separados y solo comparten la regla de exclusividad |
| C17 | D3-12 pendiente sobre el nombre de la navegación | Cerrada por B5: «Home» |
| C18 | Balance se define con objetivos semanales, pero se muestran vistas diarias y mensuales | Cerrada en v1.3: prorrateo diario y mensual del objetivo semanal; el mensual suma las fracciones de los días del mes, incluyendo semanas parciales. Los períodos abiertos se prorratean según días transcurridos y elegibles (D3-19a, v1.6) |
| C19 | El temporizador de descanso podría quedar fuera de la exclusividad global | Cerrada en v1.3: el descanso ocupa el mismo temporizador global y bloquea el inicio de otro temporizador |
| C20 | El valor manual de hábito seguido de temporizador podía reemplazarse o acumularse | Cerrada en v1.3: el temporizador acumula sobre el valor manual vigente, manteniendo historial |
| C21 | Los módulos heredados no solicitan prioridad al crear pendientes e hitos | Cerrada en v1.3: se asigna «media» automáticamente cuando no se proporciona prioridad |

### 3.3 De la tanda v1.4
| # | Contradicción | Resolución |
|---|---|---|
| C22 | El modo sin conexión podía permitir iniciar temporizadores sin garantizar exclusividad global | Cerrada: no se permite iniciar temporizadores offline; sí se encolan registros manuales de hábitos |
| C23 | El tiempo de hábitos que cruza medianoche podía atribuirse a una sola fecha | Cerrada: se divide por fecha local `America/Bogota` y se asigna a cada ocurrencia correspondiente |
| C24 | La fecha límite y la fecha real de cumplimiento se confundían en Execution | Cerrada funcionalmente: atribuir al período de fecha límite y conservar la fecha real de cumplimiento; la auditoría técnica se define en 3.0 |
| C25 | El comportamiento de pausa y finalización parcial no estaba definido | Cerrada: pausa mantiene la exclusividad; completar antes de tiempo guarda parcial sin punto; cancelar descarta |
| C26 | Descansos podían iniciarse automáticamente o no tener control explícito | Cerrada: corto sugerido y largo sugerido tras cuatro ciclos; el usuario decide iniciar u omitir. El reinicio del contador se define en D3-21b (v1.5) |
| C27 | El modelo nuevo de hábitos podía alterar Salud heredado | Cerrada como restricción funcional: interfaz nueva y Salud heredado sin modificaciones |
| C28 | La actualización entre dispositivos dependía de Realtime aún no decidido | Cerrada: sin Realtime inicial; refresco al recuperar foco y sincronización periódica |


### 3.4 De la tanda v1.5
| # | Contradicción | Resolución |
|---|---|---|
| C29 | La regla anterior atribuía todo el tiempo de hábito a una sola ocurrencia pese al cruce de medianoche | Cerrada: dividir en segmentos por fecha local; acreditar solo segmentos de fechas con ocurrencia programada; ignorar los demás |
| C30 | La fecha límite actual podía sobrescribir la evidencia de un vencimiento anterior | Cerrada funcionalmente: conservar cada cambio y no borrar retroactivamente el incumplimiento ya ocurrido |
| C31 | La regla de conflictos offline por orden de llegada podía rechazar eventos que causalmente ocurrieron antes en otro dispositivo | Cerrada en principio: secuencias y dependencias por dispositivo, detección de concurrencia y reglas explícitas de reconciliación por definir en 3.0 |
| C32 | El contador Pomodoro no definía sesiones parciales, omisión del descanso largo ni cambio de día | Cerrada: solo sesiones completas cuentan; reinicio al completar u omitir descanso largo; cambio de día no reinicia |

**Nota de alcance D3-24:** queda aprobada la estrategia funcional de secuencia causal y detección de concurrencia. No queda aprobada una política concreta de «gana X» para cada conflicto ni una regla de fusión para dos registros manuales de la misma ocurrencia. La 3.0 debe proponerlas y solicitar aprobación antes de implementar.

### 3.5 De la tanda v1.8
| # | Contradicción | Resolución |
|---|---|---|
| C33 | Auditoría §9.2 ordenaba las operaciones concurrentes por hora ajustada; P7 exige respetar antes dependencias causales y secuencia por dispositivo | Cerrada por P7: la hora ajustada es solo criterio auxiliar y no prevalece sobre una dependencia causal |
| C34 | Auditoría §7 hablaba de «dos obligaciones» por un aplazamiento, lo que podía leerse como dos compromisos | Cerrada por P6: una sola identidad de compromiso con varias evaluaciones, cada una con su resultado |
| C35 | D3-16 dice que cancelar «descarta» la sesión; P3 pide conservarla | Cerrada: «descarta» significa excluida de los cálculos y sin puntos; la fila se conserva con estado `cancelada` |
| C36 | D3-21b habla de «omitir» el descanso, pero no decía si iniciar otro Focus lo es | Cerrada por P9: iniciar otro Focus tras la sugerencia de descanso largo cuenta como omitirlo |
| C37 | «El incumplimiento no se elimina» (D3-22) frente a que los módulos heredados pueden borrar el compromiso | Parcial: el historial se conserva con una instantánea al eliminar (P4); si esas obligaciones cuentan en Execution queda pendiente (T-4) |
