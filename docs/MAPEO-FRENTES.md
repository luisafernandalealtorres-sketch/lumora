# Mapeo de frentes: nueve existentes contra seis de diseño

**Estado: D2 PARCIALMENTE CONFIRMADO.** Una asociación está confirmada (`salud-abuela`). El resto sigue como propuesta pendiente.
No se modificó ningún registro, tabla, columna ni identificador. Los datos de la base no cambian.

## 0. Registro de decisiones

| Fecha | Decisión | Estado |
|---|---|---|
| 8 nov 2026 | **`salud-abuela` pertenece al frente Familia.** Todos los pendientes y registros relacionados con la salud de la abuela se clasifican en Familia | **CONFIRMADA** |
| 8 nov 2026 | **El frente Salud queda reservado para tu propia salud:** hábitos, medidas físicas y objetivos personales de salud | **CONFIRMADA** |
| — | `jardin`, `hogar`, `hama`, `crochet` | Propuesta, **pendiente de confirmación** |

## 1. Frentes existentes (leídos de la tabla `frentes`)

| # | `slug` (identificador, no cambia) | Nombre | `grupo` actual | Filas que lo usan hoy |
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

## 3. Matriz de mapeo

| `slug` existente | Frente de diseño | Estado | Alternativa pendiente |
|---|---|---|---|
| `ticketcode-eventos` | **TICKETCODE** | Propuesto (certeza alta) | — |
| `ticketcode-eve` | **TICKETCODE** | Propuesto (certeza alta) | — |
| `tanku` | **TANKU** | Propuesto (certeza alta) | — |
| `personal` | **Personal** | Propuesto (certeza alta) | — |
| `hogar` | **Personal** | Propuesto, pendiente | Familia, si "hogar" incluye a tu familia |
| `jardin` | **Familia** | Propuesto, pendiente | Personal |
| **`salud-abuela`** | **Familia** | **CONFIRMADO** | — |
| `hama` | **Otros proyectos** | Propuesto, pendiente | Personal |
| `crochet` | **Otros proyectos** | Propuesto, pendiente | Personal |

### Resultado por frente de diseño

| Frente de diseño | `slug` que agrupa | Estado |
|---|---|---|
| TICKETCODE | `ticketcode-eventos`, `ticketcode-eve` | Propuesto |
| TANKU | `tanku` | Propuesto |
| Personal | `personal`, `hogar` | Propuesto |
| **Familia** | **`salud-abuela`** (confirmado), `jardin` (propuesto) | Parcial |
| Otros proyectos | `hama`, `crochet` | Propuesto |
| **Salud** | **(ningún `slug`)**: tus hábitos, medidas y objetivos de salud | **Confirmado como concepto** |

## 4. Consecuencias de la decisión

1. **Familia** incluye todo lo de la salud de tu abuela. Sus pendientes, gastos, metas y notas se filtrarán bajo Familia, y ese frente alimentará el indicador de Familia en Life Pulse.
2. **Salud** es solo tuya. En el modelo actual eso corresponde a los módulos de hábitos, medidas y objetivos de salud, que **no usan la tabla `frentes`**.
3. **Limitación que conviene que conozcas:** como Salud no tiene `slug`, hoy no puedes clasificar como "Salud" un **pendiente, gasto, meta o nota** tuyo (por ejemplo, una cita médica tuya o una compra de farmacia). Esos registros solo pueden ir en `personal` u otro frente existente.
4. **Cómo se resolvería (no está hecho, necesita tu aprobación aparte):** agregar una fila `salud` a la tabla `frentes`. Es un dato nuevo, no un cambio de esquema, pero sí modifica la base. Además, la columna `grupo` solo admite `ticketcode`, `tanku` y `personal`, así que la fila nueva tendría que usar `personal`. Hasta que decidas, el frente de diseño Salud existe solo como concepto de interfaz.

## 5. Cómo se garantiza que sea reversible y conserve los identificadores

- **La base de datos no se toca.** Los `slug` originales permanecen exactamente como están, así como la columna `grupo` y su `CHECK`.
- El mapeo vive en **un solo archivo de código** (`web/lib/domain/frentesMap.js`, aún no creado), como una tabla de consulta del tipo `slug → frente de diseño`. Cambiar o deshacer una asociación es editar una línea.
- Filtrar por un frente de diseño equivale a filtrar por la lista de sus `slug` (`frente IN (...)`). No se reescribe ningún dato.
- Un `slug` sin asignación aparece como **"Sin asignar"**, nunca se oculta ni se reasigna en silencio.
- Si más adelante quieres que el modelo guarde esta agrupación en la base, es un cambio de esquema aparte con su propia aprobación.

## 6. Pendiente de ti
1. `jardin`: ¿Familia (propuesto) o Personal?
2. `hogar`: ¿Personal (propuesto) o Familia?
3. `hama` y `crochet`: ¿Otros proyectos (propuesto) o Personal?
4. ¿Quieres que se agregue la fila `salud` a `frentes` para clasificar pendientes, gastos y notas propios? Es opcional y requiere aprobación separada.

Hasta que respondas, la implementación solo aplicará la asociación confirmada (`salud-abuela` → Familia). Las demás seguirán usando los nueve frentes originales sin agrupar.
