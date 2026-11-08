# SECOND BRAIN: auditoría y propuesta de arquitectura

Estado: **solo propuesta**. No se modificó código, tablas, columnas ni políticas RLS.
Fecha de la auditoría: 8 nov 2026.

---

## Etapa A. Auditoría

### A1. Rutas (todas bajo `web/app`)

| Ruta | Archivo | Qué hace |
|---|---|---|
| `/login` | `login/page.js` | Entrada con Google |
| `/auth/callback` | `auth/callback/route.js` | Cierra el login |
| `/` | `(app)/page.js` | Mi día |
| `/panel` | `(app)/panel/page.js` | Métricas generales |
| `/metas` | `(app)/metas/page.js` | Metas e hitos |
| `/finanzas` | `(app)/finanzas/page.js` | Ingresos, presupuesto, recurrentes, deudas |
| `/gastos` | `(app)/gastos/page.js` | Registro de gastos |
| `/jornada` | `(app)/jornada/page.js` | Revisión nocturna |
| `/salud` | `(app)/salud/page.js` | Hábitos, medidas, objetivos |
| `/biblioteca` | `(app)/biblioteca/page.js` | Material guardado |
| `/cerebro` | `(app)/cerebro/page.js` | Notas por frente |

Protección: `middleware.js` exige sesión y limita el acceso a un solo correo. El menú es `components/Nav.js`, una fila plana de 9 enlaces.

### A2. Componentes (1.321 líneas en `components/`)
`Nav`, `Pendientes`, `Metas`, `Finanzas`, `Gastos`, `Jornada`, `Salud`, `Biblioteca`, `Cerebro`. Utilidades en `lib/format.js` (moneda, fechas, racha, categorías) y `lib/supabase/*`.
Patrón repetido: la página (servidor) carga los datos y un componente cliente hace las altas, cambios y borrados. Esto es consistente y se puede reutilizar.

### A3. Consultas por pantalla (lectura al cargar)

| Pantalla | Tablas que lee |
|---|---|
| Mi día | frentes, pendientes, metas (activas), agenda_hoy, correos_hoy, resumen_dia |
| Panel | frentes, pendientes, gastos, jornadas, biblioteca, notas |
| Metas | frentes, metas, hitos, pendientes (solo las vinculadas) |
| Finanzas | frentes, gastos, ingresos, presupuestos, recurrentes, deudas |
| Gastos | frentes, gastos |
| Jornada | jornadas |
| Salud | habitos, habito_registros, medidas, objetivos_salud |
| Biblioteca | biblioteca |
| Cerebro | frentes, notas |

### A4. Relaciones que ya existen

| Relación | Estado |
|---|---|
| Pendiente → meta | Funciona, pero solo se elige al crear el pendiente |
| Meta → frente | Funciona (columna `frente`) |
| Gasto, ingreso, recurrente, nota, pendiente → frente | Funciona |
| Recurrente → gasto | Funciona (botón "Marcar pagado" crea el gasto) |
| Finanzas consolida ingresos y gastos | Funciona, solo del mes actual |
| Hábitos, medidas, objetivos de salud | Funciona; objetivo se une a medida por texto (`medida_tipo`) |
| Agenda y correos → Mi día | **Tablas vacías.** La tarea de las 6:00 a. m. aún escribe el HTML viejo |
| Biblioteca y Cerebro como conocimiento | Funcionan por separado, sin conexión entre sí |
| Jornada | Aislada: no lee hábitos, pendientes ni gastos del día |

### A5. Frentes: estado real
- Se usan para **agrupar**, no para **filtrar**. Solo Cerebro tiene un selector de frente.
- Tablas con columna de frente: pendientes, metas, gastos, ingresos, recurrentes, notas.
- Tablas **sin** frente: jornadas, biblioteca, hábitos, medidas, objetivos de salud, deudas, presupuestos.
- Hay 9 frentes en la base (ticketcode-eventos, ticketcode-eve, tanku, hama, crochet, jardin, salud-abuela, hogar, personal) y la columna `grupo` solo admite `ticketcode`, `tanku` o `personal`.
- **La lista de frentes de tu solicitud es distinta** (TANKU, TICKETCODE, Personal, Salud, Familia, Otros proyectos). Ver la sección de decisiones.

### A6. Problemas de navegación y experiencia

1. **Nueve pestañas planas.** En móvil se desplazan de lado y no hay jerarquía.
2. **Finanzas y Gastos están separados** y se solapan: ambos muestran gasto del mes y ambos tienen su propio selector de mes.
3. **Solo hay un enlace entre módulos en toda la app** (Finanzas → Gastos). Todo lo demás está aislado.
4. **Duplicados:** "Avance por frente" aparece en Mi día y en Panel. "Gasto por categoría" aparece en Panel y en Gastos. El resumen del mes aparece en Panel y en Finanzas.
5. **No se puede filtrar por frente** casi en ningún lado.
6. **Un pendiente no muestra su meta** ni permite cambiarla después. La columna `fecha_limite` existe pero no tiene interfaz.
7. **El Panel no refleja** metas, salud ni finanzas completas.
8. **Los hábitos de hoy no aparecen en Mi día**, aunque son parte de la rutina diaria.
9. **Cada página vuelve a pedir `frentes`** (6 veces). No hay una capa de datos compartida.
10. **Mi día depende de datos que no llegan** (agenda y correos vacíos).

### A7. Dependencias
Next.js 14, React 18, `@supabase/ssr`, `@supabase/supabase-js`. Sin librerías de UI ni de gráficos (las gráficas son SVG propios). Esto facilita reorganizar sin riesgo.

---

## Etapa B. Propuesta

### B1. Mapa de navegación actual
```
Mi día · Panel · Metas · Finanzas · Gastos · Jornada · Salud · Biblioteca · Cerebro   (9 niveles iguales)
```

### B2. Mapa de navegación propuesto
```
INICIO          Mi día · Panel
MI VIDA         Metas · Finanzas · Salud · Jornada · (Personas*)
                  Finanzas = Resumen | Gastos | Ingresos | Presupuestos | Recurrentes | Deudas
CONOCIMIENTO    Biblioteca · Cerebro
ASISTENTE IA    Chat · Memoria* · Insights* · Automatizaciones*     (+ botón flotante en todas las pantallas)
```
`*` = no existe todavía; ver B6.

**Cómo se ve:**
- **Escritorio:** barra lateral con los 4 grupos. Solo se muestra el grupo activo desplegado.
- **Móvil:** barra inferior con 4 accesos (Inicio, Mi vida, Conocimiento, Asistente) y, dentro de cada grupo, pestañas secundarias. El botón flotante del asistente vive sobre la barra.
- **Filtro de frente global:** un selector en el encabezado (Todos, TANKU, TICKETCODE, Personal, Salud, Familia, Otros). Se recuerda al navegar y aplica a todo lo que tenga frente.

**Rutas propuestas** (las actuales seguirán funcionando con redirecciones):

| Actual | Propuesta |
|---|---|
| `/` | `/` (sin cambio) |
| `/panel` | `/panel` (sin cambio) |
| `/metas` | `/vida/metas` |
| `/finanzas` | `/vida/finanzas` |
| `/gastos` | `/vida/finanzas?tab=gastos` |
| `/salud` | `/vida/salud` |
| `/jornada` | `/vida/jornada` |
| `/biblioteca` | `/conocimiento/biblioteca` |
| `/cerebro` | `/conocimiento/cerebro` |
| (nuevo) | `/asistente` y botón flotante |

### B3. Comparación de cambios

| Elemento | Hoy | Propuesto |
|---|---|---|
| Niveles del menú | 9 planos | 4 grupos, máx. 6 visibles a la vez |
| Gastos | Pestaña aparte | Pestaña dentro de Finanzas (mismo componente, sin perder nada) |
| Frentes | Agrupan | Agrupan y **filtran** en todas las pantallas |
| Enlaces entre módulos | 1 | Bloque "Relacionado" en cada ficha |
| Duplicados | 3 | 0 (cada dato tiene un hogar y el resto lo enlaza) |
| Asistente | No existe | Botón flotante global |

### B4. Organización de módulos (quién es dueño de qué)

| Dato | Dueño | Dónde más se ve (solo resumen o enlace) |
|---|---|---|
| Pendientes | Mi día | Metas (como tareas de la meta) |
| Avance por frente | Panel | Mi día solo muestra "hoy" |
| Gasto por categoría | Finanzas > Gastos | Panel (una cifra, con enlace) |
| Hábitos de hoy | Salud | Mi día (tarjeta compacta con casillas) |
| Objetivos de salud | Salud | Metas (vista de solo lectura, frente Salud) |
| Vencimientos | Finanzas > Recurrentes | Mi día ("vence esta semana") |
| Resumen del mes | Finanzas | Panel (cifras clave) |

### B5. Relaciones recomendadas

**Ya validadas y se conservan:** pendiente→meta, meta→frente, gasto→frente, recurrente→gasto, Finanzas consolida, Jornada registra, Salud registra, Biblioteca y Cerebro como conocimiento, agenda y correos→Mi día (cuando se arregle la tarea).

**Relaciones nuevas, sin tocar la base de datos:**
1. Mostrar la meta en cada pendiente y poder cambiarla (usa `pendientes.meta_id`, ya existe).
2. Interfaz para `fecha_limite` de pendientes y sección "Vencen hoy / vencidos" en Mi día.
3. Jornada muestra, antes del formulario, un resumen de solo lectura del día: hábitos cumplidos, pendientes cerrados y gastos (consulta de lectura).
4. Mi día incluye hábitos de hoy y pagos que vencen en 7 días.
5. Objetivos de salud visibles en Metas (solo lectura).
6. Bloque "Relacionado" en cada meta: pendientes, notas y gastos del mismo frente.

**Relaciones que requerirían cambio de base de datos** (necesitan tu aprobación): ver B7.

### B6. Capacidades nuevas: alcance y utilidad (sin implementar)

**Personas**
- *Qué es:* agenda de contactos con contexto: relación, notas, fechas especiales, compromisos pendientes y recordatorios.
- *Utilidad alta:* tu negocio es de relaciones (clientes y proveedores de eventos, aliados de TANKU, familia). Evita que un compromiso se pierda.
- *Datos necesarios:* tablas `personas`, `persona_fechas`, y un vínculo con pendientes (nuevas, requieren aprobación).
- *Esfuerzo:* medio. *Recomendación:* sí, primero.

**Calendario**
- *Qué es:* vista semanal centralizada con eventos de Google Calendar, fechas importantes, vencimientos de recurrentes y recordatorios.
- *Realidad técnica:* la app web no se conecta directamente a Google Calendar. Los eventos llegarían por la tarea programada (ya diseñada) y quedarían en `agenda_hoy`, que hoy solo guarda el día actual.
- *Versión ligera recomendada:* vista de semana en solo lectura, alimentada por la tarea de las 6:00 a. m. Para crear eventos desde la app haría falta autorizar Google Calendar en la app, un trabajo aparte.
- *Esfuerzo:* ligera = medio; completa = alto. *Recomendación:* ligera, después de Personas.

**Conexiones**
- *Qué es:* un mapa visual de relaciones entre personas, ideas, proyectos, metas y notas.
- *Utilidad hoy: baja.* Con la base casi vacía el mapa sería un lienzo vacío. Lo útil es el bloque "Relacionado" de B5, que da el 80% del valor con poco esfuerzo.
- *Esfuerzo:* alto. *Recomendación:* diferir hasta tener datos.

**Asistente IA**

| Parte | Alcance | Dependencias |
|---|---|---|
| Chat | Botón flotante en todas las pantallas. Sabe en qué pantalla estás y qué frente tienes filtrado. Responde con tus datos y cita de dónde sale. | Ruta del servidor que llama a la API de Claude y una **clave de API de Anthropic** (la aportas tú; tiene costo por uso). Para buscar en notas, búsqueda de texto de Postgres. |
| Memoria | Hechos y preferencias que el asistente recuerda. | Tabla nueva (aprobación). |
| Insights | Hallazgos automáticos: gastos fuera de presupuesto, hábitos que decaen, metas estancadas. | Consultas sobre lo que ya existe. |
| Automatizaciones | Listar y activar las tareas programadas (6:00 a. m., 9:00 p. m.). | Las tareas corren en Claude Desktop, no en la web. La app podría mostrarlas pero no controlarlas. |

Regla propuesta: el asistente **lee** libremente y **pide confirmación** antes de escribir o borrar.

### B7. Impacto técnico por cambio

| Cambio | Archivos afectados | Cambio en BD | Riesgo | Esfuerzo |
|---|---|---|---|---|
| Nueva barra de navegación por grupos | `Nav`, layout | No | Bajo | S |
| Reagrupar rutas con redirecciones | carpetas de `app/`, `next.config.mjs` | No | Medio (enlaces viejos) | S |
| Gastos dentro de Finanzas como pestañas | `Finanzas`, `Gastos` (se reutiliza) | No | Medio (dividir un componente grande) | M |
| Filtro global de frente | contexto + todas las pantallas | No* | Medio | M |
| Eliminar duplicados | Mi día, Panel, Finanzas | No | Bajo | S |
| Relaciones B5 (1 a 6) | Pendientes, Metas, Jornada, Mi día | No | Bajo-medio | M |
| Frente en biblioteca, deudas y jornadas | tablas + formularios | **Sí** | Medio | S |
| Personas | tablas + pantalla nueva | **Sí** | Medio | M |
| Recordatorios | tabla + avisos | **Sí** | Medio | M |
| Chat IA | ruta de servidor, botón flotante | No (Memoria sí) | Medio (clave y costo) | M |
| Calendario ligero | pantalla + tarea de las 6:00 a. m. | Posible | Medio | M |

\* El filtro global funciona sin cambios en las 6 tablas que ya tienen frente. Para las otras 7 hay dos opciones; ver decisiones.

### B8. Plan de implementación por etapas

| Etapa | Contenido | Toca BD | Resultado visible |
|---|---|---|---|
| **1. Estructura** | Nueva navegación (lateral y barra inferior), reagrupar rutas con redirecciones, Gastos como pestaña de Finanzas, eliminar duplicados | No | App ordenada en 4 grupos, nada se pierde |
| **2. Frentes y relaciones** | Filtro global de frente, meta visible en pendientes, fecha límite, hábitos y vencimientos en Mi día, resumen en Jornada, bloque "Relacionado" | No | Todo conectado |
| **3. Datos de Mi día** | Cambiar la tarea de las 6:00 a. m. para llenar la base y actualizar `CLAUDE.md` | No | Agenda y correos reales |
| **4. Base de datos** (con tu aprobación) | Frente en las tablas que faltan, Personas, Recordatorios | **Sí** | Módulo Personas |
| **5. Asistente** | Chat con botón flotante, luego Insights | No | IA dentro de la app |
| **6. Calendario ligero** | Vista semanal | Posible | Agenda centralizada |
| **7. Despliegue** | Vercel, para usarla en el celular | No | App en internet |

Cada etapa se valida en escritorio y móvil y se entrega funcionando antes de empezar la siguiente.

---

## Decisiones que necesito de ti

1. **Frentes.** Tu lista tiene 6 (TANKU, TICKETCODE, Personal, Salud, Familia, Otros proyectos) y la base tiene 9. Propuesta sin tocar la base, solo en la interfaz:
   - TICKETCODE = producción de eventos + EVE (se mantienen como subfrentes).
   - TANKU = tanku.
   - Personal = personal + hogar.
   - Familia = jardín de mamá.
   - Otros proyectos = hama beads + crochet.
   - Salud = tus hábitos y medidas.
   - **¿La salud de tu abuela va en Familia o en Salud?**
2. **Frente en las tablas que no lo tienen** (biblioteca, deudas, jornadas, hábitos): ¿lo agregamos en la Etapa 4, o prefieres que esas pantallas queden sin filtro?
3. **Etapa 1 y 2:** ¿las aprobamos tal como están? No tocan la base de datos.
4. **Asistente:** ¿tienes o quieres crear una clave de API de Anthropic para la Etapa 5?
5. **Personas y Calendario ligero:** ¿los dejamos como Etapas 4 y 6, o cambias el orden?
