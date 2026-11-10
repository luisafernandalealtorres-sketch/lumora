# SECOND BRAIN
## Especificación funcional — Fase 3: Home, Focus Mode y Life Pulse

**Versión:** 1.11.1 (consolida la v1.11 con las decisiones y cambios aprobados al cerrar la tercera entrega de implementación; la v1.11 y las anteriores se conservan sin cambios)
**Fecha:** 9 nov 2026
**Estado:** decisiones funcionales hasta v1.7, aprobaciones de diseño P1 a P15 y decisiones técnicas T-1 a T-13 incorporadas (T-6 aprobada con su interpretación) más T-7b-1, T-7b-3 y T-8c, **salvo T-9, que sigue pendiente**. **No está autorizada ninguna ejecución en Supabase** (SQL, migraciones, reversiones, consultas a producción) ni el inicio de la 3.1 sin aprobación expresa.
**Alcance de esta versión:** documentación. La implementación de las entregas 1 a 3 (temporizador global, hábitos, objetivos, Balance, Execution y Life Pulse) existe en `web/` y se validó en un PostgreSQL local desechable; **no se ejecutó nada en Supabase** ni se modificaron sus tablas, RLS, autenticación ni configuración.

Documentos relacionados:
- `docs/DECISIONES-FASE-3-v1.11.1.md`: registro de decisiones aprobadas y pendientes, y lista de contradicciones con su resolución.
- `docs/REVISION-CONSISTENCIA-FASE-3-v1.11.md`: revisión de consistencia entre fórmulas, comportamiento y esquema actual.
- `docs/AUDITORIA-3.0.md`: auditoría de datos y arquitectura (solo lectura, 9 nov 2026).
- `docs/DISENO-TECNICO-FASE-3-v1.11.1.md`: diseño detallado del esquema, relaciones, restricciones, disparadores, funciones RPC, obligaciones, cola sin conexión, riesgos y decisiones técnicas pendientes.
- `docs/MIGRACIONES-FASE-3-v1.11.md`: SQL propuesto por etapas con reversión. **No ejecutado.**
- `docs/PRUEBAS-FASE-3-v1.11.md`: escenarios de prueba. La capa local se ejecutó sobre el SQL v1.8; el resto **no se ha ejecutado**.
- `docs/REVISION-DECISIONES-T-FASE-3-v1.11.md`: análisis de las decisiones T-1 a T-13 y su estado.
- `docs/VALIDACION-LOCAL-FASE-3-v1.11.md`: evidencia de la validación en PostgreSQL local (no es evidencia de Supabase).
- `docs/RESUMEN-CAMBIOS-FASE-3-v1.11.1.md`: resumen de cambios y pendientes de la v1.11.
- `docs/MATRIZ-PRUEBAS-T7-T8B-FASE-3-v1.11.md`: matriz de pruebas locales de T-7 y T-8b (v1.11: ejecutada en PostgreSQL local; ver el informe de validación).
- `docs/ANALISIS-ETAPA-0-FASE-3-v1.11.md`: análisis corregido de la etapa 0.
- `docs/RIESGOS-PENDIENTES-FASE-3-v1.11.md`: riesgos pendientes.
- `docs/REVISION-PREVIA-FASE-3.md`: revisión inicial del estado del proyecto.

Marcas de versión: **[v1.1]** primera tanda; **[v1.2]** segunda tanda; **[v1.3]** decisiones sobre Balance por período, descanso, acumulación de hábitos y prioridad por defecto; **[v1.4]** decisiones sobre sesiones parciales, pausas, descansos sugeridos, modo sin conexión, cruce de medianoche, cumplimiento tardío, gestión de hábitos y sincronización sin Realtime; **[v1.5]** historial de fechas límite, segmentos de hábitos solo en días programados, conflictos offline con secuencias causales por dispositivo y reinicio del contador Pomodoro; **[v1.6]** cierre de las siete decisiones funcionales restantes; **[v1.7]** consolidación documental; **[v1.8]** aprobaciones de diseño P1 a P15 de la auditoría 3.0, con las precisiones de P6 y P7; **[v1.9]** decisiones técnicas T-1 a T-13 (T-9 pendiente); **[v1.10]** revisión correctiva: etapa 0 rediseñada, matriz de pruebas de T-7 y T-8b; **[v1.11]** aprobación de T-6 (prioridad vigente al cierre del día de vencimiento), T-7b-1, T-7b-3 y T-8c, e incorporación al SQL con validación local. Lo no marcado se conserva de la v1.0 aprobada.

**Regla de lectura:** en esta especificación una recomendación **no es una decisión**. Las decisiones pendientes (§13) se redactan de forma neutra o con la regla de la v1.0, nunca como aprobadas.

---

## 0. Resumen de cambios

**v1.11 — cierre documental y validación local:** incorpora las decisiones aprobadas **T-6** (prioridad vigente al cierre del día de vencimiento en America/Bogota), **T-7b-1** (el disparador de objetivos no actúa en disparadores anidados), **T-7b-3** (el lunes de la semana se calcula con una función que recibe el instante) y **T-8c** (`REVOKE ALL` y concesión explícita en las tablas de solo lectura). El SQL se actualizó y se validó en un PostgreSQL 16 local y desechable (resultados en `docs/VALIDACION-LOCAL-FASE-3-v1.11.md`). **T-9 sigue pendiente.** **No se ejecutó nada en Supabase.** Las v1.8, v1.9 y v1.10 se conservan intactas.

**v1.11.1 — cierre de la tercera entrega:** aprueba **D3-25** (obligaciones que vencen hoy en Execution, §5.2), la **consistencia entre períodos diarios, semanales y mensuales**, el **filtro de frente (?frente=) aplicado solo a Balance** (en Life Pulse y en Atención) y la **exclusión de Execution y Wellbeing del filtro** mientras no exista una regla de asignación por frente, y los ajustes visuales de Life Pulse. **T-9 sigue pendiente.** La v1.11 se conserva como versión histórica.

**v1.10 — revisión correctiva (histórico):** rediseñó la etapa 0 (el criterio de `auth.uid()` se comprueba por comportamiento), preparó la matriz de pruebas de T-7 y T-8b y actualizó H-12 a `permission denied`. Sin ejecutar SQL.

**v1.9 — decisiones técnicas T-1 a T-13:** incorpora las decisiones aprobadas el 9 nov (T-9 queda pendiente), el historial de solo lectura para el cliente, la inmutabilidad de objetivos de semanas cerradas, las reglas de obligaciones (T-4, T-5, T-6) y la condición de verificar roles y permisos antes de ejecutar en Supabase. **No autoriza ninguna ejecución.** La v1.8 se conserva intacta.

**v1.8 — diseño de la auditoría 3.0:** incorpora las aprobaciones P1 a P15 (con las precisiones de P6 y P7), corrige rótulos de versión y duplicaciones, y remite el diseño detallado a `docs/DISENO-TECNICO-FASE-3-v1.11.1.md`. **Aprueba diseño, no ejecución: no autoriza SQL, migraciones, pruebas contra la base de datos ni cambios de código.**

**v1.7 — consolidación documental (conservada):** corrige referencias, encabezados y duplicaciones de v1.6; explicita casos de Balance sin objetivo y el carácter histórico de la auditoría de datos. **No introduce nuevas decisiones funcionales ni autoriza implementación.**

### 0.1 Decisiones aprobadas que se incorporan

| Tanda | Decisión | Dónde |
|---|---|---|
| v1.1 | Home reemplaza a Mi día en `/` | §3.8 |
| v1.1 | Pendientes sin fecha límite quedan fuera de Execution | §5.2 |
| v1.1 | Hábitos con frecuencia, duración objetivo y registro manual o por temporizador; Wellbeing mide tiempo | §5.4 |
| v1.1 | Supabase es la fuente de verdad de Focus Mode; sincronización entre dispositivos | §4.3, §4.7 |
| v1.1 | Focus Mode y temporizadores de hábitos con registros independientes | §4.8 |
| **v1.2** | Un solo temporizador activo globalmente (Focus o hábito) | §4.7, §4.8 |
| **v1.2** | El temporizador acumula; el registro manual reemplaza el acumulado; se conservan fuente e historial | §5.4.2 |
| **v1.2** | Modo sin conexión con operaciones pendientes y resolución de conflictos | §4.9 |
| **v1.2** | Cada hito tiene prioridad propia (alta, media, baja; pesos 3, 2, 1), sin heredar de la meta | §5.2 |
| **v1.2** | El centro de control se llama Home y ocupa `/` | §3.8 |
| **v1.3** | Balance diario y mensual prorratean proporcionalmente el objetivo semanal | §5.3 |
| **v1.3** | El temporizador de descanso ocupa el temporizador global | §4.4, §4.7 |
| **v1.3** | El temporizador de hábito acumula sobre un registro manual vigente | §5.4.2 |
| **v1.3** | Prioridad por defecto «media» para nuevos pendientes e hitos sin prioridad explícita | §5.2 |
| **v1.4** | Sesión parcial sin punto; pausa conserva exclusividad; descansos sugeridos con decisión del usuario | §4.4, §4.6, §4.7 |
| **v1.4** | Sin conexión: no iniciar temporizadores; permitir registros manuales de hábitos en cola | §4.9 |
| **v1.4** | Tiempo de hábito que cruza medianoche se distribuye entre fechas | §5.4.2 |
| **v1.4** | Cumplimiento tardío se atribuye al período de fecha límite y conserva fecha real | §5.2 |
| **v1.4** | Hábitos nuevos en interfaz independiente; Salud heredado sin cambios | §5.4.1 |
| **v1.4** | Sin Realtime inicial; refresco al recuperar foco y periódicamente | §4.7 |
| **v1.5** | Cambios de fecha límite conservan historial y no borran incumplimientos ya ocurridos | §5.2, §11 |
| **v1.5** | Segmentos de tiempo de hábito solo se acreditan en fechas con ocurrencia programada; segmentos en días no programados se ignoran | §5.4.2 |
| **v1.5** | Operaciones offline usan secuencias y dependencias por dispositivo; el servidor detecta concurrencia y aplica reglas explícitas | §4.9 |
| **v1.5** | Solo sesiones Focus completas cuentan como ciclo; el contador se reinicia al completar u omitir el descanso largo | §4.4 |
| **v1.8** | Esquema aditivo (P1); temporizador global con una fila por usuario, `temporizador_activo` (P2); sesiones canceladas conservadas con estado `cancelada` y sin puntos (P3); historial por disparadores sin modificar módulos heredados (P4); `prioridad` con `DEFAULT 'media' NOT NULL` (P5) | §4.6, §4.7, §5.2, §11 |
| **v1.8** | Obligaciones con la misma identidad del compromiso (P6); segmentos sin ocurrencia conservados sin acreditar (P8); contador derivado y omisión implícita del descanso largo (P9) | §4.4, §5.2, §5.4.2 |
| **v1.8** | Correos como bloque secundario de Home y `Pendientes` heredado intacto (P10); actividad reciente sin finanzas ni duplicados (P11); indicadores como funciones puras con pruebas (P12); objetivos semanales en 3.3 (P15) | §3.6, §3.8, §10 |
| **v1.8** | Cola sin conexión en IndexedDB, con orden por dependencias causales y reglas explícitas (P7, **aprobación parcial**) | §4.9 |
| **v1.9** | Funciones SECURITY DEFINER endurecidas, con ejecución en Supabase condicionada a verificar roles y permisos (T-1); tolerancia de 2 s (T-2); cancelar un temporizador de hábito conserva los segmentos cerrados (T-3) | §5.4.2, §9 |
| **v1.9** | Obligaciones: las que ya llegaron permanecen y las futuras se descartan (T-4); desmarcar reevalúa la obligación vigente y conserva las sustituidas (T-5); prioridad en la fecha de vencimiento (T-6; aprobada con su interpretación en la v1.11) | §5.2 |
| **v1.9** | Objetivos de semanas anteriores inmutables (T-7); historial de solo lectura para el cliente (T-8, T-8b) | §5.3, §9 |
| **v1.9** | Sonido y avisos activados por defecto con aviso al usuario (T-10); descanso largo con prioridad sobre el corto tras 4 ciclos (T-12); registro manual rechazado sin ocurrencia (T-13); habito_crear idempotente | §4.4, §4.5, §5.4 |
| **v1.11** | Prioridad vigente al cierre del día de vencimiento (T-6), reconstruida desde el historial; los cambios posteriores no alteran el peso histórico | §5.2 |
| **v1.11** | Protección de objetivos: no actúa en disparadores anidados (T-7b-1); lunes de la semana con función parametrizada por instante (T-7b-3) | §5.3 |
| **v1.11** | Higiene de privilegios: `REVOKE ALL` y concesión explícita en tablas de solo lectura, sin `TRUNCATE`, `REFERENCES` ni `TRIGGER` residuales (T-8c) | §9 |

### 0.2 Estado de decisiones funcionales
Las siete decisiones funcionales D3-1, D3-3, D3-7, D3-10, D3-11, D3-19a y D3-19b quedaron aprobadas en v1.6 (§13.5). D3-2, D3-6, D3-8, D3-13, D3-14, D3-15(a), D3-15(b), D3-15(c), D3-16, D3-20, D3-21b, D3-22, D3-23 y el principio funcional D3-24 quedan cerradas en v1.6 o antes. **[v1.11]** T-1 a T-13 (con T-6, T-7b-1, T-7b-3 y T-8c) quedan aprobadas **salvo T-9**, que sigue pendiente junto con las partes de P7 no aprobadas (cota de desfase de reloj, tolerancia hacia el futuro y algoritmo definitivo de ordenamiento y resolución de conflictos): no se implementan umbrales hasta realizar la simulación. Siguen pendientes las autorizaciones de ejecución.

### 0.3 Contradicciones
La lista completa (C1 a C48) y su resolución están en `docs/DECISIONES-FASE-3-v1.11.1.md`.

---

## 1. Objetivo de la fase

Construir una experiencia Home que permita al usuario:

1. Comprender rápidamente el estado de sus áreas de vida.
2. Elegir en qué concentrarse y comenzar una sesión de trabajo o disfrute.
3. Consultar su evolución mediante Life Pulse.
4. Visualizar cómo distribuye su atención entre sus seis frentes.
5. Gestionar sus prioridades diarias.
6. Recibir recomendaciones contextuales de la IA sin perder el control sobre sus decisiones.

Home debe funcionar como un centro de control ejecutivo y personal, no como un simple dashboard de estadísticas. **[v1.1]** Home es la pantalla de la ruta `/` y sustituye a Mi día.

## 2. Principios funcionales

- No utilizar datos ficticios en producción.
- Un indicador sin información suficiente debe mostrar «Sin datos», nunca cero.
- Cada indicador debe explicar su período, fuente y fórmula.
- Identificar expresamente los indicadores con información parcial.
- No inferir diagnósticos médicos o psicológicos.
- La IA puede analizar y proponer, pero no modificar registros sin aprobación.
- Los seis frentes son una dimensión transversal de organización, no secciones de navegación.
- El sistema debe funcionar en escritorio y móvil, en tema claro y oscuro.
- No modificar autenticación, middleware, RLS ni módulos heredados sin autorización explícita. **[v1.1]** Excepción autorizada: la ruta `/` pasa de Mi día a Home (§3.8).
- **[v1.1]** No eliminar funcionalidades ni código existentes sin autorización.
- **[v1.1]** Supabase es la fuente de verdad de los datos de Focus Mode y de los hábitos. El almacenamiento del navegador nunca decide el estado definitivo.
- **[v1.2]** Un solo temporizador activo a la vez; ni puntos de atención ni tiempo de hábitos pueden duplicarse.

## 3. Home: estructura funcional

### 3.1 Bienvenida y contexto diario

Mostrar:
- Saludo contextual.
- Fecha actual, considerando la zona horaria `America/Bogota`.
- Resumen breve del día.
- Acceso a las prioridades diarias.

No generar resúmenes basados en información inexistente.

### 3.2 Focus Mode

Es uno de los dos protagonistas visuales de Home, junto con Life Pulse.

Debe permitir iniciar rápidamente una sesión en dos modalidades:

**Productivity**
- Trabajo, avance y cumplimiento de objetivos.
- Productivity y Enjoyment contribuyen al Balance. Productivity no aumenta directamente Execution, que se calcula solo con compromisos e hitos (D3-7, aprobada en v1.6).
- No se contabiliza como tiempo de disfrute.

**Enjoyment**
- Entretenimiento, hobbies y actividades creativas.
- Contribuye al balance de atención y al registro de tiempo de disfrute.
- No contribuye al indicador de ejecución.
- Nunca debe convertirse en una cuota, obligación o requisito mínimo.

Ambas modalidades utilizan el mismo sistema de temporizador y pueden asociarse a cualquiera de los seis frentes.

### 3.3 Life Pulse expandido

Mostrar tres indicadores independientes:

1. Execution.
2. Balance.
3. Wellbeing.

Cada indicador debe permitir consultar períodos diario, semanal y mensual, mostrar tendencias y acceder al detalle de sus datos.

No crear inicialmente una puntuación global que combine los tres indicadores.

### 3.4 Distribución por frentes

Mostrar cómo se distribuye la atención entre:

- TANKU.
- TICKETCODE.
- Personal.
- Salud.
- Familia.
- Otros proyectos.

La visualización debe permitir identificar la atención registrada frente al objetivo configurado para cada frente.

Los frentes sin objetivo configurado no deben distorsionar el cálculo.

### 3.5 Prioridades diarias

Permitir visualizar y gestionar las prioridades del día.

- Las prioridades son asignadas manualmente por el usuario.
- Su importancia se define mediante prioridad alta, media o baja.
- La IA puede sugerir prioridades, pero no asignarlas automáticamente.
- Las prioridades pueden relacionarse con un frente.
- El usuario conserva el control sobre su estado y orden.
- La prioridad del día incluye compromisos vencidos, compromisos que vencen hoy y elementos fijados manualmente (D3-10, aprobada en v1.6).

### 3.6 Actividad reciente

Se contempla un espacio para mostrar actividad reciente relevante, siempre que existan registros reales y fuentes verificadas.

No debe generar eventos ficticios ni duplicar registros de otras secciones.

**[v1.8, P11]** Fuentes aprobadas: sesiones Focus completadas, pendientes completados, notas, biblioteca, jornadas y tiempo de hábitos. Se excluye finanzas. Cada registro aparece una sola vez, bajo su propio tipo, sin duplicar los de otras secciones.

### 3.7 Asistente IA

El acceso al asistente debe permanecer disponible desde Home y el resto de la aplicación.

Comportamiento:
- Analiza información contextual disponible.
- Identifica patrones y posibles desequilibrios.
- Sugiere acciones o prioridades.
- Explica por qué realiza una recomendación.
- Espera aprobación antes de ejecutar acciones.

No simular respuestas, acciones ni integraciones que todavía no existan.

### 3.8 Home en lugar de Mi día **[v1.1, v1.2]**

- El centro de control se denomina **Home** y ocupa la ruta `/`. **[v1.2]** El elemento de navegación (barra lateral y barra inferior móvil) pasa a llamarse «Home».
- Mi día hoy ofrece: agenda de hoy, correos por revisar, pendientes (crear, marcar, borrar, asociar a una meta), resumen del día y avance por frente.
- La subfase 3.0 audita cada función y propone si se **integra en Home**, se **reubica** o queda **pendiente de decisión**, con su fuente de datos.
- **[v1.2]** Las funcionalidades actuales de Mi día se mantienen hasta que estén integradas o reubicadas. No se elimina código ni funcionalidad sin autorización. La pantalla actual no se retira hasta que cada función tenga un equivalente verificado.
- El cambio de nombre en la navegación afecta al shell de la Fase 2 (y a sus pruebas). Es consecuencia directa de esta decisión y se ejecuta en 3.1.
- Las tareas programadas existentes (`tablero-mi-dia`, `recordatorio-jornada`) no se modifican sin autorización.
- **[v1.8, P10]** Home incorpora los correos como **bloque secundario**. Las fuentes que todavía no estén conectadas (agenda, correos, resumen del día) muestran su estado honesto, no «sin eventos». El componente `Pendientes` heredado se conserva **sin modificarlo** dentro de Home hasta que su reemplazo esté verificado.

---

## 4. Focus Mode: especificación funcional

### 4.1 Configuración inicial

| Parámetro | Valor inicial |
|---|---:|
| Enfoque | 30 minutos |
| Descanso corto | 5 minutos |
| Descanso largo | 20 minutos |
| Ciclos para sugerir descanso largo | 4 |

Todos estos parámetros podrán configurarse desde las preferencias mínimas de Focus, integradas en su propia interfaz en 3.2 (D3-11, aprobada en v1.6). **[v1.1]** Las preferencias se guardan en Supabase y se sincronizan entre dispositivos.

### 4.2 Flujo de sesión

1. Seleccionar Productivity o Enjoyment.
2. Seleccionar un frente.
3. Asociar una actividad o intención.
4. Iniciar el temporizador.
5. Completar, pausar o cancelar la sesión.
6. Registrar el resultado y actualizar los indicadores correspondientes.

El usuario podrá iniciar una sesión desde Home, una tarea o una actividad.

### 4.3 Controles del temporizador

- Iniciar.
- Pausar.
- Reanudar.
- Completar.
- Cancelar.

La pausa conserva el tiempo restante y permite continuar posteriormente.

El temporizador debe recuperarse después de una recarga o navegación utilizando marcas de tiempo, no dependiendo de un intervalo activo en una pestaña.

**[v1.1]** Las marcas de tiempo registradas en Supabase determinan el estado. El tiempo restante se calcula a partir de ellas (inicio, pausas, reanudaciones), no del reloj de un dispositivo en particular. **[v1.2]** Excepción regulada: operaciones hechas sin conexión (§4.9).

### 4.4 Descansos

- Descanso corto de cinco minutos.
- Después de cuatro ciclos completados, sugerir un descanso largo de veinte minutos.
- El descanso corto se sugiere al completar un ciclo; el descanso largo se sugiere tras cuatro ciclos completados. **[v1.9, T-12]** Después de cuatro ciclos completos, la sugerencia de descanso largo tiene prioridad sobre la de descanso corto (se sugiere solo el largo).
- Ningún descanso comienza automáticamente: el usuario decide si lo inicia u omite. La opción de posponer no está definida como control independiente en esta versión.
- Solo las sesiones Focus completadas cuentan para el contador de ciclos; las sesiones parciales y canceladas no cuentan.
- **[v1.6]** El contador se reinicia cuando el usuario completa u omite el descanso largo. Omitir el descanso corto no reinicia el contador. El cambio de día no lo reinicia.
- **[v1.8, P9]** El contador se **deriva** de las sesiones completadas posteriores al último descanso largo completado u omitido; no se guarda como valor. Si el usuario inicia otra sesión Focus después de recibir la sugerencia de descanso largo, se considera que **omitió** ese descanso.
- Los descansos no generan puntos de atención. **[v1.3]** El temporizador de descanso ocupa el temporizador global: mientras está activo no puede iniciarse un temporizador de Focus ni de hábito. **[v1.4]** El descanso es sugerido, no automático; al iniciarlo, mantiene la exclusividad global.

### 4.5 Persistencia y accesibilidad

El temporizador será persistente y estará disponible en todas las pantallas.

Debe:
- Mantenerse visible mediante un componente compacto.
- Permitir acceder a los controles principales.
- Conservar su estado al cambiar de ruta.
- Recuperar el estado después de recargar.
- Emitir una notificación o sonido al finalizar, según las preferencias disponibles.
- No interrumpir automáticamente al usuario durante una sesión.

La IA puede sugerir un cambio de actividad después de varias sesiones, pero nunca interrumpir el temporizador por iniciativa propia.

**[v1.1]** La preferencia de notificaciones (avisos, sonido) se sincroniza. El permiso de notificaciones del navegador es de cada dispositivo y se solicita en cada uno. Sin permiso, el aviso se muestra dentro de la aplicación. **[v1.9, T-10]** El sonido y las notificaciones están activados por defecto; cuando el navegador no permita utilizarlos (permiso denegado o reproducción automática bloqueada), la interfaz lo informa al usuario.

### 4.6 Registro de sesiones

Cada sesión debe contemplar:

- Frente.
- Modalidad: Productivity o Enjoyment.
- Actividad.
- Intención.
- Fecha y hora de inicio.
- Fecha y hora de finalización.
- Duración.
- Estado de la sesión.
- Puntos generados.

Una sesión completada genera un punto de atención.

**[v1.4]** Si el usuario completa una sesión antes de alcanzar la duración configurada, se guarda con estado «parcial» y no genera punto de atención. Si la cancela, la sesión se descarta de los cálculos y no genera punto. **[v1.8, P3]** La sesión cancelada se conserva con estado «cancelada», sin puntos.

Los puntos no se calculan proporcionalmente a los minutos: una sesión completada equivale a un punto, independientemente de su duración configurada.

**[v1.1]** Además se persisten los eventos de la sesión: inicio, cada pausa, cada reanudación y la finalización o cancelación, cada uno con su marca de tiempo.

**[v1.4]** Queda definida la diferencia: «parcial» conserva una sesión completada antes de tiempo; «cancelada» descarta la sesión sin punto.

### 4.7 Sincronización entre dispositivos y temporizador único **[v1.1, v1.2]**

- Supabase es la fuente de verdad de sesiones y preferencias.
- La misma sesión activa debe verse y poder controlarse desde portátil, tablet y celular.
- Al abrir la aplicación en otro dispositivo se recupera la sesión activa con su tiempo restante.
- **[v1.2, v1.3]** Solo puede existir **un temporizador activo globalmente por usuario**, ya sea de Focus Mode, un hábito o un descanso. Un temporizador pausado sigue ocupando ese lugar hasta completar o cancelar (D3-15(a), aprobada en v1.4). Si se intenta iniciar otro, la aplicación lo impide y muestra el temporizador que ya está activo. La regla se garantiza en el servidor, no solo en la interfaz. **[v1.8, P2]** El mecanismo es la tabla `temporizador_activo`, con una fila por usuario.
- Una sesión completada genera un solo punto aunque la acción de completar se envíe más de una vez o desde dos dispositivos (completar es idempotente).
- **[v1.4]** Los dispositivos reflejan los cambios de otro al recuperar el foco y mediante sincronización periódica. No se usará Supabase Realtime inicialmente.
- Las marcas de tiempo que deciden el estado son las del servidor, salvo lo regulado para operaciones sin conexión (§4.9).


### 4.8 Independencia respecto a los temporizadores de hábitos **[v1.1, v1.2]**

- Focus Mode y el temporizador de hábitos tienen registros, estados y controles **independientes**. Los descansos también tienen estado persistente y comparten la exclusividad global.
- Comparten únicamente la regla de exclusividad: un solo temporizador activo globalmente (§4.7).
- Focus Mode genera puntos de atención (Balance). El temporizador de hábitos registra duración para Wellbeing y **no** genera puntos de atención.
- Una sesión de Focus no se convierte automáticamente en tiempo de hábito, ni al revés.
- Una misma actividad no puede producir registros duplicados entre ambos sistemas: ni dos puntos de atención ni dos tiempos de hábito.

### 4.9 Modo sin conexión **[v1.2, v1.6]**

Principio: **Supabase sigue siendo la fuente de verdad.** Lo que se guarda en el dispositivo es una cola de operaciones pendientes, no el estado oficial.

**Qué se guarda localmente**
- Los cambios de una sesión o temporizador ya activo: pausar, reanudar, completar, cancelar (y finalizar, en un temporizador de hábito).
- Cada operación lleva: un identificador único generado en el dispositivo, el identificador del dispositivo, la sesión o temporizador al que pertenece, el tipo de operación, un número de secuencia por dispositivo y las dependencias causales conocidas (operaciones previas necesarias), además de la hora del dispositivo en que ocurrió. **[v1.6]**

**Qué hace el servidor al recibirlas**
- Reconstruye y valida el orden causal usando las secuencias y dependencias por dispositivo; aplica las operaciones idempotentemente. Una operación con identificador ya recibido se ignora, sin duplicar efectos, puntos ni tiempo. Detecta operaciones concurrentes de dispositivos distintos en vez de resolverlas solo por orden de llegada. **[v1.6]**
- Valida que la transición sea posible (por ejemplo, no se pausa una sesión ya completada).
- Valida la hora informada: no puede estar en el futuro ni antes del inicio de la sesión, y se compara con la hora de recepción. Si el reloj del dispositivo está fuera de una tolerancia (**valor sin aprobar**: P7 no aprueba todavía la cota de 5 minutos ni la tolerancia de 2 minutos; se justificarán con escenarios de prueba), el servidor usa su propia hora de recepción y lo indica como «hora ajustada».
- Registra siempre la operación en el historial, también cuando la rechaza.

**Reglas de conflicto**
1. Las operaciones dependientes se aplican respetando su secuencia causal por dispositivo. Una operación que depende de otra aún no recibida permanece pendiente hasta que se pueda validar su dependencia.
2. Las operaciones concurrentes de dispositivos distintos se detectan explícitamente; no se decide el resultado únicamente por orden de llegada. Las reglas concretas de resolución para cada transición y sus conflictos se diseñan y validan en 3.0 antes de implementar.
3. Un estado final (completada, cancelada) no puede duplicar efectos: una operación final contradictoria se conserva en el historial como conflicto y se informa al usuario; la política exacta para elegir o reconciliar estados concurrentes se define en 3.0.
4. Un punto de atención se emite como máximo una vez por sesión. Una sesión rechazada o duplicada no genera punto.
5. Los registros manuales concurrentes para la misma ocurrencia de hábito deben detectarse; la regla de reconciliación y prevención de doble contabilización se definirá en 3.0.
6. Ninguna operación pendiente se descarta en silencio: el usuario ve cuáles están «pendientes de sincronizar» y cuáles se resolvieron por conflicto.

**Orden de aplicación [v1.8, P7 parcial]**
1. Primero se respetan las **dependencias causales** conocidas.
2. Después se aplica la **secuencia** de operaciones de cada dispositivo.
3. Las operaciones **concurrentes** se resuelven mediante reglas explícitas.
4. La **hora ajustada** puede usarse como criterio auxiliar, pero nunca prevalece sobre una dependencia causal.
5. Los conflictos no resueltos se conservan y se notifican al usuario.

Aprobado: cola persistente en IndexedDB aislada por usuario; identificador único por operación; secuencia por dispositivo y dependencias causales; detección de concurrencia; conservación de operaciones rechazadas, fusionadas o conflictivas; resolución explícita sin descartes silenciosos; protección contra duplicidad de puntos y de registros de hábitos. **No aprobado todavía (T-9, pendiente hasta la simulación; no se implementan umbrales):** la cota de desfase de reloj, la tolerancia hacia el futuro y el algoritmo definitivo de ordenamiento y resolución de conflictos (ver `docs/DISENO-TECNICO-FASE-3-v1.11.1.md` §10 y `docs/PRUEBAS-FASE-3-v1.11.md`).

**Límites declarados**
- Si el usuario borra los datos del navegador antes de sincronizar, las operaciones pendientes se pierden. La aplicación debe advertirlo.
- Este mecanismo es un requisito funcional. Su diseño técnico detallado se valida en la subfase 3.0 y no se ejecuta ningún cambio de esquema sin aprobación.
- **[v1.9]** Cuando una RPC lanza una excepción, la transacción hace rollback y no deja fila en el diario de operaciones. La etapa 4 deberá registrar también las operaciones rechazadas, con su motivo, para no descartar nada en silencio.
- **[v1.4]** No se permite iniciar temporizadores sin conexión. Sí se permiten registros manuales de hábitos, que se agregan a la cola local y se sincronizan al reconectar. Los cambios de temporizadores que ya estaban activos siguen sujetos a las reglas de esta sección. **[v1.6]** La cola usa secuencias y dependencias causales por dispositivo; la resolución de concurrencia, incluidos registros manuales duplicados de una misma ocurrencia, requiere reglas técnicas explícitas aprobadas en 3.0.

---

## 5. Life Pulse: metodología de indicadores

### 5.1 Períodos

Los tres indicadores permiten consultar:

- Diario.
- Semanal.
- Mensual.

La semana comienza el lunes y termina el domingo.

Zona horaria de referencia: `America/Bogota`.

Los indicadores semanales y mensuales se recalculan desde los registros originales. No se obtiene el resultado promediando porcentajes diarios.

Los períodos abiertos solo contabilizan compromisos, eventos y ocurrencias cuya fecha de cumplimiento ya haya llegado.

### 5.2 Execution — Ejecución

Mide el cumplimiento de compromisos y objetivos.

Fórmula provisional:

**E = 0.6T + 0.4M**

Donde:

- `T`: cumplimiento ponderado de compromisos.
- `M`: cumplimiento ponderado de hitos.
- Peso de prioridad alta: 3.
- Peso de prioridad media: 2.
- Peso de prioridad baja: 1.

Cada componente se calcula como:

**Cumplimiento = (peso completado / peso programado) × 100**

Reglas:
- **[v1.4]** Un compromiso completado después de su fecha límite se atribuye al período de esa fecha límite y conserva su fecha real de cumplimiento.
- **[v1.6]** Cada cambio de fecha límite conserva el valor anterior, el nuevo valor y la fecha/hora del cambio. Si la fecha se cambia antes de vencer, la nueva fecha rige el compromiso. Si se cambia después del vencimiento, el incumplimiento ya ocurrido permanece en el historial y no se borra retroactivamente. **[v1.8, P6]** Cada fecha límite que llega genera una **evaluación (obligación)** del compromiso, y todas las evaluaciones pertenecen **al mismo compromiso**: no se crean compromisos independientes ni se pierde historial. Un compromiso aplazado después de vencer conserva la evaluación incumplida en su período original y genera una nueva evaluación para la fecha reprogramada. Ejemplo: vence el lunes y no se completa; el martes se reprograma para el viernes; el incumplimiento del lunes permanece registrado y la nueva obligación se evalúa el viernes; ambas pertenecen al mismo pendiente. Un cumplimiento tardío se atribuye al período de la obligación correspondiente y conserva la fecha y hora reales de cumplimiento. El historial lo registran disparadores en la base de datos (P4), de modo que también captura lo que hacen los módulos heredados. La definición operativa está en `docs/DISENO-TECNICO-FASE-3-v1.11.1.md` §9.

**[v1.9, T-4]** Las obligaciones cuya fecha de vencimiento ya llegó **permanecen en Execution** aunque el compromiso se elimine después; las obligaciones futuras se descartan. **[v1.9, T-5]** Al desmarcar el cumplimiento de una obligación se reevalúa su estado actual; las obligaciones sustituidas por un aplazamiento conservan su historial y su resultado. **[v1.11, T-6 aprobada]** La prioridad aplicable a una obligación es la **vigente al cierre del día de vencimiento**: el corte son las 00:00 de America/Bogota del día siguiente a la fecha límite. Se reconstruye desde `cambios_registro` y los cambios posteriores al cierre **no alteran** el peso histórico de esa obligación. Un cambio exactamente en el instante del corte cuenta como posterior. Respaldo cuando no hay historial: instantánea de creación, instantánea de eliminación, prioridad actual de la fila y, en último caso, «media». **La fórmula de Execution no cambia.** Implementación SQL: `prioridad_en_cierre`; consecuencias y ejemplos en `docs/DISENO-TECNICO-FASE-3-v1.11.1.md` §9.6. En todos los casos el historial se conserva.
- **[v1.11.1, D3-25 — APROBADA]** Las obligaciones cuyo vencimiento es **hoy** entran al cálculo de Execution **desde el inicio del día** (elegibles con `d ≤ hoy`, America/Bogota): las cumplidas cuentan como completadas y las que siguen abiertas cuentan como **incumplidas de forma provisional** (el indicador lo marca como «provisional»). Al cierre del día se consolidan con la prioridad vigente al cierre del vencimiento (T-6). La atribución histórica y el cumplimiento tardío no cambian; las fechas futuras no cuentan, ni siquiera si ya están cumplidas. Es coherente con D3-3 (Wellbeing) y D3-19a (Balance). Registro: `docs/DECISION-D3-25-EXECUTION-VENCE-HOY.md`.
- Si ambos componentes tienen información, se aplica la fórmula completa.
- Si solo uno tiene información elegible, se calcula con ese componente y se identifica como parcial.
- Si ninguno tiene información, mostrar «Sin datos».
- Productivity y Enjoyment contribuyen a Balance. Ninguna sesión Focus aumenta directamente Execution: este indicador se calcula exclusivamente con compromisos e hitos (D3-7, aprobada en v1.6).
- **[v1.1]** Los pendientes sin fecha límite quedan excluidos del cálculo hasta que tengan una fecha asignada. Al asignarla pasan a ser elegibles según §5.1.
- **[v1.2]** Cada hito tiene **prioridad propia** (alta, media o baja; pesos 3, 2 y 1). No hereda la prioridad de la meta a la que pertenece. Lo mismo vale para cada pendiente.
- **[v1.3]** Si un pendiente o hito nuevo se crea sin prioridad explícita, recibe prioridad **media** por defecto. El usuario puede cambiarla después.

Los hitos sin fecha quedan excluidos de Execution hasta que tengan fecha, igual que los pendientes (D3-1, aprobada en v1.6). La implementación debe preservar la fecha de vencimiento aplicable, la fecha real de cumplimiento (`hecho_en` o evento equivalente) y la evidencia histórica de cambios; el diseño de persistencia y los casos de múltiples cambios corresponden a 3.0.

La existencia y correspondencia de las fuentes de compromisos e hitos deben verificarse en la subfase 3.0 antes de implementar el cálculo.

### 5.3 Balance — Equilibrio de atención

Mide la distribución de la atención entre los frentes según objetivos definidos por el usuario.

Cada semana el usuario configura sus puntos objetivo por frente. La vista diaria y la mensual derivan proporcionalmente de ese objetivo semanal, sin exigir objetivos independientes para cada período.

**Conversión por período [v1.3]:**
- **Diario:** para cada frente, objetivo diario = objetivo semanal vigente ÷ 7.
- **Semanal:** en una semana cerrada se utiliza el objetivo semanal completo; en la semana en curso aplica el prorrateo de D3-19a.
- **Mensual:** para cada frente, se suman las fracciones diarias del objetivo semanal correspondiente a cada día calendario del mes. Una semana que cruza el inicio o el final del mes aporta únicamente los días que caen dentro de ese mes.
- Los puntos reales se cuentan únicamente dentro del período consultado. La fórmula se recalcula desde los registros originales.

Fórmula:

**B = 100 × Σ[gᵢ × min(1, aᵢ/gᵢ)] / Σgᵢ**

Donde:

- `gᵢ`: puntos objetivo del frente.
- `aᵢ`: puntos de atención registrados en el frente.
- Los frentes con objetivo cero quedan excluidos. En las vistas diaria y mensual se excluyen los frentes cuyo objetivo prorrateado para ese período sea cero.

Reglas:
- Un Pomodoro completado genera un punto.
- Productivity y Enjoyment contribuyen al balance.
- Los objetivos se revisan semanalmente. **[v1.9, T-7]** Los objetivos de semanas anteriores a la actual son inmutables: la base de datos rechaza insertarlos, modificarlos o borrarlos; la semana en curso y las futuras se pueden editar. **[v1.11, T-7b]** La protección **no actúa dentro de disparadores anidados** (`pg_trigger_depth() > 1`, por ejemplo el borrado en cascada al eliminar un usuario, incluso conservando su identidad), y la excepción alcanza a cualquier disparador anidado; sigue protegiendo las operaciones directas del cliente. El lunes de la semana se calcula con una función que recibe el instante (America/Bogota), lo que permite probar las fronteras sin manipular el reloj. **[v1.6]** En semanas y meses abiertos, el denominador incluye únicamente la fracción del objetivo correspondiente a los días transcurridos y elegibles del período, incluyendo el día actual en curso según la zona America/Bogota; los días futuros no se contabilizan todavía. La vista debe indicar «En curso».
- La atención que excede el objetivo no compensa déficits de otros frentes.
- Si no existen objetivos configurados para la semana, mostrar «Sin objetivo» y no heredar objetivos de semanas anteriores (D3-19b, aprobada en v1.6). Mostrar por separado los puntos efectivamente registrados, sin calcular porcentaje ni incluir frentes sin objetivo en el denominador. En meses con semanas parcialmente configuradas, usar únicamente objetivos vigentes de los días que sí los tengan; el detalle del estado visual mixto se especificará en 3.0 sin inventar objetivos.
- No penalizar frentes que el usuario no haya incluido en sus objetivos.
- **[v1.1]** Solo los puntos de sesiones de Focus cuentan. El tiempo de los temporizadores de hábitos no suma puntos de atención.

### 5.4 Wellbeing — Bienestar **[v1.1: reemplaza la fórmula por conteo de la v1.0]**

Mide el cumplimiento de la duración objetivo de los hábitos programados por el usuario.

Fórmula:

**W = (suma de tiempo realizado elegible / suma de tiempo objetivo elegible) × 100**

Con el tope por ocurrencia, la fórmula se evalúa así:

**W = 100 × Σ min(tiempo realizado, tiempo objetivo) / Σ tiempo objetivo**, sumando solo las ocurrencias elegibles.

Definiciones:
- **Ocurrencia:** un hábito programado en una fecha concreta, según su frecuencia (todos los días o días específicos de la semana).
- **Elegible:** la ocurrencia cuya fecha ya llegó (§5.1).
- **Tiempo objetivo:** la duración objetivo del hábito (minutos u horas por ocurrencia, convertidas a una misma unidad para sumar).
- **Tiempo realizado:** el tiempo vigente registrado para esa ocurrencia, manual o con temporizador.

Reglas:
- Los hábitos son configurados por el usuario (§5.4.1).
- Cada ocurrencia tiene un máximo del 100 % de cumplimiento: el tiempo que exceda el objetivo no compensa otras ocurrencias.
- Los días sin hábitos programados no generan penalización.
- Sin ocurrencias elegibles, mostrar «Sin datos».
- Una ocurrencia elegible sin tiempo registrado cuenta como 0 de tiempo realizado. Es un cumplimiento real igual a cero, distinto de «Sin datos».
- No realizar inferencias ni diagnósticos médicos o psicológicos.
- El indicador representa cumplimiento de hábitos, no un diagnóstico integral de salud.
- **[v1.4]** Los registros de tiempo de un temporizador que atraviesa medianoche se distribuyen entre las fechas locales correspondientes; cada segmento alimenta la ocurrencia de su fecha.
- Cambiar la programación de un hábito no altera el historial ya calculado: el cambio rige desde su fecha de vigencia, y no existen ocurrencias anteriores a ella.
- La ocurrencia del día actual se incluye en la vista diaria y se marca «día en curso»; no se interpreta como día cerrado (D3-3, aprobada en v1.6).

#### 5.4.1 Configuración de hábitos

Cada hábito tiene configuración independiente:

| Campo | Opciones |
|---|---|
| Frecuencia | Todos los días, o días específicos de la semana |
| Duración objetivo | Minutos u horas por ocurrencia |
| Registro de cumplimiento | Manual (el usuario ingresa el tiempo realizado) o Temporizador (iniciar, pausar y finalizar) |

Ejemplos:
- Correr: lunes, miércoles y viernes, 45 minutos.
- Leer: todos los días, 60 minutos.
- Caminar: todos los días, 30 minutos.

**[v1.4]** Los nuevos hábitos se gestionan en una interfaz nueva. El módulo Salud heredado permanece sin modificaciones; la compatibilidad se resolverá de forma aditiva y se verificará en 3.0. **[v1.9, T-13]** El modo del hábito determina el método principal de registro (solo un hábito en modo temporizador puede iniciar uno). El registro manual siempre está disponible, pero se rechaza cuando no existe una ocurrencia programada para esa fecha. La creación de un hábito es idempotente por identificador de operación.

#### 5.4.2 Registro de tiempo sin duplicaciones **[v1.2]**

- Cada ocurrencia programada (hábito + fecha) tiene **un único total vigente**, compuesto por los segmentos válidos de esa fecha.
- **El temporizador acumula tiempo** en esa ocurrencia.
- **Un registro manual reemplaza el tiempo acumulado** de esa ocurrencia. No se suma.
- Se conserva siempre la **fuente** del valor vigente (manual o temporizador) y el **historial de modificaciones**: cada cambio guarda valor anterior, valor nuevo, fuente, fecha y hora, y dispositivo. Nada se borra; el reemplazo agrega una entrada al historial.
- Wellbeing usa siempre el valor vigente.
- El tiempo de un hábito no genera puntos de atención y no se mezcla con sesiones de Focus (§4.8).
- **[v1.3]** Si se usa el temporizador después de un registro manual, acumula sobre el valor manual vigente. Se conserva fuente e historial de cada modificación.
- **[v1.4, v1.6]** Si el temporizador cruza la medianoche, el tiempo se divide en segmentos en cada límite diario de `America/Bogota`. Cada segmento solo se acredita si esa fecha tiene una ocurrencia programada del hábito; el segmento que cae en una fecha sin ocurrencia programada se ignora y no se traslada a otra fecha. El tope del 100 % se aplica por ocurrencia programada. Ejemplo: si el hábito está programado el viernes pero no el sábado, un temporizador que registra 30 minutos el viernes y 30 el sábado acredita solo los 30 minutos del viernes; los del sábado se ignoran. Cada segmento debe conservarse por separado y evitar duplicación al sincronizar. **[v1.8, P8]** Los segmentos de fechas sin ocurrencia programada **se conservan en el registro pero no se acreditan** a Wellbeing. **[v1.9, T-3]** Cancelar un temporizador de hábito descarta únicamente el segmento en curso; conserva los segmentos cerrados o pausados.

---

## 6. Sistema de atención y frentes

Los puntos de atención provienen de sesiones Pomodoro completadas.

- Una sesión completa equivale a un punto.
- Una sesión parcial no genera un punto completo.
- Los descansos no generan puntos.
- Productivity y Enjoyment generan puntos.
- Las sesiones pueden asociarse a cualquiera de los seis frentes.
- **[v1.1]** El tiempo de los hábitos (temporizador o manual) no genera puntos de atención. Alimenta únicamente a Wellbeing.

No todas las actividades necesitan utilizar Pomodoro. Por ejemplo, un evento familiar puede registrarse manualmente y el sueño no debe generar puntos de atención.

El registro manual de tiempo o atención no se incorporará al cálculo de puntos hasta definir una regla que evite duplicar sesiones o contabilizar dos veces una misma actividad.

---

## 7. IA proactiva y autonomía controlada

La IA debe funcionar como asistente de análisis y recomendación.

Puede:
- Detectar frentes con poca atención respecto a sus objetivos.
- Identificar compromisos próximos.
- Sugerir prioridades.
- Analizar tendencias de Life Pulse.
- Proponer descansos o cambios de enfoque.
- Recomendar revisiones de objetivos.

No puede:
- Cambiar prioridades sin aprobación.
- Modificar objetivos de atención.
- Crear o completar registros por iniciativa propia.
- Cambiar hábitos.
- Alterar datos históricos.
- Ejecutar acciones que no hayan sido autorizadas.
- **[v1.2]** Iniciar, pausar ni detener un temporizador, ni modificar el tiempo registrado de un hábito.

Toda propuesta debe indicar qué recomienda y por qué.

La integración real con el asistente dependerá de las capacidades disponibles y se verificará durante la implementación.

---

## 8. Experiencia visual y responsive

### Dirección visual

- Minimalista y futurista.
- Referencias: Linear, Raycast y visionOS.
- Tema claro y oscuro.
- Jerarquía visual limpia.
- Indicadores comprensibles y sin saturación de información.

### Responsive

La experiencia debe adaptarse a escritorio, tablet y móvil.

El temporizador persistente debe seguir siendo accesible en todos los tamaños.

Se deben conservar el shell, la navegación y los patrones visuales establecidos en las fases anteriores.

---

## 9. Arquitectura y restricciones técnicas

Stack existente:

- Next.js 14 App Router.
- React 18.
- JavaScript.
- Supabase: PostgreSQL y autenticación Google.
- Vercel como despliegue previsto.

Restricciones:

- No modificar autenticación ni middleware.
- No cambiar políticas RLS.
- No alterar relaciones ni estructura de tablas sin aprobación.
- No asumir que existen fuentes de datos que todavía no se han auditado.
- No introducir datos ficticios en producción.
- No eliminar rutas o módulos existentes. **[v1.1]** Se exceptúa el reemplazo de Mi día por Home en `/`, sin borrar código ni funcionalidades (§3.8).
- No añadir dependencias sin justificar su necesidad.
- No modificar tareas programadas existentes sin autorización.
- **[v1.1]** Toda tabla, columna o índice nuevo se presenta como propuesta separada y se ejecuta solo con autorización. Las políticas RLS de tablas nuevas siguen el patrón existente (acceso solo al propietario) y también requieren aprobación.
- **[v1.2]** La exclusividad de un solo temporizador activo y la unicidad de puntos y de operaciones deben garantizarse en la base de datos, no solo en la interfaz. Esto implica restricciones de esquema que se proponen en 3.0 y requieren aprobación.

**[v1.8]** La subfase 3.0 produjo la auditoría (`docs/AUDITORIA-3.0.md`) y el diseño detallado (`docs/DISENO-TECNICO-FASE-3-v1.11.1.md`). Las aprobaciones de diseño **no autorizan** ejecutar SQL, migraciones, pruebas contra la base de datos ni cambios de código, ni modificar tablas, columnas, funciones, disparadores, índices, RLS, autenticación, middleware, configuración o tareas programadas. La prioridad es preservar los módulos heredados y evitar cualquier cambio destructivo o pérdida de información. **[v1.9]** La ejecución en Supabase queda condicionada a verificar antes los roles y permisos (T-1; etapa 0 de las migraciones).

---

## 10. Plan de ejecución de Fase 3

| Subfase | Alcance | Resultado |
|---|---|---|
| 3.0 | Auditoría de datos y arquitectura de Home. **[v1.1]** Incluye la auditoría de Mi día. **[v1.2]** Incluye el diseño del modo sin conexión y de la exclusividad del temporizador | Mapa de fuentes, brechas y propuesta técnica |
| 3.1 | Diseño visual y componentes de Home. **[v1.1]** Home en `/` | Home responsive implementado |
| 3.2 | Focus Mode y temporizador persistente. **[v1.1]** Sincronizado con Supabase. **[v1.2]** Con operaciones sin conexión | Sesiones funcionales, persistentes y sincronizadas |
| 3.3 | Life Pulse y cálculos. **[v1.1]** Wellbeing por tiempo | Indicadores transparentes y verificables |
| 3.4 | Prioridades y contexto diario. **[v1.1]** Incluye el equivalente de las funciones de pendientes de Mi día. **[v1.2]** Incluye prioridad de hitos | Gestión de prioridades integrada |
| 3.5 | Integración del asistente | Recomendaciones contextuales con aprobación |
| 3.6 | Validación y cierre | Pruebas, accesibilidad y documentación |

**[v1.4]** Los hábitos nuevos se gestionan en una interfaz independiente, entre 3.2 y 3.3, con tablas propias que no alteran lo que usa Salud heredado (que no se modifica). **[v1.8, P15]** La interfaz de configuración de objetivos semanales por frente se incluye en la subfase 3.3. **[v1.8, P12]** Los indicadores se implementan como funciones puras en `lib/domain`, con pruebas automatizadas.

Las subfases se ejecutarán secuencialmente y tendrán puntos de revisión antes de avanzar cuando impliquen decisiones técnicas o cambios de datos.

---

## 11. Estado de los datos frente a la especificación (revisión del 9 nov 2026)

El 9 nov 2026 la auditoría 3.0 reverificó en solo lectura: 0 filas en las 18 tablas de datos, 10 filas en `frentes`, RLS activo en las 19 tablas y ninguna función ni disparador en `public`. El diseño aprobado de lo que falta está en `docs/DISENO-TECNICO-FASE-3-v1.11.1.md`; la columna «No existe» describe el esquema actual, no el propuesto. El detalle está en `docs/REVISION-CONSISTENCIA-FASE-3-v1.11.md`.

| Necesidad | Estado actual | Cambio de esquema probable (requiere aprobación) |
|---|---|---|
| Sesiones de Focus y sus eventos | No existe | Tablas de sesiones y de eventos; un punto único por sesión completada |
| **[v1.2–v1.6]** Un solo temporizador activo global (Focus, hábito o descanso; incluye pausados) | No existe | Mecanismo de exclusividad a nivel de base de datos entre sesiones, temporizadores de hábitos y descansos |
| **[v1.2–v1.6]** Registro de operaciones offline con idempotencia, secuencias y dependencias causales por dispositivo | No existe | Registro de operaciones con idempotencia, secuencia por dispositivo, dependencias y estado de conflicto |
| Preferencias sincronizadas | No existe | Tabla de preferencias por usuario |
| Objetivos semanales de atención por frente | No existe | Tabla de objetivos por semana y frente |
| Prioridad de pendientes y orden | `pendientes` no tiene prioridad ni orden | Columnas de prioridad y orden |
| **[v1.2–v1.6]** Prioridad e historial de hitos | `hitos` no tiene prioridad ni `hecho_en` | Columna de prioridad propia y marca/evento de cumplimiento; conservar cambios de estado e historial necesario para Execution |
| Hábitos nuevos: frecuencia por días, duración objetivo, modo de registro y vigencia | `habitos` conserva el modelo heredado | Propuesta aditiva e independiente para la interfaz nueva; no reutilizar ni alterar campos/semántica que consume Salud heredado |
| **[v1.2–v1.6]** Tiempo por ocurrencia, fuente, segmentos por fecha e historial | `habito_registros` guarda `fecha` y `valor` | Estructura aditiva para tiempo nuevo, segmentos válidos por día programado e historial; mantener intacta la semántica heredada de `valor` |
| Fecha límite e historial de cambios de pendientes | Opcional (`fecha_limite`); no hay historial de cambios identificado | Conservar fecha límite anterior/nueva, fecha del cambio y evidencia del vencimiento; no borrar incumplimientos pasados |
| Actividad reciente | Posibles fuentes: `hecho_en`, `creado_en`, `habito_registros`, sesiones | Se define en 3.0 |
| Asistente | «No conectado» en el código; sin ruta de servidor | Sin cambio hasta 3.5 |

---

## 12. Decisiones que requieren evidencia antes de implementar

Verificaciones técnicas obligatorias:

- Identificar las tablas y campos reales que alimentarán compromisos e hitos.
- Verificar las fuentes de hábitos y sus ocurrencias, con la configuración de §5.4.1.
- Determinar cómo persistir sesiones, temporizadores de hábitos y el registro de operaciones. El esquema existente no alcanza (§11): la 3.0 entrega la propuesta.
- Verificar cómo se relacionan los registros con los seis frentes.
- Identificar las fuentes disponibles para actividad reciente.
- Comprobar las posibilidades reales de integración del asistente.
- Auditar las funciones de Mi día y decidir su destino en Home.
- Verificar el mecanismo de sincronización entre dispositivos y el modo sin conexión: tolerancia de reloj, orden de operaciones, restricciones de unicidad y exclusividad.

Si alguna capacidad requiere modificar el esquema de Supabase, se presentará una propuesta separada y se solicitará autorización antes de ejecutarla.

---

## 13. Registro de decisiones (resumen)

El registro completo está en `docs/DECISIONES-FASE-3-v1.11.1.md`.

### 13.1 Aprobadas por el usuario
Home en `/` (nombre «Home»); pendientes sin fecha fuera de Execution; configuración de hábitos y Wellbeing por tiempo; Supabase como fuente de verdad y sincronización; registros independientes de Focus y hábitos; un solo temporizador activo globalmente; temporizador acumula y registro manual reemplaza, con fuente e historial; modo sin conexión con operaciones pendientes y resolución de conflictos; prioridad propia en cada hito; Balance diario y mensual prorrateado desde objetivos semanales; descanso dentro del temporizador global; acumulación del temporizador sobre tiempo manual de hábitos; prioridad «media» por defecto.

### 13.2 Historial de preguntas resueltas en v1.6
**No quedan decisiones funcionales pendientes de aprobación.** Se conservan las preguntas resueltas para trazabilidad:

| ID | Pregunta | Resolución aprobada |
|---|---|---|
| D3-1 | ¿Los hitos sin fecha también quedan fuera de Execution? | Aprobado: sí, igual que los pendientes |
| D3-3 | En la vista diaria de Wellbeing, ¿entra la ocurrencia de hoy aunque el día no termine? | Aprobado: sí, marcada «día en curso» |
| D3-7 | ¿Cómo contribuye Productivity a Execution? | Aprobado: no contribuye directamente; Productivity aporta a Balance. Execution mide compromisos e hitos |
| D3-10 | ¿Qué es una «prioridad del día»? | Aprobado: compromisos vencidos, con vencimiento hoy y elementos fijados manualmente |
| D3-11 | ¿Entra en la Fase 3 la pantalla de preferencias de Focus? | Aprobado: preferencias mínimas dentro de Focus en 3.2 |
| D3-19a | ¿Cómo se calcula Balance en semanas y meses abiertos? | Aprobado: prorratear según días transcurridos y elegibles |
| D3-19b | ¿Qué ocurre en una semana sin objetivos configurados? | Mostrar «Sin objetivo»; no heredar los objetivos de la semana anterior |

### 13.3 Decisiones cerradas en v1.4
| ID | Decisión |
|---|---|
| D3-2 | El cumplimiento tardío se atribuye al período de la fecha límite y conserva la fecha real de cumplimiento |
| D3-6 | Interfaz nueva para hábitos; Salud heredado sin modificaciones |
| D3-8 | Sin Realtime inicial; refresco al recuperar el foco y sincronización periódica |
| D3-13 | Sin inicio de temporizadores offline; se permiten registros manuales de hábitos en cola |
| D3-15(a) | Temporizador pausado conserva exclusividad hasta completar o cancelar |
| D3-15(c) | El tiempo de hábito que cruza medianoche se distribuye entre las fechas locales |
| D3-16 | Completar antes de tiempo guarda parcial sin punto; cancelar descarta |
| D3-20 | Se conserva fecha real de cumplimiento y se atribuye al período de fecha límite; el mecanismo técnico de auditoría se define en 3.0 |
| D3-21a | Descanso corto sugerido y largo sugerido tras cuatro ciclos; el usuario decide iniciar u omitir |

---

### 13.4 Decisiones cerradas en v1.5
| ID | Decisión |
|---|---|
| D3-21b | Solo sesiones Focus completas incrementan el contador; el contador se reinicia al completar u omitir el descanso largo; una sesión parcial no cuenta y el cambio de día no reinicia |
| D3-22 | Los cambios de fecha límite conservan historial; cambiar antes del vencimiento actualiza la fecha vigente; cambiar después no borra el incumplimiento ocurrido |
| D3-23 | El tiempo de hábito se divide por fecha local; solo se acredita en fechas con ocurrencia programada; los segmentos en días no programados se ignoran |
| D3-24 | Las operaciones offline se ordenan mediante secuencias y dependencias por dispositivo; se detecta concurrencia y se resuelve con reglas explícitas que se detallan en 3.0 |

### 13.5 Decisiones cerradas en v1.6
| ID | Decisión |
|---|---|
| D3-1 | Los hitos sin fecha quedan fuera de Execution hasta tener fecha |
| D3-3 | La ocurrencia del día actual se incluye en Wellbeing diario y se marca «día en curso» |
| D3-7 | Productivity aporta a Balance, pero no directamente a Execution; Execution mide compromisos e hitos |
| D3-10 | La prioridad del día incluye compromisos vencidos, con vencimiento hoy y elementos fijados manualmente |
| D3-11 | Preferencias mínimas de Focus dentro de su interfaz en 3.2 |
| D3-19a | En períodos abiertos, Balance usa solo el objetivo prorrateado de los días transcurridos y elegibles |
| D3-19b | Semana sin objetivos: «Sin objetivo», sin herencia de semanas anteriores |

### 13.6 Aprobaciones de diseño de la auditoría 3.0 (v1.8)
Aprobadas: P1 (esquema aditivo; SQL preparado, no ejecutado), P2 (`temporizador_activo`), P3 (sesiones canceladas conservadas), P4 (historial por disparadores), P5 (`prioridad` con `DEFAULT 'media' NOT NULL`), P6 (obligaciones con identidad única, con precisión), P8 (segmentos sin ocurrencia conservados, no acreditados), P9 (contador derivado y omisión implícita), P10 (Mi día y Home), P11 (actividad reciente), P12 (indicadores como funciones puras), P13 (transacciones con `ROLLBACK`, **sin autorizar su ejecución**), P14 (asistente: decisión pospuesta a 3.5) y P15 (objetivos semanales en 3.3). P7 aprobada **parcialmente** (ver §4.9). El registro completo está en `docs/DECISIONES-FASE-3-v1.11.1.md`.

### 13.7 Decisiones técnicas T-1 a T-13 (v1.9)
Aprobadas el 9 nov 2026: T-1, T-2, T-3, T-4 (opción B), T-5 (opción C), T-7, T-8 y T-8b, T-10, T-12, T-13 la firma idempotente de `habito_crear`, y, en la v1.11, **T-6**, **T-7b-1**, **T-7b-3** y **T-8c**. T-11 se ejecutó antes bajo autorización y no implicó aprobar el SQL. Detalle en `docs/DECISIONES-FASE-3-v1.11.1.md` §1.10.

### 13.8 Pendientes de aprobación o autorización (v1.9)
- **T-9:** cota de desfase de reloj, tolerancia hacia el futuro y algoritmo definitivo de reconciliación sin conexión. No se implementan umbrales hasta realizar la simulación.
- Etapa 0 (verificación de roles y permisos en Supabase), pruebas con `ROLLBACK` y ejecución de cada etapa: autorización expresa por separado.
## 14. Criterios generales de aceptación

La Fase 3 se considerará terminada cuando:

1. Home funcione como centro de control diario, en la ruta `/`, con las funciones de Mi día integradas, reubicadas o formalmente pendientes con autorización expresa.
2. Focus Mode permita sesiones Productivity y Enjoyment.
3. El temporizador persista entre rutas, recargas y dispositivos.
4. La pausa conserve el tiempo restante.
5. El descanso largo se sugiera después de cuatro ciclos y requiera decisión del usuario.
6. Las sesiones se registren correctamente y no dupliquen puntos, ni con reintentos, dos dispositivos u operaciones sin conexión.
7. Life Pulse calcule los tres indicadores con las fórmulas acordadas (Wellbeing por tiempo con tope del 100 % por ocurrencia; hitos y pendientes con prioridad propia).
8. Los indicadores distingan entre cero, información parcial, ausencia de datos, «Sin objetivo» y «En curso».
9. Los objetivos de atención puedan configurarse y revisarse semanalmente.
10. Las prioridades sean gestionables manualmente.
11. Las recomendaciones de IA requieran aprobación.
12. La experiencia sea responsive y compatible con ambos temas.
13. Las pruebas y auditorías no evidencien regresiones en navegación, autenticación ni módulos existentes.
14. No existan cambios no autorizados en Supabase, RLS o datos.
15. Los hábitos se configuren con frecuencia, duración objetivo y modo de registro, y el tiempo manual y el del temporizador no se dupliquen.
16. Los registros de Focus Mode y de hábitos permanezcan independientes y ninguna actividad genere registros duplicados entre ellos.
17. **[v1.2, v1.3]** Nunca haya dos temporizadores activos a la vez, ni siquiera con dos dispositivos; el descanso también ocupa el temporizador global.
18. **[v1.2]** El modo sin conexión sincronice las operaciones pendientes sin duplicar y muestre al usuario cada conflicto resuelto.
19. **[v1.2]** Cada modificación manual de tiempo de hábito conserve fuente e historial.
20. **[v1.3]** Balance diario y mensual utilicen el prorrateo proporcional del objetivo semanal definido en §5.3.
21. **[v1.3]** Un temporizador de hábito iniciado después de un registro manual acumule sobre el valor vigente.
22. **[v1.3]** Los nuevos pendientes e hitos sin prioridad explícita reciban prioridad «media».
23. **[v1.6]** Los cambios de fecha límite conserven historial y no eliminen incumplimientos ya ocurridos.
24. **[v1.6]** Los segmentos de hábitos solo se acrediten en fechas con ocurrencia programada; los segmentos en días no programados se ignoren.
25. **[v1.6]** La cola offline preserve secuencias y dependencias por dispositivo y detecte operaciones concurrentes sin resolverlas solo por orden de llegada.
26. **[v1.6]** El contador Pomodoro incluya solo sesiones completas y se reinicie al completar u omitir el descanso largo.

27. **[v1.8]** Ninguna migración altere ni elimine datos o funciones de los módulos heredados; todo cambio sea aditivo y reversible, y las inserciones heredadas sigan funcionando.
28. **[v1.8]** Las sesiones canceladas se conserven con estado `cancelada` y sin puntos.
29. **[v1.8]** Un compromiso aplazado conserve su identidad y su incumplimiento original, y genere una nueva evaluación para la fecha reprogramada.
30. **[v1.8]** Las operaciones sin conexión respeten primero las dependencias causales y nunca descarten una operación en silencio.
31. **[v1.8]** Iniciar otra sesión Focus tras la sugerencia de descanso largo cuente como omitirlo.
32. **[v1.9]** El historial de cambios sea de solo lectura para el cliente (sin insertar, modificar ni borrar).
33. **[v1.9]** Los objetivos semanales de semanas anteriores sean inmutables.
34. **[v1.9]** Las obligaciones cuya fecha ya llegó permanezcan en Execution aunque se elimine el compromiso; las futuras se descarten.
35. **[v1.9]** Desmarcar un cumplimiento reevalúe la obligación vigente y no reabra las sustituidas por un aplazamiento.
36. **[v1.11]** La prioridad de una obligación sea la vigente al cierre del día de vencimiento (America/Bogota) y los cambios posteriores no alteren el peso histórico.
40. **[v1.11]** El borrado de un usuario en cascada funcione con y sin identidad del propio usuario, y un usuario autenticado no pueda modificar directamente semanas pasadas.
41. **[v1.11]** El cliente no tenga privilegios residuales (TRUNCATE, REFERENCES, TRIGGER) en las tablas de solo lectura, y los disparadores y funciones definer sigan funcionando con los permisos del propietario.
42. **[v1.11]** El lunes de la semana se calcule con una función parametrizada por instante y coincida con inicioSemana del dominio JavaScript.
37. **[v1.9]** Tras cuatro ciclos completos se sugiera el descanso largo y no el corto.
38. **[v1.9]** La interfaz informe cuando el navegador no permita sonido o notificaciones.
39. **[v1.9]** Cancelar un temporizador de hábito conserve los segmentos cerrados; el registro manual se rechace sin ocurrencia programada; la creación de hábitos sea idempotente.

**Fin de la especificación funcional de Fase 3 (v1.11).**
