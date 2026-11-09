# Shell de navegación: guía

Resultado de la Fase 2 (commits `0d8ba6a` a `9548b1e`). El shell envuelve las nueve pantallas sin modificarlas ni cambiar sus rutas.

## 1. Qué es
Marco de la aplicación en `web/components/shell/`, montado desde `web/app/(app)/layout.js`. Aloja cada pantalla dentro de `main#contenido > .wrap`, tal cual. `/login` y `/auth` no lo usan.

| Zona | Componente | Comportamiento |
|---|---|---|
| Barra lateral | `Sidebar` | Expandida (≥1280 px, alternable) o riel de iconos (768 a 1279 px). Cuatro grupos más "Desarrollo" (solo en desarrollo) |
| Barra inferior | `BottomNav` + `MoreSheet` | Móvil (<768 px): Mi día, Panel, Metas y "Más" (hoja con el resto, tema y salir) |
| Barra superior | `Topbar` | Migas de pan, búsqueda, frente, notificaciones, cuenta |
| Asistente | `AssistantFloatingButton` + `AssistantDrawer` | Botón flotante siempre disponible; panel lateral (escritorio) u hoja modal (móvil) |

## 2. Navegación (fuente única: `lib/domain/navegacion.js`)
- Grupos visuales: **Inicio** (Mi día, Panel), **Mi vida** (Metas, Finanzas ▸ Gastos, Salud, Jornada), **Conocimiento** (Biblioteca, Cerebro), **Asistente IA** (acción, no ruta).
- Las rutas son las mismas de siempre y siguen planas. La agrupación es solo visual.
- Para agregar o mover un elemento se edita solo ese archivo; una prueba exige que las nueve rutas de negocio estén exactamente una vez y existan como página.
- El laboratorio (`/laboratorio`) aparece solo en desarrollo.

## 3. Frente activo
- Vive en la URL: `?frente=tanku|ticketcode|personal|salud|familia|otros`. Ausente = todos. Un valor desconocido se ignora.
- `lib/domain/frenteActivo.js` lee y escribe el parámetro y construye enlaces que lo conservan.
- **Los módulos todavía no leen el filtro.** `MODULOS_CON_FILTRO` está vacío; mientras una pantalla no esté ahí, el selector avisa que no se aplica y no simula filtrado. Cuando se rediseñe un módulo: leer `frente`, traducirlo con `slugsDeFrente` (`frentesMap.js`) y agregar su id a `MODULOS_CON_FILTRO`.
- Los colores de los frentes siguen siendo una **propuesta**.

## 4. Búsqueda (Ctrl/Cmd + K)
Alcance actual: pantallas y acciones (tema, frente, cerrar sesión, abrir asistente). No consulta datos. La búsqueda dentro de notas, gastos, pendientes, metas y biblioteca queda para la Fase 5.

## 5. Notificaciones
Solo visuales: estado vacío honesto, sin contador. Las alertas por reglas se conectan en la Fase 5.

## 6. Asistente
No está conectado: estado "No conectado", campo de mensaje y botón Enviar deshabilitados, sin respuestas ni acciones simuladas. Muestra el contexto actual (pantalla y frente) y lo pendiente. Los ocho estados (`lib/domain/asistente.js`) se ven en `/laboratorio#lab-asistente`. Para conectarlo: clave solo en el servidor, lectura libre y confirmación antes de escribir.

## 7. Cómo convive con los módulos heredados
- `.wrap` (ancho máximo 1040 px) y el scroll del documento se conservan.
- El relleno heredado del `<body>` se anula solo si el shell está presente (`styles/shell.css`, `body:has([data-shell])`); `/login` conserva el suyo.
- Los estilos de elemento heredados (`header`, `h2`, `ul`, `li`…) están en una capa de menor prioridad; los componentes del shell fijan explícitamente lo que usan.
- El corte de dos columnas heredado depende del ancho de ventana (860 px); por eso la barra lateral es un riel de 72 px en tablet.
- El menú anterior (`components/Nav.js`) queda sin uso como respaldo.

## 8. Reglas para modificar el shell
1. Solo tokens `--ds-*` y CSS Modules (lo verifica `npm test`).
2. Nada de consultas ni escrituras de datos; el único uso de Supabase es `useSalir` (cierre de sesión).
3. Un botón solo aparece si hace algo real (`acciones.js`).
4. Diálogos con `useDialogo` (foco atrapado, Escape, retorno del foco).
5. Tras cualquier cambio: `npm test`, compilar y repetir la regresión de contenido (`tests/visual/README.md`, 72 comparaciones, 0 diferencias).

## 9. Pendiente (fuera de la Fase 2)
Rediseño de Home y módulos, filtros reales por frente, búsqueda de contenido, notificaciones reales, nombre y foto del usuario, conexión de la IA, retiro de `Nav.js`, colores definitivos de los frentes.
