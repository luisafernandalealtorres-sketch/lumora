# SECOND BRAIN: auditoría técnica y plan de implementación (Home y arquitectura)

Fecha: 8 nov 2026. Estado: **solo auditoría y plan. No se modificó código, tablas, RLS ni autenticación.**
Base: `docs/design/01`, `02`, `03` y `reference-home-dashboard.png`. Complementa y reemplaza la propuesta anterior (`PROPUESTA-NAVEGACION.md`) donde haya diferencias.

---

## 1. Diagnóstico del estado actual

### 1.1 Qué está implementado y qué se probó de verdad

"Compila" no es "funciona". Esta tabla separa las dos cosas con evidencia.

| Capa | Implementado | Probado de verdad | Evidencia |
|---|---|---|---|
| Autenticación con Google | Sí | **Sí, una vez** | Existe 1 usuario en `auth.users`; el login y la primera pantalla se vieron bien |
| Protección de rutas y correo único | Sí | Parcial | El middleware redirige a `/login` (visto). No se probó el rechazo de otra cuenta |
| Lectura de las 9 pantallas | Sí | **No** | Compilan; nadie las abrió con sesión y yo no puedo iniciar sesión |
| **Escrituras** (crear, marcar, borrar) | Sí | **Nunca** | **Las 18 tablas de datos tienen 0 filas.** Ningún `INSERT` ha llegado a la base jamás |
| Tablas y RLS | Sí | Sí (por inspección) | 19 tablas, RLS activo, 1 política por tabla, el asesor de seguridad no reporta fallos de RLS |
| Agenda y correos en Mi día | Tablas listas | **No** | `agenda_hoy` y `correos_hoy` vacías; la tarea de las 6:00 a. m. nunca se ha ejecutado |
| Tareas programadas | Creadas | **No** | `tablero-mi-dia` y `recordatorio-jornada`: 0 ejecuciones. La primera además apunta al HTML viejo, no a la base |
| Responsive | Una regla (`min-width: 860px`) | **No** | No se ha visto en móvil |
| Modo oscuro | Por preferencia del sistema | **No** | Sin interruptor manual |

**Conclusión:** la estructura de datos y la seguridad están sólidas. El código de las pantallas es plausible pero **nunca ejecutó una escritura real**. Antes de rediseñar conviene cerrar ese hueco (ver riesgo R1).

### 1.2 Sistema de autenticación
- Supabase Auth con Google. Flujo: `/login` → Google → `/auth/callback` → `/`.
- `middleware.js` renueva la sesión, exige usuario y compara el correo con `ALLOWED_EMAIL`.
- Hallazgo menor del asesor: "Leaked Password Protection" desactivada. No aplica mientras solo se use Google.
- `SUPABASE_SERVICE_ROLE_KEY` está en `.env.local` pero **ningún código la usa**. Está duplicada en dos archivos idénticos (`lu_brain/.env.local` y `web/.env.local`).

### 1.3 Estilos y sistema visual
- Un solo archivo global, `globals.css` (78 líneas), con 12 variables de color y clases genéricas (`.card`, `.btn`, `.bar`, `.pill`, `.grid`, `.stat`…).
- **Solo 2 consultas de medios** (modo oscuro del sistema y un corte a 860 px). No hay ajuste de tablet.
- **~47 estilos en línea** (`style={{…}}`) repartidos por los componentes. Dificultan aplicar un sistema de tokens.
- Tipografías: Bricolage Grotesque (títulos) e Instrument Sans (texto). No hay biblioteca de iconos.
- No hay interruptor de tema; no hay `data-theme`.
- Los colores actuales (verde azulado) no coinciden con los de la especificación (violeta y azul).

### 1.4 Calidad técnica
- **0 archivos `loading.js`, `error.js` o `not-found.js`.**
- **Ninguna página del servidor revisa el error de sus consultas.** Si una consulta falla, la pantalla muestra el estado vacío como si no hubiera datos. Es un defecto real y afecta el criterio "estados de error bien diseñados".
- Sin pruebas automatizadas y sin script de lint (solo `dev`, `build`, `start`).
- **El proyecto no es un repositorio git.** No hay historial ni forma de volver atrás.
- Las consultas están dentro de cada página y componente; no hay capa de datos separada. Cada página vuelve a pedir `frentes`.
- Lógica de negocio mezclada con la interfaz (ejemplo: racha de hábitos y vencimientos dentro de `Salud.js` y `Finanzas.js`).

### 1.5 Base de datos: relaciones reales (verificadas en PostgreSQL)

```
auth.users ──┬─< pendientes >── metas (meta_id, SET NULL) ─< hitos
             ├─< metas ────────┐
             ├─< gastos ───────┤
             ├─< ingresos ─────┼──> frentes(slug)   [FK en pendientes, metas, gastos, ingresos, recurrentes, notas]
             ├─< recurrentes ──┤
             ├─< notas ────────┘
             ├─< habitos ─< habito_registros (CASCADE)
             ├─< medidas, objetivos_salud (unión por texto: medida_tipo)
             ├─< jornadas, biblioteca, deudas, presupuestos
             └─< agenda_hoy, correos_hoy, resumen_dia
```
- `frentes` tiene 9 filas y un `CHECK` que solo admite `grupo` = `ticketcode`, `tanku` o `personal`.
- **Sin frente:** jornadas, biblioteca, hábitos, medidas, objetivos de salud, deudas, presupuestos.
- Recurrente → gasto **no es una relación en la base**: es lógica del cliente (`pagar` inserta un gasto y marca `ultimo_pago`). No hay protección contra doble clic ni contra duplicados.
- Objetivo de salud ↔ medida se une por el texto `medida_tipo`, no por clave. Si se escribe distinto, se desconectan.
- Asesor de rendimiento: 7 claves foráneas sin índice y 8 índices sin uso (irrelevante con tablas vacías; revisar cuando haya datos).

### 1.6 Funcionalidad por módulo (qué existe hoy)

| Módulo | Leer | Crear | Editar | Borrar | Notas |
|---|---|---|---|---|---|
| Mi día: pendientes | Sí | Sí (con meta) | **No** | Sí | Alterna hecho; sin edición ni fecha límite |
| Mi día: agenda y correos | Sí | Solo por tarea | n/a | n/a | Vacíos hasta arreglar la tarea |
| Panel | Sí | n/a | n/a | n/a | Cifras derivadas |
| Metas e hitos | Sí | Sí | Estado | Sí | Hitos con casilla |
| Finanzas | Sí | Ingresos, presupuesto, recurrentes, deudas | Saldo (abono) | Sí | Solo mes actual |
| Gastos | Sí | Sí | **No** | Sí | Filtro por mes |
| Jornada | Sí | Sí (upsert por día) | Sí | **No** | Plan semanal manual |
| Salud | Sí | Sí | Marcar y valor | Archivar/borrar | Gráfica SVG propia |
| Biblioteca | Sí | Sí | **No** | Sí | Búsqueda y etiquetas |
| Cerebro | Sí | Sí | Sí | Sí | Búsqueda y filtro por frente |

### 1.7 Integraciones y tareas programadas
- **Gmail y Google Calendar:** conectados a Claude (verificado antes). La web **no** se conecta a ellos; solo Claude los lee.
- **`tablero-mi-dia` (6:00 a. m.):** su prompt edita `mi-dia/tablero.html` y republica el artifact. **No escribe en Supabase.** Mientras eso no cambie, Home no tendrá agenda ni correos.
- **`recordatorio-jornada` (9:00 p. m.):** guarda en `jornada/*.md`, no en la tabla `jornadas`.
- Ambas corren **solo con Claude Desktop abierto en tu PC**; 0 ejecuciones hasta hoy.
- Supabase está conectado a Claude con **la cuenta nueva** (la del proyecto actual), así que una tarea programada sí podría escribir en la base. Como el conector actúa sin sesión de usuario, tendría que indicar `user_id` explícitamente (hay un solo usuario, así que es viable).

### 1.7b Experiencia responsive actual
Una sola columna por defecto y dos columnas desde 860 px. El menú es una fila de 9 enlaces con desplazamiento horizontal. Sin barra inferior, sin tablet, sin áreas seguras de dispositivo. **No se ha visto en pantalla móvil.**

---

## 2. Mapa de arquitectura actual

```
/login  /auth/callback
(app)/ layout: Nav plana de 9 enlaces
  /          Mi día        → Pendientes (cliente)
  /panel     Panel         → solo lectura
  /metas     Metas         → Metas (cliente)
  /finanzas  Finanzas      → Finanzas (cliente, 295 líneas)
  /gastos    Gastos        → Gastos (cliente)
  /jornada   Jornada       → Jornada (cliente)
  /salud     Salud         → Salud (cliente, 304 líneas)
  /biblioteca Biblioteca   → Biblioteca (cliente)
  /cerebro   Cerebro       → Cerebro (cliente)
Patrón: page.js (servidor, consulta Supabase) → componente "use client" (altas, cambios, bajas)
Enlaces entre módulos: 1 (Finanzas → Gastos)
```

## 3. Mapa de arquitectura propuesto

```
SIDEBAR (escritorio)                    BARRA INFERIOR (móvil)
Inicio                                  Mi día · Panel · Metas · Más
  Mi día  ·  Panel                      "Más" abre una hoja con:
Mi vida                                   Finanzas, Salud, Jornada,
  Metas · Finanzas ▾ · Salud · Jornada    Biblioteca, Cerebro, Frentes,
Conocimiento                              Configuración
  Biblioteca · Cerebro
Frentes (filtro transversal, no páginas)
  TANKU · TICKETCODE · Personal · Salud · Familia · Otros proyectos
Configuración
                                        + botón flotante del asistente en todo
```
- **Finanzas ▾** contiene: Resumen, Gastos, Ingresos, Presupuestos, Recurrentes, Deudas. Gastos se integra sin perder funciones.
- **Asistente IA** no es una página en la primera entrega: es el botón flotante y su panel.
- **Rutas:** en las primeras fases la barra lateral enlaza a **las rutas actuales**. El reagrupamiento (`/vida/…`, `/conocimiento/…`) y sus redirecciones se hacen después, para no romper nada mientras se rediseña Home.

---

## 4. Inventario de componentes reutilizables

### 4.1 Lo que se reutiliza (lógica) y cómo

| Existente | Reutilización | Cómo |
|---|---|---|
| `Pendientes.js` | Alta, alternar, borrar, selector de meta | Extraer la lógica a un módulo y alimentar `PriorityList` y `TaskItem`. Añadir edición |
| `Salud.js` (hábitos) | `cumplido`, `marcar`, racha, semana | Extraer a `lib/domain/habitos.js` y alimentar `HabitWidget` |
| `Finanzas.js` | Cálculos de presupuesto, `proximoVencimiento` | Extraer a `lib/domain/finanzas.js`; alimentan `FinanceSummary` y alertas |
| `Panel` (`Barras`, avance) | Cálculo de avance por frente | Base de `FrontProgress` |
| `Salud.js` (`Grafica`) | Gráfica SVG | Base de `Sparkline` |
| `lib/format.js` | Moneda, fechas, racha, categorías | Se conserva; se amplía |
| `lib/supabase/*` | Clientes de servidor y navegador | Sin cambios |
| `middleware.js` | Sesión y correo único | Sin cambios |
| Todas las pantallas de módulos | Se mantienen tal cual en la primera entrega | Solo cambia el contenedor (menú) |

### 4.2 Lo que se reemplaza, con justificación
- **`Nav.js`:** una barra plana no puede ser sidebar con grupos ni barra inferior. Se reemplaza por `Sidebar` + `BottomNav`. Se conserva el archivo hasta que el nuevo menú funcione.
- **La página `(app)/page.js`:** se reescribe como Home nuevo. Su lógica actual (resumen, agenda, correos, pendientes, avance) **se preserva** en los widgets.

### 4.3 Componentes nuevos (de la especificación)
`DashboardHeader`, `LifePulse`, `FrontIndicator`, `PriorityList`, `TaskItem`, `DailyAgenda`, `AIInsights`, `InsightCard`, `FrontProgress`, `HabitWidget`, `FinanceSummary`, `QuickActions`, `AssistantFloatingButton`, `AssistantDrawer`, `EmptyState`, `LoadingSkeleton`.
Adicionales necesarios: `Sidebar`, `BottomNav`, `ThemeToggle`, `Icon`, `Ring` (anillo de progreso), `ErrorState`, `SearchPalette` (búsqueda universal), `QuickAddSheet` (formularios de acciones rápidas).

---

## 5. Archivos a crear o modificar (solo Home y shell; otros módulos intactos)

**Crear**
- `web/styles/tokens.css` (tokens oscuro y claro)
- `web/lib/data/` `pendientes.js`, `agenda.js`, `habitos.js`, `finanzas.js`, `frentes.js`, `metas.js`, `perfil.js` (acceso a datos; devuelven `{data, error}`)
- `web/lib/domain/` `lifePulse.js`, `frentesMap.js`, `alertas.js`, `habitos.js`, `finanzas.js`, `fechas.js` (lógica pura, sin interfaz ni Supabase)
- `web/components/ui/` `Icon`, `Ring`, `Sparkline`, `EmptyState`, `ErrorState`, `Skeleton` (con CSS Modules)
- `web/components/shell/` `Sidebar`, `BottomNav`, `Topbar`, `ThemeToggle`, `SearchPalette`
- `web/components/home/` los 12 componentes de Home
- `web/components/assistant/` `AssistantFloatingButton`, `AssistantDrawer`

**Modificar**
- `web/app/layout.js` (script de tema anti-parpadeo)
- `web/app/(app)/layout.js` (nuevo shell en lugar de `Nav`)
- `web/app/(app)/page.js` (Home nuevo)
- `web/app/globals.css` (importar tokens; conservar clases heredadas para los otros módulos)

**No tocar**
`middleware.js`, `lib/supabase/*`, `app/login`, `app/auth`, y los componentes y páginas de Metas, Finanzas, Gastos, Jornada, Salud, Biblioteca, Cerebro y Panel.

**Base de datos:** ninguno. Todo se resuelve con las columnas existentes (`fecha_limite`, `hecho_en`, `meta_id`, `inicio`/`fin`, etc.).

---

## 6. Cambios de navegación
1. Nuevo menú lateral con 4 grupos y la sección Frentes (escritorio).
2. Barra inferior de 4 accesos (Mi día, Panel, Metas, Más) y hoja "Más" (móvil).
3. Selector de tema claro/oscuro/sistema (guardado como preferencia del navegador).
4. Botón flotante del asistente respetando áreas seguras.
5. Fase posterior y aparte: reagrupar rutas con redirecciones; integrar Gastos como pestaña de Finanzas; filtro de frente global.

---

## 7. Riesgos técnicos y funcionalidades que podrían verse afectadas

| # | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| R1 | **Las escrituras nunca se han probado.** Un fallo de fondo (permiso, columna, formato) aparecería recién con datos reales | Alto | Fase 0: una pasada de pruebas reales con una cuenta tuya, creando y borrando un registro por módulo, antes de rediseñar |
| R2 | **No hay git.** Sin historial, una regresión no se puede revertir | Alto | `git init` y un primer commit antes de tocar nada (necesito tu autorización) |
| R3 | Errores de consulta silenciosos: el usuario vería "vacío" cuando en realidad falló | Medio | La nueva capa de datos devuelve `{data, error}` y cada widget muestra estado de error |
| R4 | **Colisión de estilos:** clases globales (`.card`, `.btn`, `.bar`…) usadas por los módulos que no se tocan | Alto | Tokens nuevos en variables con prefijo propio y CSS Modules para lo nuevo. Los módulos heredados conservan su CSS intacto |
| R5 | Cambiar el menú afecta a todas las pantallas aunque "no se modifiquen" | Medio | Es inevitable: el menú vive en el layout. Se valida que cada pantalla abra y funcione dentro del shell nuevo |
| R6 | La referencia visual **incluye datos inventados** (78 %, "+5 %", "dormiste 1,2 h menos") y un **paisaje de montañas** en el encabezado | Medio | La especificación dice "sin paisajes" y "sin datos ficticios". Se sigue la especificación y se trata la imagen como referencia de composición. Ver decisión D1 |
| R7 | **Life Pulse** requiere fórmulas que hoy no existen; no hay historial para "vs. semana anterior" | Medio | Definir fórmulas explícitas y mostrar "faltan datos" cuando no alcancen (ver 8.3) |
| R8 | **AI Insights** sin IA conectada y sin datos | Medio | Fase inicial con **alertas por reglas**, etiquetadas como tales. La IA real llega con la API |
| R9 | La especificación de Home **no incluye "Correos para revisar"**, que sí existe hoy | Medio | No se elimina: decisión D3 |
| R10 | Tareas programadas que escriben en la base sin sesión de usuario | Medio | Indicar `user_id` explícito; probar con una sola ejecución manual |
| R11 | Zona horaria: parte de la lógica de fechas corre en el servidor y parte en el navegador | Bajo-medio | Centralizar en `lib/domain/fechas.js` con America/Bogota |
| R12 | Doble clic en "Marcar pagado" duplica el gasto | Bajo | Pertenece a Finanzas; se anota para esa fase |
| R13 | No se puede automatizar el login de Google para pruebas | Medio | Validación visual con tu sesión en el navegador integrado y revisión tuya. Sin cambiar la autenticación |
| R14 | El diseño futurista (transparencias, gradientes) puede perjudicar legibilidad y rendimiento en móvil | Bajo | Superficies sólidas, gradientes solo en el encabezado, verificación de contraste |

---

## 8. Definiciones necesarias para Home (sin tocar la base)

### 8.1 Frentes: seis de la especificación contra nueve de la base
Mapeo **solo en la interfaz** (constante en `lib/domain/frentesMap.js`):

| Frente de diseño | Origen en la base |
|---|---|
| TICKETCODE | `ticketcode-eventos` + `ticketcode-eve` |
| TANKU | `tanku` |
| Personal | `personal` + `hogar` |
| Familia | `jardin` (+ `salud-abuela`, por decidir) |
| Otros proyectos | `hama` + `crochet` |
| Salud | **No tiene slug.** Se deriva de hábitos y objetivos de salud, no de pendientes |

### 8.2 "Prioridades de hoy"
No existe una columna de prioridad. Definición propuesta: pendientes abiertos con `fecha_limite` hoy o vencida, más los abiertos más antiguos hasta completar 5. "3 de 5 completadas" cuenta los cerrados hoy (`hecho_en`). Una marca de prioridad real exigiría un cambio de esquema; queda fuera por ahora.

### 8.3 Life Pulse: fórmulas honestas
Cada área se calcula solo con datos existentes y muestra "faltan datos" si no alcanza:

| Área | Fórmula propuesta | Datos mínimos |
|---|---|---|
| Trabajo | Pendientes cerrados / totales en TICKETCODE y TANKU | ≥ 3 pendientes |
| Finanzas | 1 − (gastos del mes / presupuesto total), acotado a 0–100 | Presupuesto definido |
| Salud | Cumplimiento de hábitos de los últimos 7 días | ≥ 1 hábito y 3 días |
| Metas | Promedio de avance de metas activas | ≥ 1 meta con hitos o tareas |
| Personal | Pendientes cerrados / totales en Personal y Otros | ≥ 3 pendientes |
| Familia | Pendientes cerrados / totales en Familia | ≥ 3 pendientes |

El porcentaje global **solo se muestra** si al menos 3 áreas tienen datos, y siempre con el detalle de cómo se calculó (el icono de información de la referencia). La comparación "vs. semana anterior" solo aparece si hay datos de ambas semanas (hoy es posible para pendientes, hábitos y gastos).

### 8.4 AI Insights, notificaciones y búsqueda
- **Alertas por reglas** (fase inicial): presupuesto > 90 %, recurrente que vence en ≤ 3 días o vencido, hábito con racha rota, pendiente vencido. Cada una muestra qué detectó, los datos que la respaldan y la acción sugerida. Se etiquetan como "Alertas automáticas", no como IA.
- **Notificaciones** (campana): se alimentan de esas mismas alertas.
- **Búsqueda universal:** consulta con `ilike` sobre notas, biblioteca, pendientes, metas y gastos. Sin índices de texto completo; suficiente para el volumen actual.

### 8.5 Accesos rápidos
Nuevo pendiente, Registrar gasto y Agregar nota abren una hoja con el formulario real que escribe en la tabla existente. "Capturar idea" crea una nota con la etiqueta `idea`. "Consultar a la IA" abre el panel del asistente en estado **"no conectado"**.

### 8.6 Asistente flotante
Interfaz completa con los siete estados, pero sin respuestas simuladas: muestra claramente que aún no está conectado. La conexión real (ruta del servidor, clave solo en servidor, permisos consultar/proponer/ejecutar, registro de acciones) es una fase aparte que además necesita una tabla de memoria y de registro, es decir, aprobación de esquema.

### 8.7 Tema, tipografía e iconos
- Tokens oscuros según la especificación. La especificación solo da 5 valores para el modo claro; el resto se derivará y se verificará el contraste.
- Interruptor claro/oscuro/sistema con una preferencia guardada en el navegador.
- **Iconos:** sin dependencia nueva, un conjunto propio de SVG (unos 25). La alternativa es `lucide-react`, que añade una dependencia.
- **Tipografía:** conservar Bricolage Grotesque e Instrument Sans, salvo que prefieras otra.
- **Estilos:** CSS Modules (nativos de Next, sin dependencias). No se introduce Tailwind.

---

## 9. Plan de implementación por fases

| Fase | Contenido | Toca BD | Complejidad |
|---|---|---|---|
| **0. Preparación** | `git init` y commit base; una pasada real de pruebas de escritura por módulo; sesión tuya en el navegador integrado para verificación visual; decidir D1 a D6 | No | **S** |
| **1. Fundaciones** | Tokens claro/oscuro, interruptor de tema, capa de datos y de dominio, kit base (Icon, Ring, EmptyState, ErrorState, Skeleton) | No | **M** |
| **2. Shell** | Sidebar, BottomNav con hoja "Más", Topbar con búsqueda y notificaciones, sección Frentes; rutas actuales sin cambios | No | **L** |
| **3. Cabecera y Life Pulse** | `DashboardHeader` (saludo con tu nombre de Google, fecha, resumen neutral) y `LifePulse` con fórmulas y detalle | No | **M** |
| **4. Widgets centrales** | Prioridades (con edición y fecha límite), Agenda, Hábitos, Finanzas del mes, Avance por frentes, "Correos para revisar" | No | **L** |
| **5. Alertas y accesos rápidos** | Alertas por reglas, notificaciones, `QuickActions` con hojas de captura, búsqueda universal | No | **M** |
| **6. Asistente (interfaz)** | Botón flotante y panel con estados; sin respuestas simuladas | No | **S-M** |
| **7. Responsive y validación** | Móvil propio, tablet, áreas seguras, contraste, estados vacío/carga/error, regresión de los 9 módulos | No | **M** |
| **8. Después (aprobación aparte)** | Tarea de las 6:00 a. m. a la base; reagrupar rutas e integrar Gastos como pestaña de Finanzas; filtro de frente global; asistente con la API de Claude; Personas y Calendario; cambios de esquema | Algunos | **L cada uno** |

Cada fase termina con una validación y una revisión tuya antes de empezar la siguiente.

---

## 10. Decisiones que necesito antes de empezar

- **D1. Referencia visual:** ¿sigo la especificación (encabezado con gradiente abstracto, sin paisaje y sin datos ficticios) y uso la imagen solo como guía de composición?
- **D2. Frentes:** ¿apruebo el mapeo del apartado 8.1? **¿La salud de tu abuela va en Familia o en Salud?**
- **D3. "Correos para revisar"** existe hoy y no está en la especificación. ¿Dónde lo ubico: dentro de la tarjeta de Agenda como pestaña, o como tarjeta propia?
- **D4. Aislamiento de estilos:** para no alterar los otros módulos en la primera entrega, uso tokens nuevos con prefijo y CSS Modules, y los módulos antiguos conservan su apariencia hasta su turno. ¿Estás de acuerdo?
- **D5. Git:** ¿autorizas `git init` y un commit base antes de cambiar código? Es lo que permite revertir si algo se rompe.
- **D6. Verificación visual:** ¿aceptas iniciar sesión tú una vez en el navegador integrado para que yo pueda revisar las pantallas con tu sesión?
- **D7. Fórmulas de Life Pulse (8.3) y definición de "Prioridades" (8.2):** ¿las apruebas o prefieres otras?
