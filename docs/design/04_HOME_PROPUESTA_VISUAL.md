# Home como centro de control: propuesta visual para aprobación

> **REEMPLAZADA por `05_HOME_CENTRO_DE_CONTROL.md` (10 nov 2026).** Esta versión tenía once tarjetas; la nueva consolida siete bloques con propósito y añade el mapa de los seis frentes. Se conserva solo como historial.

Fecha: 10 nov 2026. Estado: **propuesta. No se implementó ni se modificó código.** Sin SQL en Supabase, sin credenciales de producción, sin cambios de RLS ni commits.

## 0. Corrección de rumbo

El Home que hoy ves en `/` **no es el diseño aprobado**: es una integración provisional que armé a partir de «Mi día» más algunos bloques de la Fase 3, sin haber releído antes los documentos de diseño que ya existían. Esta propuesta parte de ellos:

- `docs/design/01_PRODUCT_DESIGN_BRIEF.md` (visión: centro de control personal; datos honestos),
- `docs/design/02_INFORMATION_ARCHITECTURE.md`,
- `docs/design/03_HOME_DESIGN_SPEC.md` (estructura de Home) y `docs/design/reference-home-dashboard.png` (referencia visual),
- `docs/AUDITORIA-Y-PLAN-HOME.md` (inventario de componentes y plan por fases),
- y tus nuevas instrucciones: Focus como elemento principal; Life Pulse con Execution, Balance y Wellbeing; resumen ejecutivo del dashboard; Mi día; asistente con alertas y recomendaciones proactivas.

## 1. Inspección de `/panel` (el dashboard existente)

`/panel` es una página de servidor de solo lectura (`app/(app)/panel/page.js`, 110 líneas) con estas piezas:

| Pieza | Qué muestra | Fuente | Cálculo (en la página) |
|---|---|---|---|
| KPI «pendientes abiertos» | cantidad | `pendientes` | `!hecho` |
| KPI «cerrados en 7 días» | cantidad | `pendientes` | `hecho` y `hecho_en` ≥ hace 7 días |
| KPI «avance general» | % | `pendientes` | `(total − abiertos) / total`; **con 0 pendientes muestra 0 %** |
| KPI «gasto del mes» | COP | `gastos` | suma de `valor_cop` del mes |
| KPI «días seguidos de jornada» | cantidad | `jornadas` | `racha(fechas)` |
| KPI «en la biblioteca» | cantidad | `biblioteca` | conteo |
| Avance por frente | barras hechos/total | `pendientes` + `frentes` | por `slug` original |
| Notas por frente | barras | `notas` + `frentes` | conteo |
| Gasto por categoría | barras COP | `gastos` | suma por `CATEGORIAS` |
| Negocio y personal | 2 barras COP | `gastos` | `esNegocio(frente)` |

Hallazgos de la inspección (no se tocan en esta propuesta):
1. **Confunde cero con ausencia de datos:** con la base vacía muestra «0», «0 %» y «$ 0». Home no debe heredar eso.
2. **Usa estilos heredados** (`.stat`, `.grid`, `.avance`, `.bar`) y una función `Barras` local a la página: no son componentes reutilizables; el kit de la Fase 1 (`Card`, `ProgressBar`, `Ring`…) no se usa allí.
3. **Agrupa por `slug` original** (9 frentes), no por los 6 frentes de diseño (`frentesMap`).
4. **«Avance general» y «Avance por frente» miden pendientes completados**, no Balance (atención frente a objetivo). Son cosas distintas y deben llamarse distinto.

## 2. Componentes y métricas reutilizables

### 2.1 Componentes (código existente)

| Existente | Dónde | Uso en Home |
|---|---|---|
| `Card`, `Chip`, `ProgressBar`, `Ring`, `Sparkline`, `Skeleton`, `EmptyState`, `ErrorState`, `EstadoDatos`, `Icon` | `components/ui` (Fase 1) | Base de todos los widgets; ya cubren los cinco estados |
| Tokens claro/oscuro, degradado de encabezado | `styles/tokens.css` | Dirección visual de la especificación (violeta/azul) |
| Shell: barra lateral, barra superior (búsqueda, notificaciones, perfil), barra móvil, asistente flotante y su panel | `components/shell` (Fase 2) | Sin cambios: ya cubre «Header: búsqueda, notificaciones, perfil» y «asistente flotante» |
| `TemporizadorProvider`, `Controles`, `FormularioIniciar` lógica | `components/timer` (Fase 3) | Núcleo del widget Focus |
| Indicadores y anillos de Life Pulse | `components/lifepulse`, `components/home/HomeCentro` (provisional) | Widget Life Pulse (se reorganiza, no se reescribe) |
| Balance por frente | `lib/domain/atencion.js` | Widget «Distribución por frentes» |
| Wellbeing / hábitos Fase 3 | `lib/domain/habitos.js` | Widget Hábitos (cuando exista migración) |
| `EstadoFuente` y `fuentes.js` | `components/home`, `lib/domain` | «Fuente no conectada» en agenda, correos y resumen |
| `Pendientes.js` (lógica de alta, marcar, borrar, meta) | `components` | Widget Prioridades (**se conserva intacto**; se extrae la lógica sin cambiar el componente heredado) |
| `lib/format.js` (`cop`, `racha`, `esNegocio`, `CATEGORIAS`, `mesActual`) | `lib` | Resumen ejecutivo y Finanzas |
| `asistente.js` (siete estados) | `lib/domain` | Widget de alertas/recomendaciones |

### 2.2 Lo que hay que **extraer** (lógica pura, con pruebas) para compartir entre Home y Panel

Hoy los cálculos viven dentro de `panel/page.js`, `Finanzas.js` y `Salud.js`. Propongo extraerlos a `lib/domain/resumen.js` (puro y probado) **sin cambiar** lo que muestra `/panel`: Panel seguirá igual y después podrá consumir las mismas funciones.

| Función a extraer | Origen |
|---|---|
| Pendientes abiertos, cerrados en N días, avance con estado «sin datos» | `panel/page.js` |
| Gasto del mes, por categoría, negocio/personal | `panel/page.js` |
| Presupuesto utilizado y disponible | `Finanzas.js` |
| Racha de jornada y de hábitos | `lib/format.js`, `Salud.js` |
| Alertas por reglas (ver §5) | nuevo (`lib/domain/alertas.js`) |

## 3. Home frente a Panel

| | **Home** | **Panel** |
|---|---|---|
| Propósito | Visión ejecutiva, prioridades y **acciones inmediatas** | **Análisis detallado**, métricas y consulta histórica |
| Horizonte | Hoy y esta semana | Mes, histórico y tendencias |
| Interacción | Actuar sin salir: iniciar Focus, completar, registrar | Leer, filtrar, comparar |
| Densidad | Una pantalla de decisiones; el resto, un toque más abajo | Todas las métricas y desgloses |
| Estado | Cada widget con su estado honesto | Se conserva; mejora posterior (cero ≠ sin datos) |

Home **enlaza** a Panel («Ver análisis completo») y reutiliza sus cálculos; **no** lo reemplaza ni lo modifica. `/panel` y todas las rutas quedan igual.

## 4. Distribución visual propuesta

Dirección visual (aprobada en el brief y la especificación): minimalista, futurista, degradado violeta-azul **solo en el encabezado**, superficies sólidas, sin paisajes ni fotografías, claro y oscuro. La imagen de referencia se usa como guía de **composición**, no de contenido (ver §6).

### 4.1 Escritorio (≥ 1100 px): 12 columnas

```
┌ Barra superior (ya existe): búsqueda · notificaciones · perfil ─────────────────────────┐
│ ENCABEZADO (degradado)  Buenas tardes, Lu · fecha · resumen del día / «Fuente no conectada»
├───────────────────────────────────────────────────────────────────────────────────────┤
│  FOCUS (principal, 7 col)                         │  LIFE PULSE (5 col)                 │
│  reloj grande · modalidad · frente · iniciar      │  Execution · Balance · Wellbeing    │
│  o controles si hay temporizador · descanso       │  3 anillos, selector hoy/semana/mes │
│  sugerido · puntos de hoy                         │  «Ver detalle» (sin puntaje global) │
├────────────────────┬────────────────────┬─────────────────────────────────────────────┤
│ PRIORIDADES (4)    │ MI DÍA (4)         │ ASISTENTE (4)                               │
│ pendientes de hoy  │ Agenda | Correos   │ Alertas y recomendaciones                    │
│ casillas · frente  │ (pestañas)         │ por reglas, con evidencia y acción           │
│ · meta · agregar   │ «Fuente no         │ «Consultar al asistente» (no conectado)      │
│                    │  conectada»        │                                              │
├────────────────────┴────────────────────┴─────────────────────────────────────────────┤
│ RESUMEN EJECUTIVO (12): pendientes abiertos · cerrados 7 días · avance · gasto del mes   │
│ · racha de Jornada    →  «Ver análisis completo» (/panel)                                │
├────────────────────┬────────────────────┬─────────────────────────────────────────────┤
│ DISTRIBUCIÓN POR   │ HÁBITOS DE HOY (4) │ FINANZAS DEL MES (4)                         │
│ FRENTES (4)        │ cumplimiento ·     │ gastos · presupuesto usado · disponible      │
│ atención vs objetivo│ racha · registrar  │ registrar gasto                              │
├────────────────────┴────────────────────┴─────────────────────────────────────────────┤
│ ACCESOS RÁPIDOS: Nuevo pendiente · Registrar gasto · Agregar nota · Capturar idea ·       │
│ Consultar al asistente         (+ botón flotante del asistente, ya existe)                │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Tablet (768–1099 px)
Dos columnas: Focus y Life Pulse a ancho completo apilados; Prioridades + Mi día; Asistente + Resumen; Frentes + Hábitos; Finanzas; accesos rápidos.

### 4.3 Móvil (< 768 px): experiencia propia, una columna

1. Encabezado compacto (saludo y fecha).
2. **Focus** (compacto: reloj o «Iniciar», una línea de controles).
3. **Life Pulse** (tres anillos pequeños en una fila).
4. Prioridades.
5. Mi día (agenda/correos con pestañas).
6. Asistente (alertas; una por vez con «ver más»).
7. Resumen ejecutivo (tarjetas deslizables horizontales).
8. Hábitos.
9. Finanzas.
10. Distribución por frentes.

Accesos rápidos como botón «+» que abre una hoja desde abajo (no una barra fija que tape contenido); asistente flotante y barra inferior sin cambios; objetivos táctiles de 44 px.

## 5. Contenido y estados de cada widget

Cada widget implementa los cinco estados (cargando, vacío, éxito, parcial, error) y además **«Fuente no conectada»** y **«Fase 3 aún no activada»** cuando corresponda. Nunca muestra un cero como ausencia de datos.

| # | Widget | Contenido | Fuente | ¿Conectado hoy? | Acciones directas |
|---|---|---|---|---|---|
| 1 | **Encabezado** | Saludo, fecha (Bogotá), resumen del día | `resumen_dia` | **No** (sin escritor) → «Fuente no conectada» | — |
| 2 | **Focus** (principal) | Reloj/inicio rápido, modalidad, frente, descanso sugerido, puntos de hoy | RPC y tablas Fase 3 | **Interfaz lista; requiere migración** → «Aún no está activado» | Iniciar, pausar, completar, cancelar |
| 3 | **Life Pulse** | Execution, Balance y Wellbeing (hoy/semana/mes), sin puntaje global | Fase 3 | Requiere migración | Cambiar período, ver detalle |
| 4 | **Prioridades** | Pendientes abiertos de hoy y vencidos, casillas, frente, meta, progreso del día | `pendientes`, `metas` | **Sí** | Crear, marcar, borrar (lógica de `Pendientes`) |
| 5 | **Mi día** | Agenda (hora, duración) y correos (pestañas) | `agenda_hoy`, `correos_hoy` | **No** → «Fuente no conectada» | — |
| 6 | **Asistente** | Alertas **por reglas** y recomendaciones con: qué detectó, datos que lo respaldan, por qué importa, acción sugerida | Reglas sobre datos reales | **Sí** (reglas), **IA no conectada** | Ir a la acción; «Consultar» abre el panel (estado «no conectado») |
| 7 | **Resumen ejecutivo** | Pendientes abiertos, cerrados 7 días, avance, gasto del mes, racha de Jornada | `pendientes`, `gastos`, `jornadas` | **Sí** | Ver Panel |
| 8 | **Distribución por frentes** | Puntos de atención frente al objetivo por frente (usa `?frente=`) | `objetivos_atencion`, `focus_sesiones` | Requiere migración | Ir a Atención |
| 9 | **Hábitos de hoy** | Cumplimiento del día, racha, registro | Fase 3 (`habito_*`) o Salud heredado | Salud heredado **sí**; Fase 3 requiere migración | Registrar (ver decisión D-H4) |
| 10 | **Finanzas del mes** | Gastos, presupuesto usado, disponible | `gastos`, `presupuestos` | **Sí** | Registrar gasto |
| 11 | **Accesos rápidos** | Nuevo pendiente, registrar gasto, agregar nota, capturar idea, consultar al asistente | Escrituras a tablas existentes | **Sí** (excepto el asistente) | Hojas con el formulario real |

**Alertas por reglas (widget 6), sin IA, etiquetadas «Alertas automáticas»:** pendiente vencido; compromiso que vence hoy; presupuesto > 90 %; recurrente vencido o a ≤ 3 días; racha de Jornada o de hábito rota; Focus sin sesiones completadas hoy tras N días de objetivo semanal (cuando exista Fase 3). Cada alerta muestra la evidencia. Las recomendaciones de IA real llegan con la API del asistente (fase aparte, requiere tablas de memoria y registro).

## 6. Puntos donde la referencia y las decisiones vigentes difieren

La imagen `reference-home-dashboard.png` tiene elementos que **no** se replican:

| Elemento de la referencia | Decisión propuesta | Motivo |
|---|---|---|
| Paisaje de montañas en el encabezado | **Degradado abstracto** violeta-azul | La especificación (§2) dice «sin fotografías ni paisajes» |
| «Life Pulse 78 %» global y «+5 % vs semana anterior» | **Tres indicadores independientes, sin puntaje global** | Decisión D7 aprobada; y no hay historial para comparar |
| Seis áreas de Life Pulse (Trabajo, Finanzas, Salud, Metas, Personal, Familia) con porcentajes | Execution, Balance, Wellbeing; **Balance por frente** en «Distribución por frentes» | Tu instrucción actual y la especificación de la Fase 3 |
| Porcentajes, «racha 12 días», «dormiste 1,2 h menos», gastos de ejemplo | **Ningún dato de ejemplo**; estados vacíos de calidad | «Sin datos inventados» (brief §2.6 y spec §9) |
| «Avance por frentes 82 %…» | Solo si hay fórmula válida; se llama «Avance de pendientes» y se separa de Balance | Dos métricas distintas |
| Insights de IA con conclusiones | Alertas por reglas con evidencia; «IA no conectada» | No simular IA (spec §4.E) |

## 7. Comparación: Home actual y Home propuesto

| Aspecto | Home actual (provisional) | Home propuesto |
|---|---|---|
| Origen | «Mi día» renombrado + bloques de Fase 3 | Diseño de `03_HOME_DESIGN_SPEC` + tus cinco ejes |
| Primer elemento | Resumen del día («Fuente no conectada») | **Focus** (principal) junto a **Life Pulse** |
| Encabezado | Título y saludo simples | Degradado violeta-azul, saludo, fecha, resumen |
| Focus | Tarjeta pequeña, mitad de ancho | **Hero** de 7/12 con reloj grande y acciones |
| Life Pulse | Tres anillos pequeños de hoy | Tres anillos con selector hoy/semana/mes y detalle |
| Resumen ejecutivo del dashboard | **No existe** (solo «Avance por frente») | Franja con 5 métricas y enlace a Panel |
| Prioridades | Lista heredada «Pendientes» en la columna derecha | Widget propio con casillas, frente, meta, progreso |
| Agenda y correos | Dos bloques con «Fuente no conectada» | Un widget con pestañas y el mismo estado honesto |
| Asistente proactivo | Solo el botón flotante | **Widget de alertas y recomendaciones** + botón flotante |
| Hábitos, Finanzas | No aparecen | Dos widgets propios |
| Distribución por frentes | Tarjeta de ancho completo | Widget de 4/12, con `?frente=` |
| Accesos rápidos | No existen | Barra (escritorio) y hoja «+» (móvil) |
| Actividad reciente | Bloque en la columna izquierda | Pasa a un enlace desde el widget de Prioridades o a Panel (decisión D-H5) |
| Móvil | Mismo orden que escritorio, apilado | Orden y densidad propios |
| Panel | Sin cambios | **Sin cambios**; Home lo enlaza y comparte sus cálculos |
| Datos | Reales; vacíos honestos | Igual, con los cinco estados en cada widget |

## 8. Qué se conserva

Ruta `/` (y `/panel`), todas las rutas y módulos, `Pendientes` heredado y su lógica, el shell de la Fase 2, la barra superior, las tareas programadas y la autenticación. El nombre de la pantalla en la navegación pasa de «Mi día» a «Home» (ya hecho); la especificación de la Fase 3 lo exige (§3.8).

## 9. Plan de implementación (solo tras tu aprobación)

Cada paso se prueba y se revisa contigo antes del siguiente. Ninguno requiere migración salvo donde se indica.

| Paso | Contenido | Migración |
|---|---|---|
| 1 | `lib/domain/resumen.js` y `alertas.js` (puros, con pruebas); sin cambios visibles | No |
| 2 | Encabezado con degradado y estructura de rejilla (escritorio/tablet/móvil) | No |
| 3 | Focus (hero) y Life Pulse reorganizados desde `HomeCentro` | Para ver datos, sí |
| 4 | Prioridades (lógica de `Pendientes` reutilizada, sin tocar el componente heredado) y Mi día (pestañas) | No |
| 5 | Resumen ejecutivo, Finanzas del mes y alertas por reglas | No |
| 6 | Accesos rápidos con hojas de captura reales | No |
| 7 | Hábitos y Distribución por frentes con datos de la Fase 3 | **Sí** |
| 8 | Claro/oscuro, tablet/móvil, contraste, estados, regresión de las 13 rutas | No |

## 10. Decisiones que necesito

| # | Pregunta | Mi recomendación |
|---|---|---|
| D-H1 | ¿Apruebas la distribución de §4 (escritorio, tablet, móvil)? | Sí |
| D-H2 | ¿Focus ocupa 7/12 y Life Pulse 5/12, o prefieres otra proporción? | 7/5 |
| D-H3 | ¿Sigo la especificación (degradado abstracto, sin paisaje ni datos ficticios) y uso la imagen solo como guía de composición? | Sí |
| D-H4 | **Hábitos de hoy:** ¿mostrar los hábitos de **Salud** (heredados, conectados hoy) hasta la migración, o esperar a los de la Fase 3? | Mostrar Salud ahora y migrar la fuente después, sin duplicar |
| D-H5 | ¿Dónde va «Actividad reciente»? | Debajo de Prioridades, plegada, o solo en Panel |
| D-H6 | ¿Las alertas por reglas de §5 son las correctas, o falta alguna? | Aprobar la lista y ajustar |
| D-H7 | ¿Quieres que el resumen ejecutivo use las mismas cifras de Panel (incluida la corrección «cero ≠ sin datos»)? | Sí, solo en Home; Panel queda como está |
