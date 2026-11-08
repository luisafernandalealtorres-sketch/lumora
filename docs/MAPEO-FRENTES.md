# Mapeo de frentes: nueve existentes contra seis de diseño

**Estado: BORRADOR. No aplicado. Pendiente de tu confirmación.**
No se modificó ningún registro, tabla, columna ni identificador. Los datos de la base no cambian.

## 1. Frentes existentes (leídos de la tabla `frentes`)

| # | `slug` (identificador) | Nombre | `grupo` actual | Filas que lo usan hoy |
|---|---|---|---|---|
| 1 | `ticketcode-eventos` | TICKETCODE · Producción de eventos | ticketcode | 0 |
| 2 | `ticketcode-eve` | TICKETCODE · EVE | ticketcode | 0 |
| 3 | `tanku` | TANKU | tanku | 0 |
| 4 | `hama` | Hama beads | personal | 0 |
| 5 | `crochet` | Crochet | personal | 0 |
| 6 | `jardin` | Jardín de mamá | personal | 0 |
| 7 | `salud-abuela` | Salud de la abuela | personal | 0 |
| 8 | `hogar` | Hogar | personal | 0 |
| 9 | `personal` | Personal general | personal | 0 |

Todas las tablas que usan frentes están vacías (pendientes, metas, gastos, ingresos, recurrentes, notas). Ninguna decisión actual afecta datos existentes.

## 2. Frentes de diseño (especificación)
TANKU · TICKETCODE · Personal · Salud · Familia · Otros proyectos

## 3. Matriz de mapeo propuesta

| `slug` existente | Frente de diseño propuesto | Certeza | Alternativa posible |
|---|---|---|---|
| `ticketcode-eventos` | **TICKETCODE** | Alta | — |
| `ticketcode-eve` | **TICKETCODE** | Alta | — |
| `tanku` | **TANKU** | Alta | — |
| `personal` | **Personal** | Alta | — |
| `hogar` | **Personal** | Media | Familia, si "hogar" incluye a tu familia |
| `jardin` | **Familia** | Media | Personal, si lo ves como un pasatiempo tuyo |
| `salud-abuela` | **Familia** | **Por decidir** | Salud |
| `hama` | **Otros proyectos** | Media | Personal |
| `crochet` | **Otros proyectos** | Media | Personal |

**Salud** no tiene ningún `slug` propio. Hoy solo existe como el módulo de hábitos, medidas y objetivos, que no usa la tabla `frentes`. Para filtros y para Life Pulse, "Salud" sería un frente de diseño sin identificador original, derivado de ese módulo. Esta es una limitación del modelo actual, no del mapeo.

### Resultado por frente de diseño (si se aprueba tal cual)

| Frente de diseño | `slug` que agrupa |
|---|---|
| TICKETCODE | `ticketcode-eventos`, `ticketcode-eve` |
| TANKU | `tanku` |
| Personal | `personal`, `hogar` |
| Salud | (ninguno; hábitos y objetivos de salud) |
| Familia | `jardin`, `salud-abuela` |
| Otros proyectos | `hama`, `crochet` |

## 4. Cómo se garantiza que sea reversible y conserve los identificadores

- **La base de datos no se toca.** Los `slug` originales permanecen exactamente como están, así como la columna `grupo` y su `CHECK`.
- El mapeo vive en **un solo archivo de código** (`web/lib/domain/frentesMap.js`), como una tabla de consulta del tipo `slug → frente de diseño`. Cambiar o deshacer una asociación es editar una línea.
- Filtrar por un frente de diseño equivale a filtrar por la lista de sus `slug` (`frente IN (...)`). No se reescribe ningún dato.
- Un `slug` sin asignación aparece como **"Sin asignar"**, nunca se oculta ni se reasigna en silencio.
- Si más adelante quieres que el modelo guarde esta agrupación en la base, es un cambio de esquema aparte con su propia aprobación.

## 5. Lo que necesito de ti
1. ¿Confirmas la columna "propuesto" tal cual está?
2. Las tres de certeza media o por decidir: **`salud-abuela`** (Familia o Salud), **`jardin`** (Familia o Personal) y **`hogar`** (Personal o Familia).
3. ¿`hama` y `crochet` van en Otros proyectos o en Personal?

Hasta que respondas, la implementación seguirá usando los nueve frentes originales sin agrupar.
