# SECOND BRAIN
## Especificación funcional — Fase 3: Home, Focus Mode y Life Pulse

**Versión:** 1.2 (consolidada)
**Fecha:** 9 nov 2026
**Estado:** pendiente de aprobación expresa. Hasta entonces no se inicia la subfase 3.0.
**Alcance de esta versión:** solo documentación. No se implementó código ni se modificó Supabase, tablas, RLS, autenticación ni configuración.

Documentos relacionados:
- `docs/DECISIONES-FASE-3.md`: registro de decisiones aprobadas y pendientes, y lista de contradicciones con su resolución.
- `docs/REVISION-CONSISTENCIA-FASE-3.md`: revisión de consistencia entre fórmulas, comportamiento y esquema actual.
- `docs/REVISION-PREVIA-FASE-3.md`: revisión inicial del estado del proyecto.

Marcas de versión: **[v1.1]** cambio del 9 nov (primera tanda de decisiones). **[v1.2]** cambio de esta versión. Lo no marcado se conserva de la v1.0 aprobada.

**Regla de lectura:** en esta especificación una recomendación **no es una decisión**. Las decisiones pendientes (§13) se redactan de forma neutra o con la regla de la v1.0, nunca como aprobadas.

---

## 0. Resumen de cambios

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

### 0.2 Decisiones que siguen pendientes
D3-1, D3-2, D3-3, D3-6, D3-7, D3-8, D3-10 y D3-11 (§13). Además, la revisión de consistencia detectó cuatro puntos nuevos, D3-13 a D3-16, que necesitan tu decisión y no se asumen.

### 0.3 Contradicciones
La lista completa (C1 a C17) y su resolución están en `docs/DECISIONES-FASE-3.md`.

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
- Puede contribuir a la ejecución y al balance de atención. **[v1.2]** Cómo contribuye a la ejecución está pendiente (D3-7).
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
- Qué cuenta exactamente como «prioridad del día» está pendiente (D3-10).

### 3.6 Actividad reciente

Se contempla un espacio para mostrar actividad reciente relevante, siempre que existan registros reales y fuentes verificadas.

No debe generar eventos ficticios ni duplicar registros de otras secciones.

La definición exacta de fuentes y tipos de actividad se realizará durante la auditoría de datos de la subfase 3.0.

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

---

## 4. Focus Mode: especificación funcional

### 4.1 Configuración inicial

| Parámetro | Valor inicial |
|---|---:|
| Enfoque | 30 minutos |
| Descanso corto | 5 minutos |
| Descanso largo | 20 minutos |
| Ciclos para sugerir descanso largo | 4 |

Todos estos parámetros podrán configurarse posteriormente desde las preferencias del usuario. **[v1.1]** Las preferencias se guardan en Supabase y se sincronizan entre dispositivos. Si la pantalla de preferencias entra en la Fase 3 está pendiente (D3-11).

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
- El descanso largo no comienza automáticamente.
- El usuario decide si acepta, pospone o descarta la sugerencia.
- Los descansos no generan puntos de atención.

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

**[v1.1]** La preferencia de notificaciones (avisos, sonido) se sincroniza. El permiso de notificaciones del navegador es de cada dispositivo y se solicita en cada uno. Sin permiso, el aviso se muestra dentro de la aplicación.

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

Una sesión parcial puede guardarse como parcial, pero no genera un punto completo.

Los puntos no se calculan proporcionalmente a los minutos: una sesión completada equivale a un punto, independientemente de su duración configurada.

**[v1.1]** Además se persisten los eventos de la sesión: inicio, cada pausa, cada reanudación y la finalización o cancelación, cada uno con su marca de tiempo.

Qué distingue una sesión «parcial» de una «cancelada» no está definido en la v1.0: pendiente (D3-16).

### 4.7 Sincronización entre dispositivos y temporizador único **[v1.1, v1.2]**

- Supabase es la fuente de verdad de sesiones y preferencias.
- La misma sesión activa debe verse y poder controlarse desde portátil, tablet y celular.
- Al abrir la aplicación en otro dispositivo se recupera la sesión activa con su tiempo restante.
- **[v1.2]** Solo puede existir **un temporizador activo globalmente por usuario**, ya sea de Focus Mode o de un hábito. Si se intenta iniciar otro, la aplicación lo impide y muestra el temporizador que ya está activo. La regla se garantiza en el servidor, no solo en la interfaz.
- Una sesión completada genera un solo punto aunque la acción de completar se envíe más de una vez o desde dos dispositivos (completar es idempotente).
- Los dispositivos reflejan los cambios de otro al recuperar el foco y de forma periódica mientras hay un temporizador activo. Si además se usa Realtime de Supabase está pendiente (D3-8).
- Las marcas de tiempo que deciden el estado son las del servidor, salvo lo regulado para operaciones sin conexión (§4.9).
- Qué ocurre exactamente con un temporizador en pausa respecto al «activo» está pendiente (D3-15).

### 4.8 Independencia respecto a los temporizadores de hábitos **[v1.1, v1.2]**

- Focus Mode y el temporizador de hábitos tienen registros, estados y controles **independientes**.
- Comparten únicamente la regla de exclusividad: un solo temporizador activo globalmente (§4.7).
- Focus Mode genera puntos de atención (Balance). El temporizador de hábitos registra duración para Wellbeing y **no** genera puntos de atención.
- Una sesión de Focus no se convierte automáticamente en tiempo de hábito, ni al revés.
- Una misma actividad no puede producir registros duplicados entre ambos sistemas: ni dos puntos de atención ni dos tiempos de hábito.

### 4.9 Modo sin conexión **[v1.2]**

Principio: **Supabase sigue siendo la fuente de verdad.** Lo que se guarda en el dispositivo es una cola de operaciones pendientes, no el estado oficial.

**Qué se guarda localmente**
- Los cambios de una sesión o temporizador ya activo: pausar, reanudar, completar, cancelar (y finalizar, en un temporizador de hábito).
- Cada operación lleva: un identificador único generado en el dispositivo, el identificador del dispositivo, la sesión o temporizador al que pertenece, el tipo de operación, su número de orden dentro de esa sesión y la hora del dispositivo en que ocurrió.

**Qué hace el servidor al recibirlas**
- Las aplica en orden y de forma idempotente: una operación con un identificador ya recibido se ignora, sin duplicar efectos, puntos ni tiempo.
- Valida que la transición sea posible (por ejemplo, no se pausa una sesión ya completada).
- Valida la hora informada: no puede estar en el futuro ni antes del inicio de la sesión, y se compara con la hora de recepción. Si el reloj del dispositivo está fuera de una tolerancia (se define en 3.0), el servidor usa su propia hora de recepción y lo indica como «hora ajustada».
- Registra siempre la operación en el historial, también cuando la rechaza.

**Reglas de conflicto**
1. Un estado final (completada, cancelada) es definitivo. Gana la primera operación final aceptada por el servidor. Una operación final posterior contradictoria se rechaza, se conserva en el historial marcada como «rechazada por conflicto» y se avisa al usuario.
2. Las operaciones no finales (pausar, reanudar) que no cambian el estado vigente se tratan como repetidas y se ignoran sin error.
3. Un punto de atención se emite como máximo una vez por sesión. Una sesión rechazada o duplicada no genera punto.
4. El tiempo de un hábito se asigna a una sola ocurrencia (hábito + fecha). Una operación repetida no suma dos veces.
5. Ninguna operación pendiente se descarta en silencio: el usuario ve cuáles están «pendientes de sincronizar» y cuáles se resolvieron por conflicto.

**Límites declarados**
- Si el usuario borra los datos del navegador antes de sincronizar, las operaciones pendientes se pierden. La aplicación debe advertirlo.
- Este mecanismo es un requisito funcional. Su diseño técnico detallado se valida en la subfase 3.0 y no se ejecuta ningún cambio de esquema sin aprobación.
- Si se pueden iniciar temporizadores o registrar entradas manuales de hábitos sin conexión no está definido: pendiente (D3-13).

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
- Si ambos componentes tienen información, se aplica la fórmula completa.
- Si solo uno tiene información elegible, se calcula con ese componente y se identifica como parcial.
- Si ninguno tiene información, mostrar «Sin datos».
- Productivity puede contribuir a la ejecución; Enjoyment no. Cómo contribuye Productivity está pendiente (D3-7): hasta decidirlo, las sesiones no entran por sí solas en la fórmula, que solo usa compromisos e hitos.
- **[v1.1]** Los pendientes sin fecha límite quedan excluidos del cálculo hasta que tengan una fecha asignada. Al asignarla pasan a ser elegibles según §5.1.
- **[v1.2]** Cada hito tiene **prioridad propia** (alta, media o baja; pesos 3, 2 y 1). No hereda la prioridad de la meta a la que pertenece. Lo mismo vale para cada pendiente.

Pendiente de decisión: si los hitos sin fecha se excluyen igual que los pendientes (D3-1) y si un compromiso completado después de su fecha límite cuenta como cumplido (D3-2).

La existencia y correspondencia de las fuentes de compromisos e hitos deben verificarse en la subfase 3.0 antes de implementar el cálculo.

### 5.3 Balance — Equilibrio de atención

Mide la distribución de la atención entre los frentes según objetivos definidos por el usuario.

Cada semana el usuario configura sus puntos objetivo por frente.

Fórmula:

**B = 100 × Σ[gᵢ × min(1, aᵢ/gᵢ)] / Σgᵢ**

Donde:

- `gᵢ`: puntos objetivo del frente.
- `aᵢ`: puntos de atención registrados en el frente.
- Los frentes con objetivo cero quedan excluidos.

Reglas:
- Un Pomodoro completado genera un punto.
- Productivity y Enjoyment contribuyen al balance.
- Los objetivos se revisan semanalmente.
- La atención que excede el objetivo no compensa déficits de otros frentes.
- Si no existen objetivos configurados, mostrar «Sin datos».
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
- Cambiar la programación de un hábito no altera el historial ya calculado: el cambio rige desde su fecha de vigencia, y no existen ocurrencias anteriores a ella.
- Pendiente de decisión: cómo se trata la ocurrencia del día en curso en la vista diaria (D3-3).

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

Dónde se gestionan los hábitos en la interfaz (el módulo Salud heredado usa el modelo anterior) está pendiente (D3-6).

#### 5.4.2 Registro de tiempo sin duplicaciones **[v1.2]**

- Cada ocurrencia (hábito + fecha) tiene **un único tiempo vigente**.
- **El temporizador acumula tiempo** en esa ocurrencia.
- **Un registro manual reemplaza el tiempo acumulado** de esa ocurrencia. No se suma.
- Se conserva siempre la **fuente** del valor vigente (manual o temporizador) y el **historial de modificaciones**: cada cambio guarda valor anterior, valor nuevo, fuente, fecha y hora, y dispositivo. Nada se borra; el reemplazo agrega una entrada al historial.
- Wellbeing usa siempre el valor vigente.
- El tiempo de un hábito no genera puntos de atención y no se mezcla con sesiones de Focus (§4.8).
- Interpretación a confirmar (D3-15): si el temporizador se usa después de un registro manual, acumula sobre el valor vigente.

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

La subfase 3.0 debe determinar qué información ya existe, qué puede reutilizarse y qué brechas requieren decisiones adicionales.

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

**[v1.1]** Los hábitos con configuración propia y su temporizador (§5.4.1) no tienen subfase asignada: se propone ubicarlos entre 3.2 y 3.3 y se confirma en 3.0 (depende de D3-6).

Las subfases se ejecutarán secuencialmente y tendrán puntos de revisión antes de avanzar cuando impliquen decisiones técnicas o cambios de datos.

---

## 11. Estado de los datos frente a la especificación (revisión del 9 nov 2026)

Lectura del esquema actual, sin cambios. Todas las tablas de datos tienen 0 filas. El detalle está en `docs/REVISION-CONSISTENCIA-FASE-3.md`.

| Necesidad | Estado actual | Cambio de esquema probable (requiere aprobación) |
|---|---|---|
| Sesiones de Focus y sus eventos | No existe | Tablas de sesiones y de eventos; un punto único por sesión completada |
| **[v1.2]** Un solo temporizador activo global (Focus u hábito) | No existe | Mecanismo de exclusividad a nivel de base de datos entre sesiones y temporizadores de hábito |
| **[v1.2]** Registro de operaciones (cola sin conexión, idempotencia, conflictos) | No existe | Registro de operaciones con identificador único |
| Preferencias sincronizadas | No existe | Tabla de preferencias por usuario |
| Objetivos semanales de atención por frente | No existe | Tabla de objetivos por semana y frente |
| Prioridad de pendientes y orden | `pendientes` no tiene prioridad ni orden | Columnas de prioridad y orden |
| **[v1.2]** Prioridad de hitos | `hitos` no tiene prioridad y tampoco fecha de cumplimiento real (`hecho_en`) | Columna de prioridad propia; evaluar fecha de completado |
| Hábitos: frecuencia por días, duración objetivo, modo de registro, vigencia | `habitos` solo tiene `tipo`, `unidad`, `objetivo_dia`, `veces_semana` | Reestructurar la configuración de hábitos |
| **[v1.2]** Tiempo por ocurrencia con fuente e historial de modificaciones | `habito_registros` guarda `fecha` y `valor` | Ampliar registro por ocurrencia y agregar historial de cambios |
| Fecha límite de pendientes | Opcional (`fecha_limite`) | Sin cambio |
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

El registro completo está en `docs/DECISIONES-FASE-3.md`.

### 13.1 Aprobadas por el usuario
Home en `/` (nombre «Home»); pendientes sin fecha fuera de Execution; configuración de hábitos y Wellbeing por tiempo; Supabase como fuente de verdad y sincronización; registros independientes de Focus y hábitos; un solo temporizador activo globalmente; temporizador acumula y registro manual reemplaza, con fuente e historial; modo sin conexión con operaciones pendientes y resolución de conflictos; prioridad propia en cada hito.

### 13.2 Pendientes de aprobación
**Las recomendaciones no están aprobadas.** Se listan solo como referencia.

| ID | Pregunta | Recomendación (no aprobada) |
|---|---|---|
| D3-1 | ¿Los hitos sin fecha también quedan fuera de Execution? | Sí, igual que los pendientes |
| D3-2 | ¿Un compromiso completado después de su fecha límite cuenta como cumplido? | Sí, evaluado en el período de su fecha límite |
| D3-3 | En la vista diaria de Wellbeing, ¿entra la ocurrencia de hoy aunque el día no termine? | Sí, marcada «día en curso» |
| D3-6 | ¿Dónde se gestionan los hábitos nuevos, dado que Salud usa el modelo anterior? | Interfaz nueva propuesta en 3.0; cambiar Salud solo con autorización aparte |
| D3-7 | ¿Cómo contribuye Productivity a Execution? | De forma indirecta, vía compromisos asociados |
| D3-8 | ¿Sincronización con Realtime de Supabase o sin él? | Sin Realtime al inicio |
| D3-10 | ¿Qué es una «prioridad del día»? | Pendiente con prioridad y fecha límite hoy, más lo que fije el usuario |
| D3-11 | ¿Entra en la Fase 3 la pantalla de preferencias de Focus? | Sí, mínima, en 3.2 |

### 13.3 Nuevos, surgidos de la revisión de consistencia (sin decisión previa)
| ID | Pregunta | Recomendación (no aprobada) |
|---|---|---|
| D3-13 | Sin conexión: ¿se pueden iniciar temporizadores y registrar entradas manuales de hábitos? | Iniciar no (no puede verificarse el temporizador único); entradas manuales sí, en la cola |
| D3-14 | ¿Qué prioridad tiene un pendiente o hito creado sin ella (los módulos heredados no la piden)? | Que el valor por defecto sea «media» |
| D3-15 | (a) ¿Un temporizador en pausa sigue ocupando el lugar del temporizador único? (b) Si se usa el temporizador tras un registro manual, ¿acumula sobre el valor vigente? (c) Un temporizador que cruza medianoche, ¿a qué ocurrencia pertenece? | (a) Sí, ocupa el lugar hasta completar o cancelar; (b) sí; (c) a la fecha de inicio en America/Bogota |
| D3-16 | ¿Qué diferencia una sesión «parcial» de una «cancelada»? ¿Completar antes de tiempo da parcial? | Completar antes de la duración configurada guarda parcial; cancelar descarta sin puntos |

---

## 14. Criterios generales de aceptación

La Fase 3 se considerará terminada cuando:

1. Home funcione como centro de control diario, en la ruta `/`, con las funciones de Mi día integradas, reubicadas o formalmente pendientes con tu autorización.
2. Focus Mode permita sesiones Productivity y Enjoyment.
3. El temporizador persista entre rutas, recargas y dispositivos.
4. La pausa conserve el tiempo restante.
5. El descanso largo se sugiera después de cuatro ciclos y requiera decisión del usuario.
6. Las sesiones se registren correctamente y no dupliquen puntos, ni con reintentos, dos dispositivos u operaciones sin conexión.
7. Life Pulse calcule los tres indicadores con las fórmulas acordadas (Wellbeing por tiempo con tope del 100 % por ocurrencia; hitos y pendientes con prioridad propia).
8. Los indicadores distingan entre cero, información parcial y ausencia de datos.
9. Los objetivos de atención puedan configurarse y revisarse semanalmente.
10. Las prioridades sean gestionables manualmente.
11. Las recomendaciones de IA requieran aprobación.
12. La experiencia sea responsive y compatible con ambos temas.
13. Las pruebas y auditorías no evidencien regresiones en navegación, autenticación ni módulos existentes.
14. No existan cambios no autorizados en Supabase, RLS o datos.
15. Los hábitos se configuren con frecuencia, duración objetivo y modo de registro, y el tiempo manual y el del temporizador no se dupliquen.
16. Los registros de Focus Mode y de hábitos permanezcan independientes y ninguna actividad genere registros duplicados entre ellos.
17. **[v1.2]** Nunca haya dos temporizadores activos a la vez, ni siquiera con dos dispositivos.
18. **[v1.2]** El modo sin conexión sincronice las operaciones pendientes sin duplicar y muestre al usuario cada conflicto resuelto.
19. **[v1.2]** Cada modificación manual de tiempo de hábito conserve fuente e historial.

**Fin de la especificación funcional de Fase 3 (v1.2).**
