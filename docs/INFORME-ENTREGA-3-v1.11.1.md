# Informe final de la tercera entrega (v1.11.1): Execution, Balance, Wellbeing y Life Pulse

Fecha: 9 nov 2026. Estado: **aprobada** por el usuario (cálculos, pruebas, build, D3-25, consistencia entre períodos, filtro de frente en Balance y ajustes visuales). **No se ejecutó nada en Supabase.**

## 1. Alcance entregado

| Entrega | Contenido | Estado |
|---|---|---|
| 1 | Temporizador global (Focus, descansos, hábitos), página `/focus`, barra persistente en el shell | Aprobada |
| 2 | Hábitos (`/habitos`), objetivos semanales y Balance (`/atencion`) | Aprobada |
| **3** | **Obligaciones y Execution (T-6, D3-25), Wellbeing, Life Pulse diario/semanal/mensual (`/life-pulse`), resumen de hoy en Mi día, filtro de frente en Balance** | **Aprobada** |

## 2. Trazabilidad de decisiones aprobadas

| Decisión | Código | Prueba | Resultado |
|---|---|---|---|
| T-6 prioridad al cierre | `lib/domain/obligaciones.js` (`prioridadEnCierre`, `cierreDeFecha`) | `obligaciones-lifepulse.test.mjs` (corte 05:00 UTC, respaldos, 75 % / 60 %); integración: coincide con `public.prioridad_en_cierre` en 3 registros | PASS |
| T-4 / T-5 / D3-22 / P6 (obligaciones) | `obligacionesDe`, `intervalosDeFecha` | Unitarias (aplazar, eliminar, desmarcar, tardío) e integración sobre datos reales | PASS |
| **D3-25** vence hoy | `componenteExecution`, `execution` (`provisional`, `provisionales`) | 4 unitarias dedicadas + 1 de integración (hoy abierto 25 % provisional → 100 % al cumplir; día = semana = mes) | PASS |
| Consistencia entre períodos | `lifePulse`, `balancePeriodo`, `wellbeing` | `lifepulse-consistencia.test.mjs`: 5 fechas «hoy» × 3 períodos; sumas = suma de días; valor = fórmula sobre sumas (no promedio) | PASS |
| Filtro de frente solo en Balance | `balancePeriodo({ frenteId })`; `MODULOS_CON_FILTRO = ['atencion', 'life-pulse']` | Unitarias (filtro, frente sin objetivo, inválido = todos, Execution y Wellbeing intactos, partes = total) e integración | PASS |
| Sin indicador global | `lifePulse` devuelve tres indicadores separados | Prueba de claves (`global`, `total`, `score`, `puntaje` ausentes) | PASS |
| D3-19a / D3-19b (Balance) | `atencion.js` | Prorrateo en curso, semana sin objetivo, mes con semanas parciales, futuras | PASS |
| D3-3 / §5.4 (Wellbeing) | `habitos.js` (`wellbeing`) | Tope por ocurrencia, cero real, sin datos, cambio de programación | PASS |
| T-7 (objetivos) en el cliente | `AtencionPanel`, `habitos.js` (datos) | Integración: semana pasada = `semana_cerrada` | PASS |

## 3. Pruebas y build (corrida final)

| Suite | Resultado |
|---|---|
| Unitarias (`npm test`) | **451 PASS, 0 FAIL** |
| Integración contra PostgreSQL 16 local desechable (`npm run test:integracion`, puerto 54332, sin credenciales de Supabase) | **27 PASS, 0 FAIL** |
| Build de producción (`npm run build`) | **Compila sin errores**; rutas `/life-pulse`, `/atencion`, `/habitos`, `/focus` presentes |
| Clúster temporal | Destruido al terminar; sin puertos abiertos |

Incluye las 330 pruebas previas de la Fase 2 sin cambios de comportamiento; solo se ajustaron las de navegación (rutas nuevas), tokens (CSS nuevos) y `frenteActivo` (módulos con filtro).

## 4. Archivos de la entrega 3

- **Dominio:** `lib/domain/obligaciones.js`, `lifePulse.js`; ampliados `atencion.js` (filtro de frente) y `habitos.js`.
- **Datos:** `lib/data/lifePulse.js`; `lib/data/rpc.js` (lectura paginada).
- **Interfaz:** `components/lifepulse/LifePulsePanel.js` y su CSS; `app/(app)/life-pulse/page.js`; `AtencionPanel.js` (filtro); `app/(app)/page.js` (bloque «Life Pulse de hoy», 3 líneas aditivas).
- **Navegación y filtro:** `lib/domain/navegacion.js`, `lib/domain/frenteActivo.js`.
- **Pruebas nuevas:** `obligaciones-lifepulse.test.mjs`, `lifepulse-consistencia.test.mjs`; ampliada la integración local.
- **Documentos:** v1.11.1 (especificación, decisiones, diseño técnico, resumen, este informe) y `DECISION-D3-25-EXECUTION-VENCE-HOY.md`.

## 5. Verificación visual (sin sesión real)

Escritorio y móvil (375 px): tres anillos de 128 px legibles, sin desbordes horizontales, avisos «provisional» y de filtro visibles, enlaces táctiles de 44 px. Se hizo con una página temporal de datos de ejemplo, ya eliminada. **La interfaz autenticada con datos reales no se ha visto**: se cubre en `REVISION-HOME-EXPERIENCIA-AUTENTICADA.md`.

## 6. Qué no está validado

- Comportamiento real contra Supabase (PostgREST, JWT, roles): requiere la etapa 0 y autorización.
- La migración v1.11 no está aplicada en Supabase: las pantallas de la Fase 3 muestran «aún no está activado» y no guardan nada.
- Rendimiento de Life Pulse con mucho historial (lee todo `cambios_registro` paginado en cada carga): ver riesgos de la revisión de Home.
- T7-42 y T7-59 de la validación SQL siguen NO RUN (sin cambios).

## 7. Cambios documentales de este cierre

La v1.11 fue **restaurada a su contenido original** (se había anotado D3-25 provisionalmente en tres de sus archivos) y la v1.11.1 consolida lo aprobado. No se modificó SQL: `docs/sql/v1.11` y `docs/validacion-local-v1.11` siguen siendo la referencia validada.
