# Home, centro de control: propuesta definitiva para aprobación

Fecha: 10 nov 2026. Estado: **propuesta. No se programó nada, no se eliminó ni reemplazó ningún componente.** Sin SQL en Supabase, sin migraciones, sin cambios de autenticación, RLS ni middleware, sin commits. **Reemplaza a `04_HOME_PROPUESTA_VISUAL.md`**, que era una versión previa más cargada de tarjetas.

Base: `01_PRODUCT_DESIGN_BRIEF`, `02_INFORMATION_ARCHITECTURE`, `03_HOME_DESIGN_SPEC`, `reference-home-dashboard.png`, `AUDITORIA-Y-PLAN-HOME.md`, la especificación v1.11.1 y tu brief de rediseño.

## 1. Cómo responde Home a las seis preguntas

| Pregunta | Dónde se responde | Cómo |
|---|---|---|
| ¿Cómo avanzo en mis seis frentes? | **Mapa de frentes** | Una fila por frente con atención frente al objetivo, pendientes, metas y un indicador «requiere atención» con la regla a la vista |
| ¿Qué necesita mi atención hoy? | Encabezado + **Próximas acciones** | Una alerta destacada (solo con datos reales) y una lista corta ordenada por reglas |
| ¿Cuáles son mis prioridades? | **Hoy: Prioridades** | Vencidos, que vencen hoy y fijados, con casilla y frente |
| ¿En qué invierto mi tiempo? | Focus + Mapa de frentes | Horas y sesiones de Focus por frente; tiempo de hábitos aparte (no suma puntos) |
| ¿Cómo están mis objetivos? | Life Pulse + Resumen ejecutivo | Balance frente a objetivos semanales; avance de metas |
| ¿Qué debería hacer a continuación? | **Próximas acciones** | Lista determinista con el motivo y los datos que la respaldan |

## 2. Recuperación del dashboard original

Se revisaron las tres versiones que ya existían:

| Versión | Qué era | Qué se recupera |
|---|---|---|
| **Home original** (commit `e188993`, «Respaldo base antes del rediseño») | «Mi día»: resumen, agenda, correos, avance por frente, pendientes (`Pendientes.js`) | Todas sus funciones se conservan (§8) |
| **Panel** (`/panel`, sigue intacto) | 6 indicadores y 4 gráficos | Indicadores del resumen ejecutivo (§4) |
| **Artefacto «Mi día»** (`mi-dia/tablero.html`, actualizado hoy por la tarea de las 6:00 a. m.) | Tablero estático con resumen, agenda, correos y pendientes **con datos reales de Google Calendar y Gmail** | Confirma qué fuentes existen en el mundo de Claude; **no** llegan a la aplicación (§6) |
| **Referencia visual** (`reference-home-dashboard.png`) | Composición: encabezado, Life Pulse, rejilla de widgets, accesos rápidos | Solo la composición; no sus datos ni el paisaje (§9) |

## 3. Inventario de componentes y métricas reutilizables

### 3.1 Componentes (ninguno se elimina ni se reemplaza)

| Componente existente | Origen | Uso en la nueva Home |
|---|---|---|
| `Card`, `Chip`, `ProgressBar`, `Ring`, `Sparkline`, `Skeleton`, `EmptyState`, `ErrorState`, `EstadoDatos`, `Icon` | Fase 1 | Base de todos los bloques; ya cubren cargando, vacío, error y «sin datos» |
| Tokens claro/oscuro/sistema, degradado de encabezado | Fase 1 | Dirección visual vigente |
| Barra superior (búsqueda, notificaciones, perfil), barra lateral, barra móvil, asistente flotante | Fase 2 | Sin cambios |
| `TemporizadorProvider`, `Controles`, formulario de inicio | Fase 3 | Bloque Focus |
| Anillos de Life Pulse (`LifePulsePanel`, `HomeCentro`) | Fase 3 | Bloque Life Pulse (se reorganiza el contenedor) |
| `balancePeriodo`, `puntosPorFrente` | Fase 3 | Mapa de frentes |
| `frentesMap` (6 frentes de diseño ← 9 slugs), `tonos` (color por frente) | Fase 1 | Mapa de frentes |
| `Pendientes.js` (alta, marcar, borrar, meta) | heredado | **Intacto**; la lista completa queda como «Todos los pendientes» |
| `EstadoFuente`, `fuentes.js` | Fase 3 | Franja «Fuentes» |
| `lib/format.js` (`cop`, `racha`, `esNegocio`, `CATEGORIAS`, `mesActual`) | heredado | Resumen ejecutivo y reglas |
| Lógica de `Metas.js` (`progreso`), `Finanzas.js` (presupuesto), `Salud.js` (racha de hábitos) | heredado | Se **extrae a funciones puras** (`lib/domain/resumen.js`) sin cambiar esos módulos |

### 3.2 Métricas del dashboard existente

| Métrica (de `/panel`, Metas, Finanzas, Salud) | Fórmula actual | Fuente | Lugar en Home |
|---|---|---|---|
| Pendientes abiertos / cerrados en 7 días | `!hecho` / `hecho_en ≥ hace 7 días` | `pendientes` | Resumen ejecutivo |
| Avance general de pendientes | `(total − abiertos) / total` | `pendientes` | Resumen ejecutivo (con «sin datos») |
| **Avance de objetivos (metas)** | `(hitos hechos + tareas hechas) / (hitos + tareas)` por meta | `metas`, `hitos`, `pendientes.meta_id` | Resumen ejecutivo |
| Gasto del período y por categoría | suma de `valor_cop` | `gastos` | Resumen ejecutivo |
| Negocio frente a personal | `esNegocio(slug)` | `gastos.frente` | Mapa de frentes (TANKU y TICKETCODE) |
| Presupuesto usado y disponible | gasto del mes / presupuesto | `gastos`, `presupuestos` | Resumen ejecutivo y alertas |
| Actividad y racha de Jornada | `racha(fechas)`; días con jornada en la semana | `jornadas` | Resumen ejecutivo |
| Racha y cumplimiento de hábitos (Salud heredado) | `Salud.js` | `habitos`, `habito_registros` | Resumen ejecutivo |
| Notas por frente | conteo | `notas` | Mapa de frentes |

**Se corrige solo en Home:** un valor sin datos se muestra «Sin datos», nunca «0», «0 %» ni «$ 0» (hoy `/panel` y `Metas` muestran 0 cuando no hay datos). `/panel` no se toca.

## 4. Distribución propuesta en escritorio

Siete bloques con propósito, en lugar de once tarjetas. Hábitos y finanzas dejan de ser tarjetas propias y pasan a ser filas del resumen ejecutivo.

```
┌ Barra superior (ya existe) ────────────────────────────────────────────────────────┐
│ A. ENCABEZADO INTELIGENTE (degradado violeta-azul)                                     │
│    Buenas tardes, Lu · fecha · resumen del día (solo si hay fuente)                   │
│    [Alerta destacada — únicamente con datos reales]                                   │
├──────────────────────────────────────────────┬───────────────────────────────────────┤
│ B. FOCUS (principal, 7/12)                    │ C. LIFE PULSE (5/12)                   │
│ reloj · sesión actual · estado · iniciar rápido│ Execution · Balance · Wellbeing        │
│ descanso sugerido · puntos de hoy             │ hoy / semana / mes · sin score global   │
│                                               │ «Análisis completo»                     │
├──────────────────────────────────────────────┴───────────────────────────────────────┤
│ MAPA DE FRENTES (8/12) — los seis frentes      │ F. PRÓXIMAS ACCIONES (4/12)             │
│ fila por frente: registros de la semana (barra)│ alertas · oportunidades ·               │
│ atención vs objetivo · pendientes · requiere   │ recomendaciones, cada una con motivo    │
│ atención (regla visible)                       │ y datos que la respaldan                │
│ barra apilada: dónde se concentra la actividad │                                         │
├──────────────────────────────────────────────┴───────────────────────────────────────┤
│ E. HOY (6/12): prioridades · pendientes        │ D. RESUMEN EJECUTIVO (6/12)             │
│ (agenda y correos solo si hay fuente)          │ pendientes · metas · gastos · Jornada · │
│                                               │ hábitos → «Ver Panel»                    │
├──────────────────────────────────────────────┴───────────────────────────────────────┤
│ Franja: Fuentes (agenda, correos, resumen: estado) · Accesos rápidos (acciones reales)   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

## 5. Distribución de los seis frentes

**TANKU, TICKETCODE, Personal, Salud, Familia y Otros proyectos** (agrupación `frentesMap`, aprobada el 8 nov). Una fila por frente, siempre los seis, siempre en el mismo orden:

| Columna | Qué muestra | Fuente | Hoy | Tras migración |
|---|---|---|---|---|
| Registros de la semana | pendientes completados + notas + sesiones Focus completadas, **en cifras**, con barra de proporción | `pendientes`, `notas`, `focus_sesiones` | Parcial (sin Focus) | Completo |
| Atención frente al objetivo | puntos de Focus / objetivo prorrateado (Balance); «Sin objetivo» si no hay | `objetivos_atencion` | No | Sí |
| Pendientes | abiertos, vencidos, completados | `pendientes` | Sí | — |
| Metas | activas y avance | `metas`, `hitos` | Sí | — |
| TANKU y TICKETCODE además | gasto de negocio del mes; pendientes vencidos; horas de Focus | `gastos`, `pendientes`, `focus_sesiones` | Parcial | Completo |
| **Requiere atención** | marca con la regla que la disparó (no hay puntaje oculto) | reglas abajo | Parcial | Completo |

**Barra apilada superior «dónde se concentra la actividad»:** reparte los registros de la semana entre los seis frentes. Es una proporción de registros reales, **no un puntaje**; si no hay registros, dice «Sin registros esta semana».

**Reglas de «requiere atención»** (propuestas, con umbrales a tu aprobación):
1. Pendientes vencidos > 0 en el frente.
2. Frente con pendientes abiertos y **sin ningún registro en 7 días**.
3. Atención < 50 % del objetivo prorrateado cuando ya pasó el 60 % de la semana (necesita Fase 3).
4. Frente con objetivo semanal y sin sesiones de Focus completadas en los últimos 3 días (necesita Fase 3).

Salud: el frente existe en el mapa (`salud`), con hábitos, medidas y objetivos de Salud heredado; Familia incluye `jardin` y `salud-abuela`. Un frente sin ningún dato muestra «Sin registros», no 0.

## 6. Datos disponibles, fuentes no conectadas y pendientes

Estado real hoy (revisado con tu sesión): **todas las tablas heredadas están conectadas pero vacías** (Panel muestra cero en todo); las tablas de la Fase 3 no existen aún en Supabase.

| Dato | Estado | Detalle |
|---|---|---|
| Pendientes, metas, hitos, gastos, ingresos, presupuestos, jornadas, notas, biblioteca, Salud heredado | **Conectado, sin registros** | Los bloques se ven con estados vacíos de calidad |
| Temporizador, Focus, Life Pulse, hábitos Fase 3, objetivos, Balance | **Pendiente de migración v1.11** (requiere tu autorización) | Mismos bloques, estado «Fase 3 aún no activada» |
| **Agenda, correos, resumen del día** | **Fuente no conectada** | Nada escribe en `agenda_hoy`, `correos_hoy`, `resumen_dia`. El artefacto «Mi día» sí recibe esos datos reales cada mañana (Calendar y Gmail), pero solo en `tablero.html` |
| Prioridad de pendientes, orden y «fijados» | Pendiente de migración | Mientras tanto «Prioridades» = vencidos + vencen hoy + más antiguos |
| Asistente con IA | No conectado | Solo alertas y recomendaciones por reglas |
| Alertas de presupuesto/recurrentes en notificaciones | Visual | Se alimentan de las mismas reglas cuando se aprueben |

**Política de fuentes (según tu brief):** agenda, correos y eventos **no ocupan una tarjeta** mientras su fuente no esté conectada; en su lugar, una **franja «Fuentes»** discreta indica su estado («Agenda: no conectada»). Así no se simula nada y tampoco se oculta sin explicación. Conectarlas es una decisión aparte (§10, D-N6): por ejemplo, que la tarea de las 6:00 a. m. escriba en Supabase en lugar de solo en `tablero.html` (no es una migración, pero sí escrituras de datos reales y requiere tu autorización).

## 7. Inteligencia y recomendaciones (bloque F)

**Alertas por reglas, no IA**, con la etiqueta «Alertas automáticas». Cada una muestra: qué detectó, con qué datos, por qué importa y qué acción sugiere.

| Tipo | Regla | Datos | Hoy |
|---|---|---|---|
| Alerta | Pendiente vencido | `pendientes.fecha_limite` | Sí |
| Alerta | Vence hoy y sigue abierto | idem | Sí |
| Alerta | Presupuesto usado > 90 % | `gastos`, `presupuestos` | Sí |
| Alerta | Recurrente vencido o a ≤ 3 días | `recurrentes` | Sí |
| Alerta | Racha de Jornada rota (ayer sin jornada) | `jornadas` | Sí |
| Oportunidad | Meta a ≤ 1 hito de completarse | `metas`, `hitos` | Sí |
| Oportunidad | Presupuesto disponible y mes avanzado | `presupuestos` | Sí |
| Recomendación | Frente con pendientes y sin registros en 7 días | `frentesMap` | Sí |
| Alerta | Objetivo de atención en riesgo | `objetivos_atencion` | Fase 3 |
| Alerta | Focus sin sesión completada hace 3 días con objetivo semanal | `focus_sesiones` | Fase 3 |

**Próximas acciones:** lista de 3 a 5 elementos ordenada por una regla fija y visible: 1) vencidos, del más antiguo; 2) vencen hoy; 3) objetivo de atención en riesgo; 4) recurrente o presupuesto; 5) Jornada de hoy sin escribir (a partir de las 7 p. m.). Cada una con su motivo. **Sin datos reales, el bloque dice «Nada requiere tu atención ahora» solo si las fuentes se leyeron bien; si una fuente falló, lo dice.** Las recomendaciones de IA real llegan con la API del asistente (fase aparte: requiere tablas de memoria y registro, o sea aprobación de esquema).

## 8. Qué se conserva

Ruta `/` y `/panel`; todas las rutas y módulos; `Pendientes` intacto (queda como «Todos los pendientes»); `Mi día` como función (Home la contiene); shell de la Fase 2; autenticación, middleware y RLS; tareas programadas. Ningún componente se elimina ni se reemplaza: los provisionales (`HomeCentro`, `EstadoFuente`, el bloque de actividad reciente) se **reubican** dentro de la nueva estructura.

## 9. Home y Panel

| | **Home** | **Panel** |
|---|---|---|
| Rol | Centro de control: resumen ejecutivo, prioridades y acciones | Dashboard detallado, análisis histórico y consulta de métricas |
| Horizonte | Hoy y esta semana (mes en el resumen) | Mes e histórico |
| Interacción | Actuar sin salir (iniciar Focus, completar, registrar) | Leer, comparar, filtrar |
| Métricas | Las 5 o 6 que cambian decisiones, con enlace | Todas, con desgloses (categorías, notas por frente, negocio/personal) |
| Qué **no** repite | Gasto por categoría, notas por frente, series históricas | — |

La referencia visual difiere así: sin paisaje (degradado abstracto), sin puntaje global ni porcentajes de ejemplo, y las «recomendaciones de IA» son alertas por reglas.

## 10. Comparación

| Aspecto | Home original (`e188993`) | Home actual (provisional) | **Home propuesto** |
|---|---|---|---|
| Naturaleza | «Mi día» | «Mi día» + tarjetas de Fase 3 | **Centro de control** |
| Primer vistazo | Resumen del día | Resumen («Fuente no conectada») | **Focus + Life Pulse** |
| Focus | No existe | Tarjeta pequeña | **Principal** (7/12) |
| Life Pulse | No existe | 3 anillos de hoy | 3 anillos con hoy/semana/mes y análisis |
| Seis frentes | «Avance por frente» (9 slugs) | Tarjeta de atención | **Mapa de frentes** de los seis, con «requiere atención» |
| Resumen ejecutivo | No | No | **Sí** (pendientes, metas, gastos, Jornada, hábitos) |
| Prioridades | Lista de pendientes | Lista de pendientes | Prioridades + «Todos los pendientes» |
| Agenda y correos | Tarjetas (vacías) | Tarjetas «Fuente no conectada» | **Franja «Fuentes»**; tarjeta solo si hay fuente |
| Inteligencia | No | No | **Próximas acciones** con motivo |
| Tarjetas | 5 | 8 | **7 bloques con propósito** |
| Móvil | Apilado | Apilado | Orden propio |
| Estados | Vacío genérico | Honestos en parte | Cinco estados + fuente no conectada + Fase 3 |

## 11. Responsive (móvil, < 768 px)

Experiencia propia, una columna, objetivos táctiles de 44 px:
1. Encabezado compacto (saludo, fecha; alerta destacada si existe).
2. **Focus** (reloj o «Iniciar»).
3. **Life Pulse** (tres anillos pequeños en una fila).
4. **Próximas acciones** (la primera visible; «ver más»).
5. **Hoy:** prioridades.
6. **Mapa de frentes:** seis filas compactas; la barra de concentración arriba.
7. **Resumen ejecutivo:** tarjetas horizontales deslizables.
8. Franja «Fuentes».
Accesos rápidos: botón «+» con hoja inferior (no una barra fija que tape contenido). Tablet (768–1099 px): dos columnas.

## 12. Plan de implementación (solo tras tu aprobación)

| Paso | Contenido | Migración |
|---|---|---|
| 1 | `resumen.js` y `alertas.js` puros, con pruebas; sin cambios visibles | No |
| 2 | Estructura de rejilla y encabezado inteligente; reubicar los bloques provisionales | No |
| 3 | Mapa de frentes (parte heredada: pendientes, metas, notas, gastos) | No |
| 4 | Hoy: prioridades y «Todos los pendientes»; franja «Fuentes» | No |
| 5 | Resumen ejecutivo y Próximas acciones (reglas disponibles hoy) | No |
| 6 | Accesos rápidos con formularios reales | No |
| 7 | Focus, Life Pulse y atención de los frentes con datos de la Fase 3; reglas 3 y 4 | **Sí** |
| 8 | Claro/oscuro/sistema, tablet, móvil, contraste, regresión de las 13 rutas | No |

## 13. Decisiones que necesito

| # | Pregunta | Recomendación |
|---|---|---|
| D-N1 | ¿Apruebas la estructura de siete bloques (§4) y el orden móvil (§11)? | Sí |
| D-N2 | **Mapa de frentes:** ¿«registros de la semana» (pendientes completados + notas + sesiones de Focus, en cifras) es la definición correcta de «actividad»? | Sí; sin puntaje compuesto |
| D-N3 | ¿Apruebas las cuatro reglas de «requiere atención» y sus umbrales (§5)? | Sí, ajustables |
| D-N4 | ¿Apruebas el catálogo de alertas, oportunidades y recomendaciones por reglas (§7)? | Sí |
| D-N5 | ¿Los valores sin datos se muestran «Sin datos» en Home aunque `/panel` siga mostrando 0? | Sí; Panel se corrige aparte |
| D-N6 | **Agenda y correos:** ¿franja «Fuentes» en lugar de tarjetas mientras no estén conectadas? ¿Y quieres evaluar después que la tarea de las 6:00 a. m. escriba en Supabase? | Sí a ambas, la segunda como decisión aparte |
| D-N7 | Hábitos de hoy: ¿los de Salud heredado ahora y los de la Fase 3 tras la migración, sin duplicar? | Sí |
| D-N8 | ¿Focus 7/12 y Life Pulse 5/12? | Sí |
