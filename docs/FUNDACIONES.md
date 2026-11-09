# Fundaciones de diseño: guía de uso

Lo que construyó la Fase 1 (commits `de5e395` a la 1.5) y cómo usarlo. Es la base del shell (Fase 2) y de Home (Fases 3 a 5).

## 1. Principios
1. **Datos honestos.** Un valor ausente, inválido o insuficiente se muestra como "Sin datos", nunca como 0 %. Un error nunca se muestra como vacío. Nada se interpola ni se inventa.
2. **Solo tokens.** Los componentes nuevos usan variables `--ds-*` de `web/styles/tokens.css`. Ningún color escrito a mano. Lo verifica `npm test`.
3. **CSS Modules.** Cada componente trae su hoja `*.module.css`. Los estilos de las pantallas antiguas viven aparte, en una capa de menor prioridad.
4. **Sin dependencias nuevas.** Iconos y gráficas propios en SVG; pruebas con `node:test`.
5. **Accesible por defecto.** Roles ARIA, nombres, foco visible, movimiento reducido.
6. **El frente de diseño es una agrupación visual**, no un dato. Los identificadores originales (`slug`) de la base no se tocan.

## 2. Tokens (`web/styles/tokens.css`)
| Grupo | Tokens |
|---|---|
| Superficies | `--ds-bg`, `--ds-bg-2`, `--ds-surface`, `--ds-surface-raised` |
| Texto | `--ds-text`, `--ds-text-2` |
| Acento y estados | `--ds-primary`, `--ds-on-primary`, `--ds-primary-soft`, `--ds-secondary`, `--ds-success`, `--ds-warning`, `--ds-danger` y sus `-soft` |
| Bordes y foco | `--ds-border`, `--ds-border-strong`, `--ds-focus` |
| Frentes (propuesta) | `--ds-frente-{tanku,ticketcode,personal,salud,familia,otros}` y `-soft` |
| Encabezado | `--ds-grad-1`, `-2`, `-3`, `--ds-grad-header`, `--ds-glow` |
| Forma y elevación | `--ds-radius-{sm,md,lg,pill}`, `--ds-shadow-{1,2}` |
| Espaciado | `--ds-space-{1,2,3,4,5,6,8,10}` (escala de 4 px) |
| Tipografía | `--ds-font-display`, `--ds-font-body`, `--ds-text-{xs…3xl}`, `--ds-leading-*` |
| Movimiento | `--ds-dur-fast`, `--ds-dur`, `--ds-ease` (en 0 con movimiento reducido) |

- **Valores de la especificación:** se usan tal cual (11 oscuros, 5 claros). Los tonos de estado en claro son derivados aprobados (D-F4).
- **Contraste:** `tests/contraste.test.mjs` lee el CSS real y exige texto ≥ 4,5:1 y controles ≥ 3:1 en ambos temas.
- **Los colores de los seis frentes son una propuesta, no definitiva.** Se ajustan en `tokens.css`.

## 3. Tema claro, oscuro y sistema
- Preferencia en `localStorage` (`sb-theme`: `light`, `dark` o ausente = sistema).
- Un script síncrono en `<head>` aplica `data-theme` antes del primer pintado (sin parpadeo).
- `components/ui/ThemeToggle` es el selector (radiogroup con teclado). Desde la Fase 2 está en el shell (barra lateral, menú de cuenta y hoja "Más"); ver docs/SHELL.md.
- Las pantallas antiguas siguen el mismo atributo mediante una regla de compatibilidad en `globals.css`.

## 4. Componentes (`web/components/ui`)
| Componente | Para qué | Regla clave |
|---|---|---|
| `Icon` | 34 iconos propios | Decorativo salvo que lleve `title` |
| `Card` | Superficie de widget | Título con nivel de encabezado propio; nombra la región con `as` + `id` |
| `Chip` | Estado o frente | `frente="salud-abuela"` se traduce a Familia; desconocido = neutro |
| `ProgressBar` | Progreso lineal | `valor` ausente/inválido = "Sin datos" (pista rayada), no 0 % |
| `Ring` | Progreso circular (Life Pulse) | `valor` ausente/inválido = anillo discontinuo y "—" |
| `Sparkline` | Tendencia | Menos de 2 valores válidos = "Datos insuficientes" |
| `Skeleton` | Carga | Se anuncia una vez ("Cargando"); sin brillo con movimiento reducido |
| `EmptyState` | Aún no hay nada | No es un error |
| `ErrorState` | Algo falló | `role="alert"`, reintento con teclado |
| `EstadoDatos` | Decide los 5 estados | Estado desconocido = error, nunca vacío |
| `ThemeToggle` | Tema | Ver sección 3 |

Todos reciben `etiqueta` donde el lector de pantalla la necesita (barras, anillos, minigráficas).

## 5. Lógica de dominio (`web/lib`)
| Módulo | Qué hace |
|---|---|
| `domain/frentesMap.js` | Agrupación visual de frentes (única fuente de verdad); "Sin asignar" para slugs no contemplados |
| `domain/formularios.js` | Frente inicial **explícito** de cada formulario (no depende del orden de la base) |
| `domain/fechas.js` | Fechas con zona de Colombia, semana desde el lunes; recibe `ahora` para poder probarse |
| `domain/indicadores.js` | Contrato de indicador: sin muestra suficiente el valor es `null`. **No hay indicador global** (pendiente de metodología aprobada) |
| `ui/progreso.js`, `ui/anillo.js`, `ui/sparkline.js` | Cálculo de barras, anillos y minigráficas |
| `ui/estados.js` | `estadoDeConsulta`: cargando, error, vacío, parcial u ok. Un error nunca se convierte en vacío |
| `ui/tonos.js` | Tonos de estado y de frente |
| `consulta.js` | `verificar`: una consulta que falla lanza error en vez de verse como vacío |
| `theme.js` | Tema |

### Cómo usar `EstadoDatos` con una consulta
```js
import { estadoDeConsulta } from '@/lib/ui/estados';
const estado = estadoDeConsulta({ cargando, error, datos });          // 'cargando' | 'error' | 'vacio' | 'parcial' | 'ok'
<EstadoDatos estado={estado} onReintentar={reintentar}> …contenido… </EstadoDatos>
```

## 6. Laboratorio (`/laboratorio`)
Galería de todo lo anterior en claro y oscuro, con una demo interactiva de los cinco estados.
- Solo desarrollo: en producción responde **404**. Exige sesión.
- **No usa Supabase** y no hace consultas ni escrituras. El reintento de la demo es un temporizador.
- Los datos de demostración están en `app/(app)/laboratorio/demo.js`, rotulados "DATOS DE DEMOSTRACIÓN", y ninguna otra parte del código puede importarlos (lo comprueba una prueba).

## 7. Pruebas
- `npm test` ejecuta todas las pruebas de lógica, tokens, contraste, componentes y aislamiento (ver `web/tests/README.md`).
- `web/tests/visual/` explica cómo comparar los estilos calculados de las 9 pantallas antes y después de un cambio.
- `web/tests/db/` contiene las pruebas manuales de base de datos (solo con autorización del dueño).

## 8. Cómo agregar un componente nuevo
1. Escribe la lógica pura en `lib/ui/` o `lib/domain/` y su prueba en `tests/*.test.mjs`.
2. Crea `components/ui/Nombre.js` y `Nombre.module.css`, solo con tokens `--ds-*`.
3. Decide sus estados (vacío, error, sin datos) y su nombre accesible.
4. Agrégalo a `/laboratorio` con datos de demostración rotulados.
5. Ejecuta `npm test`, compila y compara las 9 pantallas antiguas.

## 9. Pendiente de decisión del usuario
- Aprobar los colores definitivos de los seis frentes (hoy: propuesta).
- La metodología del indicador global de equilibrio personal.
- Las fórmulas de cada área de Life Pulse (Fase 3).
