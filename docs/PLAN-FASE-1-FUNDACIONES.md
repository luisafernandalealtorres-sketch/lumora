# Plan detallado: Fase 1, Fundaciones

Estado: **PLAN PARA REVISIÓN. No se ejecutó ningún cambio de la Fase 1.**
Fecha: 8 nov 2026. Base: `docs/design/*`, `AUDITORIA-Y-PLAN-HOME.md`, `MAPEO-FRENTES.md`.

Reglas que se respetan en todo el plan: sin cambios en Supabase, RLS, autenticación ni rutas existentes; sin dependencias nuevas; sin datos ficticios fuera de un entorno aislado y rotulado; los estilos de los módulos antiguos no cambian de aspecto; cada subfase termina con compilación, pruebas, commit sin secretos y un informe.

---

## 1. Objetivo y alcance

**Objetivo:** dejar listo el terreno visual y técnico sobre el que se construirán el shell (Fase 2) y Home (Fases 3 a 5), sin tocar la apariencia ni el comportamiento de lo que ya funciona.

**Entra en la Fase 1**
1. Tokens de diseño claro y oscuro (`--ds-*`) con contraste verificado automáticamente.
2. Mecanismo de tema claro, oscuro y sistema, sin parpadeo al cargar.
3. Conjunto base de componentes con CSS Modules: iconos, tarjeta, chip, barra y anillo de progreso, minigráfica, esqueleto de carga, estado vacío, estado de error, selector de tema.
4. Contrato de estados de datos (cargando, vacío, éxito, error, parcial) y contrato de indicador (para Life Pulse).
5. Helpers de fecha con zona horaria de Colombia.
6. Valores iniciales explícitos de frente por formulario (observación 1).
7. Un laboratorio visual aislado para revisar todo en claro y oscuro, y en escritorio y móvil.

**No entra en la Fase 1:** shell y menú (Fase 2), Header y Life Pulse con datos reales (Fase 3), widgets de Home (Fase 4), alertas, accesos rápidos y búsqueda (Fase 5), asistente (Fase 6), rediseño de los módulos antiguos, cualquier cambio de rutas, el indicador global de equilibrio personal, consultas a Supabase nuevas.

---

## 2. Hallazgos que condicionan el plan

| # | Hallazgo | Evidencia | Consecuencia |
|---|---|---|---|
| H1 | La paleta oscura de la especificación **cumple** contraste en todas las combinaciones medidas | Texto principal 14,7 a 18,7:1; secundario 6,1 a 7,7:1; acentos 6,3 a 10,4:1 | Se usa tal cual |
| H2 | La paleta clara **cumple**, pero con poco margen en el texto secundario | `#716B82` sobre `#F5F4FA` = **4,65:1** (mínimo 4,5) | Se usa tal cual; el test automático impide que baje |
| H3 | Los colores de estado de la especificación (éxito, advertencia, error) son **solo para oscuro** y **fallan en claro** | Sobre blanco: `#34D399` 1,92:1; `#FBBF24` 1,67:1; `#F87171` 2,77:1 | Hay que derivar tonos para claro (ver 5.2). Esto requiere tu confirmación |
| H4 | Los estilos globales actuales usan **selectores de elemento** (`header`, `h1`, `h2`, `section`, `ul`, `li`, `body`) | `globals.css`, líneas 12 a 28 | Los componentes nuevos heredarían bordes, rellenos y fuentes de los módulos antiguos. Hay que aislarlos (D-F1) |
| H5 | El modo oscuro actual depende **solo** de la preferencia del sistema; no entiende un interruptor manual | Una sola consulta `prefers-color-scheme` | Si el tema nuevo se activa manualmente, las pantallas antiguas se verían claras mientras las nuevas se ven oscuras (D-F1) |
| H6 | Tres formularios toman su frente inicial de `frentes[0]`, es decir, **del campo `orden`** de la base | Pendientes, Metas y Cerebro (`frentes[0]?.slug ?? 'personal'`); Gastos y Finanzas usan `'personal'` explícito | Es la dependencia que señalaste. Se corrige en la subfase 1.4 (D-F3) |
| H7 | No existe ninguna prueba de interfaz ni de contraste | Solo hay pruebas de lógica pura | Se agregan pruebas de contraste y de lógica nueva a `npm test` |

---

## 3. Subfases y puntos de aprobación

| Subfase | Contenido | Complejidad | Punto de aprobación |
|---|---|---|---|
| **1.0 Línea base** | Capturas y estilos calculados de las 9 pantallas actuales (para comparar al final) y `npm test` en verde | S | No |
| **1.1 Tokens y tema** | `tokens.css`, script de tema, `ThemeToggle`, compatibilidad de las pantallas antiguas, prueba de contraste | M | **Sí** |
| **1.2 Iconos y primitivas** | `Icon`, `Card`, `Chip`, `ProgressBar` | M | No |
| **1.3 Visualización y estados** | `Ring`, `Sparkline`, `Skeleton`, `EmptyState`, `ErrorState`, `EstadoDatos` | M | **Sí** |
| **1.4 Dominio y formularios** | `fechas.js`, contrato de indicador, valores iniciales explícitos de frente | S | No |
| **1.5 Laboratorio y validación** | Ruta `/laboratorio` (solo desarrollo), regresión de las 9 pantallas, informe final | M | **Sí** |

Complejidad global de la Fase 1: **M a L**. Cada subfase se confirma con compilación, pruebas, revisión visual con tu sesión y un commit propio.

---

## 4. Archivos

### 4.1 A crear

| Archivo | Subfase | Propósito |
|---|---|---|
| `web/styles/tokens.css` | 1.1 | Todos los tokens `--ds-*` (color, radio, espaciado, sombras, movimiento, tipografía) en claro y oscuro |
| `web/lib/theme.js` | 1.1 | Clave de almacenamiento, valores válidos, texto del script anti-parpadeo |
| `web/components/ui/ThemeToggle.js` y `.module.css` | 1.1 | Selector claro, oscuro, sistema |
| `web/components/ui/icons.js` | 1.2 | Mapa de iconos SVG propios (unos 34) |
| `web/components/ui/Icon.js` | 1.2 | Componente `Icon` |
| `web/components/ui/Card.js` y `.module.css` | 1.2 | Superficie con encabezado opcional |
| `web/components/ui/Chip.js` y `.module.css` | 1.2 | Etiqueta de frente y de estado |
| `web/components/ui/ProgressBar.js` y `.module.css` | 1.2 | Barra de progreso con estado "sin datos" |
| `web/components/ui/Ring.js` y `.module.css` | 1.3 | Anillo de progreso con estado "sin datos" |
| `web/components/ui/Sparkline.js` y `.module.css` | 1.3 | Minigráfica de tendencia |
| `web/components/ui/Skeleton.js` y `.module.css` | 1.3 | Esqueleto de carga |
| `web/components/ui/EmptyState.js` y `.module.css` | 1.3 | Estado vacío |
| `web/components/ui/ErrorState.js` y `.module.css` | 1.3 | Estado de error con reintento |
| `web/components/ui/EstadoDatos.js` | 1.3 | Envoltorio que elige entre cargando, vacío, error y contenido |
| `web/lib/domain/fechas.js` | 1.4 | Fechas y saludo con zona America/Bogota |
| `web/lib/domain/indicadores.js` | 1.4 | Contrato y utilidades de indicador |
| `web/lib/domain/formularios.js` | 1.4 | Frente inicial **explícito** de cada formulario |
| `web/app/(app)/laboratorio/page.js` | 1.5 | Galería de componentes (solo desarrollo) |
| `web/app/(app)/laboratorio/demo.js` | 1.5 | Datos de demostración aislados y rotulados |
| `web/tests/contraste.test.mjs` | 1.1 | Verifica contraste de `tokens.css` |
| `web/tests/fechas.test.mjs`, `indicadores.test.mjs`, `formularios.test.mjs` | 1.4 | Lógica nueva |
| `web/tests/aislamiento-demo.test.mjs` | 1.5 | Garantiza que los datos de demostración no se importan fuera del laboratorio |
| `docs/FUNDACIONES.md` | 1.5 | Guía de tokens y componentes |

### 4.2 A modificar

| Archivo | Subfase | Cambio |
|---|---|---|
| `web/app/layout.js` | 1.1 | Importar `tokens.css`, agregar el script de tema y `suppressHydrationWarning` en `<html>` |
| `web/app/globals.css` | 1.1 | **Solo con tu aprobación (D-F1):** envolver lo existente en una capa de menor prioridad y agregar compatibilidad con el tema manual. No cambia ninguna regla existente |
| `web/components/Pendientes.js`, `Metas.js`, `Cerebro.js`, `Gastos.js`, `Finanzas.js` | 1.4 | **Solo con tu aprobación (D-F3):** el frente inicial pasa a leerse de `formularios.js` (una línea y una importación por componente) |

### 4.3 No se toca
`middleware.js`, `lib/supabase/*`, `app/login`, `app/auth`, las páginas de los módulos, las rutas existentes, Supabase (esquema, RLS, datos), `package.json` (salvo el script `test` ya agregado).

---

## 5. Tokens

### 5.1 Valores de la especificación (se usan tal cual)

| Token | Oscuro | Claro |
|---|---|---|
| `--ds-bg` | `#0B0B16` | `#F5F4FA` |
| `--ds-bg-2` | `#111020` | derivado |
| `--ds-surface` | `#19182B` | `#FFFFFF` |
| `--ds-surface-raised` | `#242239` | derivado |
| `--ds-primary` | `#A78BFA` | `#7654CB` |
| `--ds-secondary` | `#60A5FA` | derivado |
| `--ds-success` / `--ds-warning` / `--ds-danger` | `#34D399` / `#FBBF24` / `#F87171` | **derivados (ver 5.2)** |
| `--ds-text` | `#F8FAFC` | `#28223D` |
| `--ds-text-2` | `#A1A1B5` | `#716B82` |

### 5.2 Valores derivados que necesitan tu confirmación (D-F4)
La especificación no define estos tonos para el modo claro. Propongo los siguientes, ya medidos:

| Token (claro) | Valor propuesto | Contraste sobre blanco | Sobre `#F5F4FA` |
|---|---|---|---|
| `--ds-success` | `#15803D` | 5,02:1 | 4,59:1 |
| `--ds-warning` | `#B45309` | 5,02:1 | 4,59:1 |
| `--ds-danger` | `#B91C1C` | 6,47:1 | 5,92:1 |
| `--ds-secondary` | `#2563EB` | 5,17:1 | 4,73:1 |

`--ds-bg-2`, `--ds-surface-raised` y los fondos suaves de chips se derivan de la paleta y se verifican con la misma prueba.

### 5.3 Otros grupos de tokens
- **Frentes:** un color por frente de diseño (`--ds-frente-tanku`, `-ticketcode`, `-personal`, `-salud`, `-familia`, `-otros`), con su fondo suave. La referencia sugiere violeta, azul, verde, naranja, rosa y lila. Se propondrán en el laboratorio para que los apruebes viéndolos.
- **Forma:** radios (`sm 8`, `md 12`, `lg 16`, `pill`), espaciado en escala de 4 px, sombras de dos niveles.
- **Tipografía:** se conservan Bricolage Grotesque (títulos) e Instrument Sans (texto); escala de 12 a 32 px.
- **Movimiento:** duraciones cortas y una regla global que anula las animaciones con `prefers-reduced-motion`.
- **Degradado del encabezado:** token del degradado abstracto azul-violeta (sin imagen, sin paisaje), usado desde la Fase 3.

### 5.4 Convención de uso
Los componentes nuevos usan **solo** `--ds-*` y CSS Modules. Ningún color escrito a mano. Los módulos antiguos siguen con sus variables actuales.

---

## 6. Tema claro, oscuro y sistema

- Preferencia guardada en el navegador (`localStorage`, con `try/catch`) con tres valores: `light`, `dark`, `system`.
- Un script mínimo y síncrono en el `<head>` aplica el atributo `data-theme` **antes del primer pintado**, para evitar el parpadeo. `system` no pone atributo y manda `prefers-color-scheme`.
- CSS en el patrón de tres estados: valores claros en `:root`; los oscuros bajo `@media (prefers-color-scheme: dark)` protegido con `:not([data-theme="light"])`, y de nuevo bajo `[data-theme="dark"]`. `color-scheme` sigue al tema para controles y barras de desplazamiento.
- `ThemeToggle` es un grupo de tres opciones accesible por teclado. En la Fase 1 solo se ve en el laboratorio; entra al menú en la Fase 2.

---

## 7. Componentes: contrato y estados

| Componente | Entradas principales | Estados y reglas |
|---|---|---|
| `Icon` | `name`, `size`, `title` | Decorativo (`aria-hidden`) salvo que lleve `title`. Usa `currentColor`. Iconos: inicio, panel, metas, finanzas, salud, jornada, biblioteca, cerebro, búsqueda, campana, más, check, flechas, chispas, rayo, calendario, correo, ajustes, sol, luna, monitor, cerrar, alerta, tendencia, información, llama, persona, personas, maletín, reloj, entre otros |
| `Card` | `title`, `icon`, `action`, `children` | Usa `div`/`article`, **nunca** `section` ni `header` (ver H4). Dos variantes: elevada y plana |
| `Chip` | `tone` (frente o estado), `children` | Color por frente tomado de los tokens; texto con contraste verificado |
| `ProgressBar` | `value` (0 a 1) o `null`, `label` | `null` muestra "sin datos", **no** una barra en 0 %. `role="progressbar"` con valores |
| `Ring` | `value` o `null`, `size`, `children` | `null` muestra anillo discontinuo y "—". Nunca dibuja un porcentaje inventado |
| `Sparkline` | `points`, `meta?` | Menos de 2 puntos muestra el estado "datos insuficientes" |
| `Skeleton` | `variant`, `lines` | `aria-busy`; sin animación con `prefers-reduced-motion` |
| `EmptyState` | `icon`, `title`, `description`, `children` | Describe qué aparecerá y cómo agregar el primer dato |
| `ErrorState` | `title`, `message`, `onRetry` | `role="alert"`. Distinto visual y semánticamente del vacío |
| `EstadoDatos` | `estado` (`cargando`, `vacio`, `error`, `parcial`, `ok`) y los contenidos de cada uno | Fuerza a que cada widget decida los cinco estados de la especificación |
| `ThemeToggle` | ninguna | Tres opciones, foco visible, estado anunciado |

**Contrato de indicador** (`indicadores.js`), base de Life Pulse:
`{ id, nombre, valor (0 a 100 o null), estado ('ok' | 'parcial' | 'sin-datos' | 'error'), muestra, minimo, formula, fuentes }`.
Regla dura: si el estado no es `ok` o `parcial`, `valor` es `null`. **No existe indicador global**: queda pendiente de la metodología que apruebes (D7).

---

## 8. Dependencias

| Concepto | Decisión |
|---|---|
| Paquetes nuevos de producción | **Ninguno** |
| Paquetes nuevos de desarrollo | **Ninguno** (pruebas con `node:test`, ya incluido en Node) |
| Iconos | Conjunto propio de SVG (sin librería) |
| Estilos | CSS Modules, incluido en Next 14. Sin Tailwind |
| Gráficas | SVG propio, sin librería |
| Tipografías | Las actuales, vía `next/font` |
| Requisito de entorno | Node 20 o superior para `npm test` |

---

## 9. Riesgos

| # | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| R1 | Los estilos antiguos con selectores de elemento contaminan los componentes nuevos (H4) | Alto | Capa de menor prioridad para lo antiguo (D-F1) y regla de no usar `section`, `header`, `h2`, `ul`, `li` globales en los componentes nuevos |
| R2 | Envolver `globals.css` en una capa altera sin querer las pantallas antiguas | Alto | Comparación antes y después de las 9 pantallas (estilos calculados y capturas, subfase 1.0 y 1.5). Se revierte con un commit |
| R3 | Parpadeo de tema al cargar o aviso de hidratación | Medio | Script síncrono en `<head>` y `suppressHydrationWarning`; se revisa la consola |
| R4 | Pantallas antiguas y nuevas con tema distinto al usar el interruptor (H5) | Medio | Compatibilidad `[data-theme]` en el CSS antiguo (D-F1). Hasta entonces el interruptor no sale del laboratorio |
| R5 | Colores de estado ilegibles en claro (H3) | Medio | Tonos derivados (D-F4) y prueba automática de contraste |
| R6 | Una nueva `orden` o un nuevo frente cambia el frente por defecto de un formulario (H6) | Medio | Valores iniciales explícitos y una prueba que exige que cada uno sea un frente existente (D-F3) |
| R7 | Datos de demostración se filtran a producción | Alto | Ruta que devuelve 404 en producción, datos en un solo archivo rotulado y una prueba que impide importarlo desde otro lugar |
| R8 | Componentes sin uso real hasta la Fase 2 (código muerto temporal) | Bajo | Se revisan en el laboratorio y se cubren con estados; se pueden ajustar al integrarlos |
| R9 | Accesibilidad: los campos de formulario antiguos aparecen sin nombre accesible en el árbol | Medio | Fuera del alcance de la Fase 1 en los módulos antiguos; los componentes nuevos nacen con etiquetas. Queda anotado para su rediseño |
| R10 | Usar `localStorage` falla (modo privado) | Bajo | `try/catch` y el tema "sistema" por defecto |
| R11 | Aviso de Node por módulos `.js` sin `"type"` al ejecutar pruebas | Bajo | El script `test` usa `--no-warnings`; no se cambia `package.json` a módulo ES para no afectar a Next |

---

## 10. Criterios de aceptación

**Globales (toda la Fase 1)**
- [ ] `npm run build` y `npm test` pasan sin errores ni avisos nuevos.
- [ ] `package.json`: **cero** dependencias nuevas.
- [ ] Supabase sin cambios: esquema, RLS, datos y usuarios; `04_verificar_limpio.sql` devuelve 0 filas, 10 frentes y 1 usuario.
- [ ] Rutas existentes, autenticación y middleware idénticos.
- [ ] Las **9 pantallas antiguas** se ven y funcionan igual que en la línea base, en claro y en oscuro del sistema (comparación de estilos calculados y capturas).
- [ ] Un commit por subfase, sin `.env` ni claves.
- [ ] Consola sin errores en el laboratorio y en las 9 pantallas.

**1.1 Tokens y tema**
- [ ] Los 11 valores oscuros y los 5 claros de la especificación están en `tokens.css` sin alteración.
- [ ] La prueba de contraste pasa: texto de 4,5:1 o más y elementos de interfaz de 3:1 o más, en ambos temas.
- [ ] Claro, oscuro y sistema funcionan; la preferencia persiste tras recargar.
- [ ] No hay parpadeo ni aviso de hidratación.
- [ ] Sin `data-theme`, el comportamiento sigue el sistema.

**1.2 y 1.3 Componentes**
- [ ] Cada componente se ve correcto en claro y oscuro, a 375, 768 y 1280 px, sin desplazamiento horizontal.
- [ ] Foco visible y operables por teclado cuando son interactivos; roles ARIA correctos en barra, anillo, alertas y selector.
- [ ] `Ring` y `ProgressBar` con `null` muestran "sin datos", nunca 0 %.
- [ ] El estado de error es visual y semánticamente distinto del vacío.
- [ ] `prefers-reduced-motion` elimina las animaciones.
- [ ] Ningún componente nuevo usa `section`, `header`, `h2`, `ul` ni `li` heredables, ni colores literales.

**1.4 Dominio y formularios**
- [ ] Pruebas de `fechas` con fechas fijas y zona Colombia, incluidos los cambios de día y de semana.
- [ ] Pruebas del contrato de indicador: sin datos siempre da `null`; el valor nunca es `NaN` ni sale de 0 a 100.
- [ ] Cada formulario define su frente inicial explícitamente; una prueba exige que sea un slug existente y que **no dependa del orden**.
- [ ] Con el comportamiento actual conservado, o con los valores que decidas (D-F3).

**1.5 Laboratorio**
- [ ] `/laboratorio` responde 404 en la compilación de producción y exige sesión.
- [ ] Todo dato de demostración está en `demo.js`, rotulado, y ninguna otra parte lo importa (prueba automática).
- [ ] Los cinco estados de datos se pueden ver en el laboratorio.
- [ ] `docs/FUNDACIONES.md` documenta tokens, componentes y reglas de uso.

---

## 11. Decisiones que necesito de ti

| Id | Decisión | Mi recomendación |
|---|---|---|
| **D-F1** | Aislar los estilos antiguos: envolver `globals.css` en una capa de menor prioridad y agregar compatibilidad con el tema manual. Modifica un archivo antiguo sin cambiar su aspecto | Aprobar. Es lo que garantiza que los componentes nuevos no hereden estilos ajenos |
| **D-F2** | Crear la ruta `/laboratorio`, solo en desarrollo, con sesión obligatoria y datos de demostración rotulados | Aprobar. Es la única forma de revisar los componentes antes de la Fase 2 |
| **D-F3** | Valores iniciales explícitos de frente por formulario (tabla abajo) | Conservar el comportamiento actual para no sorprender; cambiar uno es editar una línea |
| **D-F4** | Tonos derivados para el modo claro (apartado 5.2) | Aprobar |
| **D-F5** | **Diferir la capa de acceso a datos** a las fases 3 y 4, donde cada consulta se escribe junto a su widget. Es un cambio respecto al plan anterior, que la ponía en la Fase 1 | Aprobar: evita código sin usar y sin pruebas |
| **D-F6** | Iconos propios en SVG en lugar de una librería | Aprobar |
| **D-F7** | Puntos de aprobación: tras 1.1, 1.3 y 1.5 | Aprobar |

**D-F3. Valores iniciales de frente (hoy y propuesta)**

| Formulario | Hoy | Cómo se decide hoy | Propuesta explícita |
|---|---|---|---|
| Mi día, nuevo pendiente | `ticketcode-eventos` | **Implícito**: primer frente por `orden` | `ticketcode-eventos` |
| Metas, nueva meta | `ticketcode-eventos` | **Implícito** | `ticketcode-eventos` |
| Cerebro, nueva nota | `ticketcode-eventos` | **Implícito** | `ticketcode-eventos` |
| Cerebro, editar nota sin frente | primer frente por `orden` | **Implícito** | `personal` |
| Gastos, nuevo gasto | `personal` | Explícito | `personal` |
| Finanzas, ingreso | `personal` | Explícito | `personal` |
| Finanzas, pago recurrente | `personal` | Explícito | `personal` |

Dime si prefieres otro valor por formulario (por ejemplo, que Mi día empiece en `personal`, o que el formulario no preseleccione nada y obligue a elegir).

---

## 12. Qué sigue después
Con la Fase 1 aprobada, la Fase 2 construye el shell (barra lateral, barra inferior móvil, búsqueda y notificaciones) sobre estos tokens y componentes, manteniendo las rutas actuales.
