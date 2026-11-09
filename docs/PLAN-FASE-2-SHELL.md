# Plan detallado: Fase 2, Shell de navegación

**Estado: PLAN PARA REVISIÓN. No se ejecutó ningún cambio de la Fase 2.**
Fecha: 9 nov 2026. Base: Fase 1 aprobada (commits `de5e395` a `32a4857`), `docs/design/*`, `docs/FUNDACIONES.md`, `docs/AUDITORIA-Y-PLAN-HOME.md`.

Reglas que rigen todo el plan: la agrupación es **visual**; las rutas actuales no cambian; los módulos no se reorganizan ni se tocan; sin cambios en Supabase, esquema, RLS, autenticación ni middleware; sin dependencias nuevas; sin datos ficticios fuera del laboratorio; sin registros de prueba en Supabase sin autorización; un commit por subfase, sin secretos, con informe al terminar cada una.

---

## 0. Resumen

**Objetivo.** Reemplazar el menú plano de 9 pestañas por un shell de aplicación (barra lateral, barra inferior móvil y barra superior contextual) que agrupa los módulos existentes en cuatro grupos, ofrece búsqueda de navegación, un selector de frentes, el selector de tema y el acceso al asistente flotante, **sin tocar ningún módulo**.

**Resultado visible.** La app se ve y se navega como un sistema operativo personal: estructura clara, mismo contenido de cada pantalla en el centro. Los módulos heredados conservan su aspecto interno hasta su rediseño.

**No entra en la Fase 2:** rediseño de Home, conexión de la IA, búsqueda de contenido, notificaciones reales, nombre o avatar del usuario, reubicación de rutas, rediseño de módulos, Personas y Calendario.

---

## 1. Hallazgos del código actual que condicionan el diseño

| # | Hallazgo | Evidencia | Consecuencia para el shell |
|---|---|---|---|
| H1 | El layout de las pantallas es `<div class="wrap"><Nav/>{children}</div>` | `app/(app)/layout.js` | Es el único punto de integración: el shell reemplaza ese layout y aloja `children` sin cambios |
| H2 | `.wrap` (ancho máximo 1040 px, columna con separación de 20 px) define el espaciado vertical de **todas** las pantallas | `globals.css`, línea 18 | El shell debe seguir envolviendo el contenido en `.wrap` para no alterar el espaciado |
| H3 | El `body` heredado trae relleno (24 px arriba, 16 px a los lados) y el fondo heredado | `globals.css`, línea 16 | El shell necesita ocupar todo el ancho: hay que neutralizar ese relleno **solo dentro del grupo `(app)`**, sin afectar a `/login` |
| H4 | El corte de dos columnas es por **ancho de ventana**, no del contenedor (`@media (min-width: 860px)`) | `globals.css`, línea 27 | Con una barra lateral ancha, el contenido quedaría estrecho con dos columnas apretadas. Condiciona la regla de tablet (sección 4) |
| H5 | Estilos de elemento heredados (`header`, `h1`, `h2`, `section`, `ul`, `li`) siguen filtrándose a cualquier componente nuevo que use esas etiquetas | `globals.css`, líneas 19 a 32 | Los componentes del shell deben neutralizar explícitamente lo que no quieran heredar (en especial `ul`, `li` y `header`) |
| H6 | Cada una de las 9 pantallas trae su propio `<header>` con su `<h1>` | 9 coincidencias | La barra superior **no** puede ser otro `h1`: usa migas de pan y no un encabezado principal |
| H7 | `Cerebro` usa `window.scrollTo`; ningún módulo usa `position: fixed` ni scroll interno | `Cerebro.js` línea 51 | El scroll debe seguir siendo el **del documento**, no el de un contenedor interno |
| H8 | Cerrar sesión hace `signOut()`, `router.push('/login')` y `router.refresh()` desde el navegador | `Nav.js`, líneas 20 a 24 | El shell debe reproducir exactamente ese flujo, sin tocar la autenticación |
| H9 | El título de la pestaña es siempre "Cerebro de Lu" | `app/layout.js` | El shell lo actualiza desde el cliente, sin editar las páginas |
| H10 | No existe `loading.js`; `error.js` existe pero usa estilos heredados | `app/(app)/error.js` | Hay espacio para estados de carga y error coherentes a nivel de grupo |
| H11 | El middleware protege todo salvo `/login` y `/auth` | `middleware.js` | El shell vive dentro de `(app)`, así que `/login` no cambia |
| H12 | Existen 10 rutas bajo `(app)`: las 9 de negocio más `/laboratorio` (solo desarrollo) | Árbol de `app/` | La navegación se define sobre las 9 y trata el laboratorio aparte |

---

## 2. Arquitectura de navegación

### 2.1 Mapa: grupos, módulos y rutas (las rutas no cambian)

| Grupo | Elemento | Ruta | Icono | Notas |
|---|---|---|---|---|
| **Inicio** | Mi día | `/` | `home` | Sigue siendo la pantalla heredada hasta la Fase 3 |
| | Panel | `/panel` | `chart` | |
| **Mi vida** | Metas | `/metas` | `target` | |
| | Finanzas | `/finanzas` | `wallet` | Pantalla única que ya incluye ingresos, presupuesto, recurrentes y deudas |
| | ↳ Gastos | `/gastos` | `trendDown` | Hoy es una ruta aparte; se muestra como hijo de Finanzas |
| | Salud | `/salud` | `heart` | |
| | Jornada | `/jornada` | `book` | |
| **Conocimiento** | Biblioteca | `/biblioteca` | `library` | |
| | Cerebro | `/cerebro` | `layers` | |
| **Asistente IA** | Asistente | (acción, sin ruta) | `sparkles` | Abre el panel del asistente; ver 5.5 |
| **Desarrollo** (solo en desarrollo) | Laboratorio | `/laboratorio` | `sliders` | No existe en producción |

Lo que **no** se muestra: Personas, Calendario, Conexiones, Memoria, Insights y Automatizaciones, porque no existen. No se agregan enlaces muertos ni pantallas "próximamente" falsas; lo pendiente se explica dentro del panel del asistente.

**Límite de Finanzas.** El documento de arquitectura imagina seis subsecciones (Resumen, Gastos, Ingresos, Presupuestos, Recurrentes, Deudas). Hoy son bloques dentro de `/finanzas`, sin anclas, y no se pueden tocar los módulos. Por eso el shell muestra solo **Resumen** (`/finanzas`) y **Gastos** (`/gastos`). Las otras subsecciones llegan cuando se rediseñe Finanzas.

### 2.2 Sidebar de escritorio

```
┌────────────────────────┐
│ ◆ Mi Cerebro           │  marca (icono + nombre)
│                        │
│ INICIO                 │  rótulos de grupo (pequeños, en mayúsculas)
│  ⌂ Mi día     ◀ activo │
│  ▥ Panel               │
│ MI VIDA                │
│  ◎ Metas               │
│  ▤ Finanzas            │
│     ↘ Gastos           │
│  ♡ Salud               │
│  ▭ Jornada             │
│ CONOCIMIENTO           │
│  ▯ Biblioteca          │
│  ◫ Cerebro             │
│ ASISTENTE IA           │
│  ✦ Asistente           │  abre el panel; no es una ruta
│                        │
│ FRENTES                │  filtro transversal (ver 2.6)
│  ● Todos               │
│  ● TANKU  ● TICKETCODE │
│  ● Personal ● Salud …  │
│                        │
│ ──────────────────     │
│  ◐ Tema   ⚙ Cuenta     │  tema y menú de cuenta (Salir)
└────────────────────────┘
```
- **Expandida** (248 px) en escritorio amplio; **riel** de solo iconos (72 px) en pantallas medianas (sección 4). El usuario puede alternar entre ambas en escritorio; la preferencia se guarda en el navegador.
- Fija en pantalla (`sticky`, alto completo), con desplazamiento propio si no cabe.
- El elemento activo usa `aria-current="page"`, fondo `--ds-primary-soft` y texto primario. Foco visible en todos.
- Es una lista de enlaces normales (`<a>` de Next): funcionan con clic medio, copiar enlace y teclado.

### 2.3 Navegación inferior móvil y hoja "Más"

```
┌──────────────────────────────────────────┐
│  ⌂         ▥          ◎          ⋯      │
│ Mi día    Panel      Metas      Más     │   4 accesos (según la especificación de Home)
└──────────────────────────────────────────┘
```
- **Mi día, Panel, Metas** son enlaces. **Más** abre una hoja inferior con todo lo demás, agrupado igual que la barra lateral: Finanzas, Gastos, Salud, Jornada, Biblioteca, Cerebro, además del selector de frentes, el tema, el acceso al asistente y Salir (y Laboratorio solo en desarrollo).
- Si la ruta actual está dentro de "Más" (por ejemplo `/salud`), el botón **Más** aparece activo y la hoja resalta el elemento actual.
- La hoja es un diálogo modal: atrapa el foco, se cierra con Escape, con el botón de cerrar y al tocar el fondo, y devuelve el foco al botón que la abrió.

### 2.4 Barra superior contextual (Topbar)

| Zona | Contenido | Comportamiento |
|---|---|---|
| Izquierda | **Migas de pan**: grupo › módulo (por ejemplo "Mi vida › Finanzas") | No es un `h1`: cada pantalla conserva su propio encabezado. En móvil solo muestra el módulo |
| Centro | Disparador de **búsqueda** ("Buscar o ir a…", con la pista `Ctrl K`) | En móvil se reduce a un icono |
| Derecha | **Chip del frente activo** (si hay uno), **notificaciones**, **menú de cuenta** | El chip del frente solo aparece cuando hay un filtro; con un botón para quitarlo |

- Pegajosa arriba (`sticky`), respetando el área segura del dispositivo.
- Contextual: cambia el texto de las migas según la ruta, y el aviso del frente según si la pantalla lo usa.

### 2.5 Mapeo de rutas a elementos (fuente única)
Un solo módulo, `lib/domain/navegacion.js`, define grupos, elementos, rutas, iconos, palabras clave de búsqueda y cuáles van en la barra móvil. La barra lateral, la barra inferior, las migas, la búsqueda y el título del documento leen de ahí. Una prueba exige que las 9 rutas de negocio estén exactamente una vez y que coincidan con las existentes.

### 2.6 Los seis frentes como filtro transversal

- **No son pestañas.** Aparecen como un selector de selección única: *Todos, TANKU, TICKETCODE, Personal, Salud, Familia, Otros proyectos* (con el color propuesto de cada uno como punto).
- **Dónde:** sección "Frentes" de la barra lateral (escritorio), chip + hoja en móvil y tablet, y comandos en la paleta de búsqueda.
- **Estado:** vive en la URL como parámetro `?frente=<id>` (`tanku`, `ticketcode`, `personal`, `salud`, `familia`, `otros`; ausente = todos). La URL sigue siendo la misma ruta; el parámetro es opcional y compartible. Los enlaces del shell lo conservan al navegar.
- **Traducción:** cada frente de diseño equivale a una lista de `slug` originales mediante `frentesMap.js`. Nada se escribe en la base.
- **Honestidad sobre el alcance:** los módulos heredados **todavía no leen** el parámetro (hacerlo sería modificarlos). Para no sugerir un filtro que no existe, el shell lleva un registro `MODULOS_CON_FILTRO`, vacío al inicio. Mientras una pantalla no esté en ese registro, el chip del frente muestra la nota "Aún no se aplica en esta pantalla". Cada módulo se agrega al registro cuando se rediseñe. `Cerebro` conserva su propio filtro interno sin cambios.

### 2.7 Lenguaje visual
Minimalista y futurista: **Linear** (jerarquía limpia, rótulos pequeños, bordes finos, listas densas), **Raycast** (paleta de comandos grande y centrada con atajos visibles) y **visionOS** (capas y profundidad moderada). Claro y oscuro.
- Superficies sólidas con `--ds-surface` y bordes `--ds-border`; sombras solo en lo que flota (paleta, panel del asistente, hojas) con `--ds-shadow-2`.
- Un resplandor violeta muy sutil (`--ds-glow`) en la parte superior de la barra lateral. **Sin** transparencias que reduzcan la legibilidad y sin degradados en cada componente.
- Radios y espaciado de los tokens de la Fase 1; animaciones breves que se apagan con movimiento reducido.

---

## 3. Componentes

### 3.1 Archivos a crear

| Archivo | Responsabilidad | Reutiliza (Fase 1) |
|---|---|---|
| `web/lib/domain/navegacion.js` | Fuente única: grupos, elementos, rutas, iconos, palabras clave; `itemDeRuta`, `esActivo`, `migas`, `ITEMS_BARRA_MOVIL`. Pura | `ICONOS` |
| `web/lib/domain/busqueda.js` | Normaliza (sin acentos ni mayúsculas) y puntúa elementos y acciones. Pura | |
| `web/lib/domain/frenteActivo.js` | Lee y escribe el parámetro `frente`, valida el id, construye enlaces que lo conservan, registro `MODULOS_CON_FILTRO`. Pura | `frentesMap.js` |
| `web/lib/domain/asistente.js` | Los siete estados del asistente, sus textos y si permite enviar. Pura | |
| `web/components/shell/AppShell.js` | Marco: cuadrícula, regiones, enlace de salto, aloja los módulos heredados | |
| `web/components/shell/ShellProvider.js` | Estado compartido mínimo: barra lateral expandida o riel, hoja "Más", paleta, notificaciones y panel del asistente | |
| `web/components/shell/Sidebar.js` | Barra lateral expandida o riel, grupos, elementos, selector de frentes, tema y cuenta | `Icon`, `Chip`, `ThemeToggle` |
| `web/components/shell/SidebarLink.js` | Un enlace con icono, etiqueta, estado activo y etiqueta accesible en modo riel | `Icon` |
| `web/components/shell/BottomNav.js` | Barra inferior de 4 accesos | `Icon` |
| `web/components/shell/MoreSheet.js` | Hoja "Más" (diálogo modal con trampa de foco) | `Icon`, `ThemeToggle` |
| `web/components/shell/Topbar.js` | Migas, disparador de búsqueda, chip de frente, notificaciones y cuenta | `Icon`, `Chip` |
| `web/components/shell/Breadcrumb.js` | Migas de pan accesibles | |
| `web/components/shell/FrenteSelector.js` | Selector de selección única (lista y compacto) | `Chip`, `Icon` |
| `web/components/shell/SearchPalette.js` | Paleta de comandos (diálogo con patrón combobox) | `Icon`, `EmptyState` |
| `web/components/shell/NotificationsMenu.js` | Campana y panel de notificaciones (visual) | `Icon`, `EmptyState` |
| `web/components/shell/UserMenu.js` | Menú de cuenta: tema y Salir (mismo flujo que hoy) | `ThemeToggle`, `ErrorState` |
| `web/components/shell/AssistantFloatingButton.js` | Botón flotante persistente | `Icon` |
| `web/components/shell/AssistantDrawer.js` | Panel del asistente (lateral en escritorio, hoja en móvil), sin IA conectada | `Chip`, `EmptyState`, `Icon` |
| `web/components/shell/SkipLink.js` | "Saltar al contenido" | |
| `web/components/shell/RouteEffects.js` | Actualiza el título del documento y anuncia el cambio de pantalla (región `status`) | |
| `web/components/shell/*.module.css` | Un CSS Module por componente, solo con tokens `--ds-*` | |
| `web/styles/shell.css` | CSS global mínimo: neutraliza el relleno y el fondo heredados del `body` **solo dentro del shell** (`body:has([data-shell])`) | |
| `web/app/(app)/loading.js` | Estado de carga de las pantallas | `Skeleton` |
| `web/tests/navegacion.test.mjs`, `busqueda.test.mjs`, `frenteActivo.test.mjs`, `asistente.test.mjs`, `shell-aislamiento.test.mjs` | Pruebas de lógica y de aislamiento | |
| `docs/SHELL.md` | Guía del shell | |

### 3.2 Archivos a modificar

| Archivo | Cambio | Riesgo |
|---|---|---|
| `web/app/(app)/layout.js` | Reemplaza `Nav` por `AppShell` y conserva `<div class="wrap">{children}</div>` | Medio: es el punto de integración |
| `web/styles/tokens.css` | **Solo agrega** tokens de dimensiones del shell (`--ds-shell-sidebar`, `--ds-shell-rail`, `--ds-shell-topbar`, `--ds-shell-bottomnav`) y escala de capas (`--ds-z-*`). No cambia ningún valor existente | Bajo |
| `web/app/(app)/error.js` | Pasa a usar `ErrorState` (conserva `reset`). Opcional, ver D2-9 | Bajo |
| `web/tests/solo-tokens.test.mjs`, `contraste.test.mjs` | Agregan `components/shell` y `styles/shell.css` a lo que se revisa y comprueban los tokens nuevos | Bajo |
| `web/app/(app)/laboratorio/*` | Demostración aislada de los siete estados del asistente y de los estados vacíos del shell (datos rotulados) | Bajo |
| `web/tests/visual/*` | Modo de captura con alcance al contenido (ver 7.3) | Bajo |
| `web/tests/README.md` | Documenta las pruebas nuevas | Bajo |

### 3.3 No se toca
Las nueve páginas de negocio y sus componentes (`Pendientes`, `Metas`, `Cerebro`, `Gastos`, `Finanzas`, `Jornada`, `Salud`, `Biblioteca`, `SelectorFrente`), `middleware.js`, `lib/supabase/*`, `app/login`, `app/auth`, `app/globals.css`, `app/layout.js`, `lib/format.js`, `lib/consulta.js`, Supabase (esquema, RLS, datos).

`web/components/Nav.js` **no se elimina** en esta fase: queda sin uso como respaldo. Se retira solo con tu aprobación explícita en el cierre (ver D2-8).

### 3.4 Cómo se aloja un módulo heredado dentro del shell
```
<div data-shell>                         marco del shell (sidebar, topbar, bottom nav)
  <SkipLink/>
  <Sidebar/>
  <div class="columna">
    <Topbar/>
    <main id="contenido" tabindex="-1">  región principal
      <div class="wrap">                 ← contrato heredado: ancho 1040 y separación de 20 px
        {children}                       ← la pantalla tal cual, con su <header> y su <h1>
      </div>
    </main>
  </div>
  <BottomNav/>  <AssistantFloatingButton/>  <AssistantDrawer/>  <SearchPalette/> …
</div>
```
- El fondo de la página sigue siendo el heredado, y el shell pinta **sus propias** superficies con tokens `--ds-*`. Así no se reasigna ningún color de los módulos (ver D2-1).
- El scroll es el del documento (H7).

---

## 4. Responsive

### 4.1 Puntos de corte

| Ancho de ventana | Modo | Navegación | Notas |
|---|---|---|---|
| **≥ 1280 px** (escritorio) | Escritorio amplio | Barra lateral **expandida** (248 px) | Contenido hasta 1040 px, centrado |
| **1024 a 1279 px** | Escritorio compacto | **Riel** de iconos (72 px) | Con información en `aria-label` y descripciones emergentes al enfocar |
| **768 a 1023 px** (tablet) | Tablet | **Riel** de iconos (72 px) | La barra superior pasa a una sola línea; el selector de frentes va en un chip y una hoja |
| **< 768 px** (móvil) | Móvil | **Barra inferior** de 4 accesos + hoja "Más" | Experiencia propia, no una versión reducida del escritorio |

### 4.2 Escritorio
Barra lateral expandida o riel (alternable), barra superior con migas, búsqueda y acciones, contenido centrado. Panel del asistente como columna lateral derecha **que no oculta el contenido**: al abrirse, el contenido se queda a su lado (en escritorio amplio) o se superpone con sombra (en compacto).

### 4.3 Tablet
- Riel fijo de 72 px: las diez entradas caben en vertical (unos 440 px más separadores) y, si la altura es menor, la barra desplaza por dentro.
- **Interacción con el corte heredado de 860 px (H4).** Con el riel, el contenido mide `ancho − 72 px − márgenes`. A 860 px mide unos 756 px: las dos columnas heredadas quedan en unos 370 px cada una, un poco más estrechas que hoy (unos 400 px) pero legibles. Es un criterio de aceptación explícito (7.2). A menos de 860 px sigue una sola columna.
- Objetivos táctiles de 44 px; sin interacciones solo por pasar el ratón.

### 4.4 Móvil (experiencia específica)
- **Barra inferior** de 64 px más el área segura (`env(safe-area-inset-bottom)`). Para que nada quede tapado, el contenido recibe un relleno inferior equivalente: los formularios de las pantallas heredadas (que están al final) siguen siendo alcanzables.
- **Barra superior compacta:** título del módulo, búsqueda (icono), notificaciones y chip de frente. Pegajosa, respetando el área segura superior.
- **Hoja "Más"** desde abajo, con asa visual, hasta el 85 % de la altura, con desplazamiento interno.
- **Paleta de búsqueda** a pantalla completa.
- **Botón del asistente** flotante sobre la barra inferior, sin tapar los controles principales.
- Orientación horizontal del teléfono: la barra inferior se compacta a 56 px.
- Reflujo correcto hasta 320 px de ancho y con zoom de texto al 200 %, sin desplazamiento horizontal de la página.

### 4.5 Comportamiento del menú en pantallas pequeñas
| Acción | Resultado |
|---|---|
| Tocar un acceso de la barra inferior | Navega; el acceso queda activo |
| Tocar **Más** | Abre la hoja; el foco pasa al primer elemento |
| Elegir un elemento de la hoja | Navega y cierra la hoja |
| Escape, botón cerrar o tocar el fondo | Cierra la hoja y devuelve el foco a **Más** |
| Cambiar de pantalla con la hoja abierta | Se cierra sola |
| Abrir la búsqueda o el asistente | Cierra la hoja y abre el diálogo correspondiente |

---

## 5. Funcionalidades

### 5.1 Búsqueda global
**Alcance de la Fase 2: búsqueda de navegación y acciones, 100 % en el navegador, sin consultar datos.**
- Se abre con `Ctrl/Cmd + K` o con el disparador de la barra superior.
- Resultados: **Ir a** (los 9 módulos más el laboratorio en desarrollo) y **Acciones** (cambiar tema, abrir el asistente, cerrar sesión, filtrar por cada frente o quitar el filtro).
- Búsqueda tolerante: sin acentos, sin mayúsculas y por palabras clave ("gastos" encuentra Gastos; "plata" puede encontrar Finanzas).
- Teclado: flechas, Enter, Escape; el foco vuelve a donde estaba.
- Sin resultados: estado vacío con el texto exacto de lo que se buscó.
- La paleta dice con honestidad qué no hace todavía: **"La búsqueda dentro de notas, gastos y pendientes llegará más adelante."**

**Queda pendiente (Fase 5):** búsqueda de contenido en notas, biblioteca, pendientes, metas y gastos. Requiere consultas a la base y datos reales para probarse, y se hace con tu autorización.

### 5.2 Notificaciones
**Solo visuales en esta fase.** Campana en la barra superior con un panel que muestra un estado vacío honesto ("Aún no hay notificaciones. Aquí verás alertas por reglas, como vencimientos o presupuesto, cuando se activen"). **Sin contador ni insignia**, porque no hay origen de datos. El diseño del panel, su accesibilidad y su comportamiento (abrir, cerrar, teclado, hoja en móvil) quedan listos; las alertas reales por reglas se conectan en la Fase 5.

### 5.3 Selector de frentes
Descrito en 2.6: funcional como estado en la URL y con interfaz completa; **sin efecto sobre los módulos heredados todavía**, y así se le dice al usuario con la nota del chip.

### 5.4 Selector de tema
Reutiliza `ThemeToggle` de la Fase 1 en tres lugares: pie de la barra lateral, menú de cuenta y hoja "Más" (móvil), más una acción en la paleta. El estado se mantiene sincronizado (ya escucha cambios de otras pestañas).

### 5.5 Asistente flotante (sin IA conectada)
- **Botón flotante** persistente (abajo a la derecha; sobre la barra inferior en móvil).
- **Panel**: lateral en escritorio (complementario, no modal, la pantalla sigue operable) y hoja modal en móvil.
- **Contenido real en esta fase:** estado **"No conectado"**, explicación de que la conexión con la IA llegará en otra fase, y qué hará cuando se conecte (chat contextual, memoria, insights, automatizaciones) en una lista claramente marcada como pendiente. El campo de mensaje está **deshabilitado**. **No hay respuestas ni acciones simuladas.**
- **Estados:** disponible, pensando, consultando información, esperando aprobación, ejecutando acción, completado y error, definidos como lógica pura (`asistente.js`). En el shell solo es alcanzable "No conectado"; los siete se demuestran en el laboratorio con datos rotulados.
- **Reglas para la futura conexión:** clave solo en el servidor, lectura libre y confirmación antes de escribir (no se implementa ahora).

### 5.6 Cuenta y cierre de sesión
Menú con tema y **Salir**, con el mismo flujo que hoy (`signOut`, ir a `/login`, refrescar). Si falla, se muestra un error compacto con reintento. **Sin nombre ni foto del usuario** en esta fase: obtenerlos exigiría consultar el usuario desde el servidor, y se difiere a Home (Fase 3) para no acercarse a la autenticación.

### 5.7 Detalles de comportamiento
- **Título del documento:** "Metas · Cerebro de Lu" según la ruta, desde el cliente (H9).
- **Anuncio de cambio de pantalla:** región `status` oculta que anuncia el nombre de la nueva pantalla; no se roba el foco.
- **Enlace "Saltar al contenido":** primer elemento enfocable; lleva a `main#contenido`.
- **Carga:** `app/(app)/loading.js` muestra un esqueleto anunciado mientras una pantalla carga sus datos.
- **Error:** `error.js` pasa a `ErrorState` con reintento (D2-9).

---

## 6. Compatibilidad

| Condición | Cómo se garantiza | Cómo se verifica |
|---|---|---|
| Conservar las nueve rutas | `navegacion.js` deriva de la lista actual; no se crean ni mueven archivos de página | Prueba: las 9 rutas existen y coinciden; las 9 responden igual que antes |
| No modificar autenticación ni middleware | Sin cambios en `middleware.js`, `lib/supabase/*`, `app/login`, `app/auth`. El shell solo reutiliza la llamada `signOut` que ya existía | `git diff` vacío en esos archivos; prueba de aislamiento |
| No alterar funcionalidades de negocio | Los componentes de negocio no se editan | `git status` sin esos archivos; regresión de contenido |
| No modificar Supabase, esquema ni RLS | El shell no hace consultas; no se ejecuta SQL | Prueba: ningún archivo del shell contiene `.from(`, `.rpc(` ni `fetch(`; consulta de línea base en solo lectura |
| No romper módulos heredados | `.wrap` se conserva; scroll del documento; relleno inferior en móvil; neutralización de estilos heredados | Regresión de contenido en 72 combinaciones (7.3) y revisión funcional manual |
| Agrupación solo visual | Las rutas siguen planas | Prueba: ninguna ruta contiene prefijos de grupo |
| `/login` intacto | El shell solo vive en `(app)`; `shell.css` usa `body:has([data-shell])` | Comparación de estilos de `/login` antes y después |

---

## 7. Validación

### 7.1 Criterios de aceptación por componente

| Componente | Criterios |
|---|---|
| **AppShell** | Un `main` y un solo `h1` por pantalla (el del módulo); landmarks nombrados; el contenido heredado se ve igual; sin desplazamiento horizontal desde 320 px |
| **SkipLink** | Primer elemento enfocable; visible al recibir el foco; lleva a `#contenido` |
| **Sidebar** | Una lista de enlaces; `aria-current="page"` en el activo; en modo riel cada enlace conserva su nombre accesible; foco visible; recuerda expandida o riel; objetivos de al menos 40 px |
| **BottomNav** | 4 accesos de al menos 44 px; respeta el área segura; **Más** activo cuando la ruta está en la hoja |
| **MoreSheet** | Diálogo modal con trampa de foco, Escape, devuelve el foco, se cierra al navegar, desplaza por dentro |
| **Topbar** | Sin `h1`; migas correctas en las 10 rutas; pegajosa sin tapar contenido al hacer `scrollIntoView` |
| **FrenteSelector** | Selección única; `aria-checked`; teclado con flechas; el id se refleja en la URL y se conserva al navegar; la nota "aún no se aplica" aparece según el registro |
| **SearchPalette** | `Ctrl/Cmd+K`; patrón combobox con `aria-activedescendant`; flechas, Enter, Escape; atrapa el foco; estado vacío; sin consultas de datos |
| **NotificationsMenu** | Estado vacío honesto; sin contador; se abre y cierra con teclado; hoja en móvil |
| **UserMenu** | Tema y Salir; mismo flujo de cierre de sesión; error compacto con reintento si falla |
| **AssistantFloatingButton / Drawer** | Siempre accesible; panel no modal en escritorio y modal en móvil; estado "No conectado" claro; **ninguna respuesta simulada**; campo deshabilitado explicado |
| **loading.js / error.js** | Carga anunciada una sola vez; error con `role="alert"` y reintento |

### 7.2 Pruebas responsive
Matriz de ventanas: **320, 390, 768, 820, 1024, 1280 y 1440 px**, en claro y oscuro. Para cada una:
- Sin desplazamiento horizontal de la página (`scrollWidth ≤ innerWidth`).
- El modo de navegación correcto (barra inferior, riel o barra expandida).
- **A 860 px** con riel, el contenido mide **al menos 640 px** cuando las dos columnas heredadas están activas.
- Con la barra inferior, el último control de cada formulario heredado es alcanzable (no queda tapado).
- Áreas seguras: emulación con márgenes superior e inferior.
- Zoom de texto al 200 %.

### 7.3 Regresión visual de las nueve pantallas
La comparación de la Fase 1 mide el `<body>` completo, incluido el menú, que ahora se reemplaza. Para la Fase 2 se usa un modo con **alcance al contenido**:
- **Línea base nueva (subfase 2.0)**, capturada sobre el código actual (`32a4857`): los estilos calculados de cada elemento **dentro del contenido de cada pantalla** (todo lo que hay en `.wrap` salvo el menú actual).
- **Comparación (subfase 2.2 en adelante):** lo mismo dentro de `main#contenido > .wrap`.
- Se comparan los estilos que **no dependen del ancho** del contenedor. Se excluyen `width`, `height` y `grid-template-columns`, que cambian legítimamente porque el contenido ahora está junto a una barra lateral. Esas dimensiones se revisan aparte con las pruebas responsive de 7.2.
- Matriz: **9 pantallas × (390, 768, 1024, 1280 px) × (claro, oscuro) = 72 comparaciones**. Resultado esperado: **0 diferencias**.
- Prueba de control: un cambio deliberado debe detectarse (como en la Fase 1).
- `/login` se compara completo, sin modo de alcance.

### 7.4 Accesibilidad y teclado
- **Recorrido completo solo con teclado:** enlace de salto, barra lateral, barra superior, contenido, panel del asistente; sin trampas de foco y con orden lógico.
- **Atajos:** `Ctrl/Cmd+K` abre la paleta aun con el foco en un campo de texto de un formulario heredado; ningún otro atajo se activa mientras se escribe.
- **Diálogos** (paleta, hoja "Más", notificaciones en móvil, asistente en móvil): `role="dialog"`, `aria-modal`, nombre, trampa de foco, Escape y retorno del foco.
- Foco visible, objetivos táctiles de al menos 44 px en móvil, `prefers-reduced-motion` respetado, contraste ≥ 4,5:1 para texto y ≥ 3:1 para controles (pruebas existentes más los tokens nuevos).
- Inspección del DOM (roles, nombres, jerarquía de encabezados) como en la Fase 1. **No se usa lector de pantalla ni auditoría automática**, igual que antes; queda dicho en cada informe.

### 7.5 Estados de carga, error y vacío
| Estado | Dónde | Qué se ve |
|---|---|---|
| Carga | `loading.js` | `Skeleton` anunciado dentro del contenido |
| Error | `error.js`, cierre de sesión | `ErrorState` con reintento |
| Vacío | Paleta sin resultados; panel de notificaciones; lista de resultados de frentes | `EmptyState` compacto con el texto adecuado |
| No conectado | Panel del asistente | Estado explícito, sin respuestas simuladas |
| Parcial | No aplica en el shell | |

### 7.6 Pruebas automáticas nuevas
`navegacion` (nueve rutas, grupos, iconos existentes, migas, activo exacto de `/` y por prefijo), `busqueda` (acentos, mayúsculas, palabras clave, orden), `frenteActivo` (ids válidos, URL, conservación del parámetro, registro vacío), `asistente` (siete estados, solo "No conectado" impide enviar), `shell-aislamiento` (sin Supabase salvo el cierre de sesión en `UserMenu`, sin `fetch`, el enlace de Laboratorio solo en desarrollo) y ampliación de `solo-tokens` y `contraste`. Se mantienen las 225 pruebas existentes.

---

## 8. Plan de ejecución

### 8.1 Subfases

| Subfase | Contenido | Archivos principales | Toca módulos | Complejidad | Aprobación |
|---|---|---|---|---|---|
| **2.0 Línea base** | Modo de captura con alcance al contenido; línea base de 72 combinaciones (más `/login`) sobre `32a4857`; inventario | `tests/visual/*` | No | S | No |
| **2.1 Dominio de navegación** | `navegacion`, `busqueda`, `frenteActivo`, `asistente` con sus pruebas (sin interfaz) | `lib/domain/*`, `tests/*` | No | S a M | No |
| **2.2 Shell base** | Marco, barra lateral (expandida y riel), barra superior con migas, barra inferior y hoja "Más", enlace de salto, título y anuncio de ruta, `loading.js`, aloja los módulos, cambia `layout.js`. Los botones de búsqueda, notificaciones y asistente aún no abren nada | `components/shell/*`, `styles/*`, `app/(app)/layout.js`, `app/(app)/loading.js`, `tokens.css` | **Solo el layout** | **L** | **Sí (punto 1)** |
| **2.3 Funciones** | Paleta de búsqueda, selector de frentes (con estado en la URL), notificaciones visuales, menú de cuenta, tema en todos los lugares | `components/shell/*` | No | M a L | No |
| **2.4 Asistente** | Botón flotante y panel sin IA, siete estados en el laboratorio, `error.js` con `ErrorState` | `components/shell/*`, `lib/domain/asistente.js`, laboratorio | Solo `error.js` | M | **Sí (punto 2)** |
| **2.5 Validación y cierre** | Pruebas responsive, regresión de 72 combinaciones, teclado y accesibilidad, producción, base de datos en solo lectura, `docs/SHELL.md`, informe final | `docs/*`, `tests/*` | No | M | **Sí (punto 3, final)** |

**Complejidad global:** L.
Cada subfase termina con `npm test`, compilación, comprobación visual con tu sesión, un commit sin secretos y un informe de archivos, pruebas y resultados.

### 8.2 Dependencias
- 2.1 es independiente y se puede probar sin interfaz.
- 2.2 depende de 2.0 (la regresión) y de 2.1 (los datos de navegación).
- 2.3 depende de 2.2 (el marco y el proveedor de estado).
- 2.4 depende de 2.2 y de `asistente.js` (2.1).
- 2.5 depende de todas.

### 8.3 Riesgos

| # | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| R1 | Las dos columnas heredadas (corte a 860 px de ventana) quedan estrechas junto a una barra lateral | Alto | Riel de 72 px en tablet; criterio de al menos 640 px de contenido a 860 px; se verifica en 7.2 |
| R2 | Neutralizar el relleno y el fondo heredados del `body` alcanza también a `/login` | Alto | Regla acotada con `body:has([data-shell])`; comparación completa de `/login` antes y después |
| R3 | Estilos de elemento heredados (`ul`, `li`, `header`) se filtran al shell | Medio | Neutralización explícita en cada módulo CSS; comprobación en el navegador de las propiedades calculadas del shell |
| R4 | La barra inferior tapa los formularios de las pantallas heredadas | Alto | Relleno inferior con área segura; prueba de alcanzabilidad por pantalla |
| R5 | Errores de trampa de foco en la hoja, la paleta y el panel | Medio | Una sola implementación compartida de diálogo, con prueba de teclado en cada uno |
| R6 | Desajuste de hidratación al leer preferencias (barra expandida o riel) | Medio | Se leen en un efecto, con un valor por defecto estable en el servidor |
| R7 | `Ctrl/Cmd+K` choca con atajos del navegador o con campos de texto | Bajo | Se captura solo `Ctrl/Cmd+K`; se verifica con el foco en formularios heredados |
| R8 | El parámetro `?frente=` se pierde al navegar o no se reconoce | Medio | `conFrente()` en todos los enlaces del shell, con pruebas |
| R9 | Un filtro que no hace nada confunde al usuario | Medio | Nota explícita "Aún no se aplica en esta pantalla" gobernada por `MODULOS_CON_FILTRO` |
| R10 | `useSearchParams` obliga a un límite `Suspense` en el build | Bajo | Se envuelve el selector; se confirma con la compilación |
| R11 | El enlace de Laboratorio aparece en producción | Medio | Condición `NODE_ENV` y prueba automática |
| R12 | Línea base de regresión sensible a ruido por anchos | Medio | Se excluyen las propiedades derivadas del ancho; el ancho se prueba aparte |
| R13 | `:has()` no existe en navegadores muy antiguos | Bajo | Sin soporte solo queda el relleno heredado alrededor del shell; aceptable (ver D2-11) |
| R14 | Re-renderizados innecesarios por el estado compartido | Bajo | Estado mínimo y proveedores separados por responsabilidad |
| R15 | El cierre de sesión se comporta distinto que antes | Alto | Mismo flujo y mismas llamadas; prueba manual de ida y vuelta con tu sesión |
| R16 | Los usuarios esperan que la búsqueda encuentre contenido | Medio | El texto de la paleta explica el alcance y lo pendiente |
| R17 | `loading.js` introduce un salto visual al navegar | Bajo | Esqueleto con la altura del contenido típico; se revisa a la vista |
| R18 | El título dinámico no se actualiza en la primera carga | Bajo | Efecto en el montaje y en cada cambio de ruta |

### 8.4 Archivos afectados (resumen)
- **Crear:** unos 20 componentes y hojas en `components/shell`, 4 módulos de dominio, `styles/shell.css`, `app/(app)/loading.js`, 5 archivos de pruebas, `docs/SHELL.md`.
- **Modificar:** `app/(app)/layout.js`, `app/(app)/error.js` (opcional), `styles/tokens.css` (solo agrega), laboratorio, `tests/visual`, `tests/solo-tokens`, `tests/contraste`, `tests/README.md`.
- **No tocar:** módulos de negocio, `middleware.js`, `lib/supabase`, login, `auth`, `globals.css`, `app/layout.js`, Supabase.

### 8.5 Puntos de aprobación obligatorios
1. **Después de 2.2:** el shell base navegable en escritorio, tablet y móvil, con los módulos alojados y la regresión de contenido en cero.
2. **Después de 2.4:** funciones completas (búsqueda, frentes, notificaciones, cuenta, asistente).
3. **Después de 2.5:** validación final y cierre formal de la Fase 2.

No se avanza entre puntos sin tu autorización.

---

## 9. Decisiones que necesito de ti

| Id | Decisión | Recomendación |
|---|---|---|
| **D2-1** | **Aspecto de los módulos heredados dentro del shell.** A) Conservar su paleta y su fondo actuales; el shell pinta sus propias superficies. B) Repintarlos con los tokens nuevos (cambia sus colores y obliga a rehacer la línea base) | **A**, para mantener la regresión estricta; B se puede hacer más adelante como una subfase aparte |
| **D2-2** | **Dónde vive el frente activo.** A) En la URL (`?frente=`). B) Solo en memoria | **A**: compartible y listo para que los módulos lo lean en el servidor |
| **D2-3** | **Alcance de la búsqueda.** Solo navegación y acciones; el contenido queda para la Fase 5 | Aprobar |
| **D2-4** | **Notificaciones.** Solo visuales, con estado vacío honesto y sin contador | Aprobar |
| **D2-5** | **Finanzas en el menú.** Mostrar solo Resumen y Gastos (las dos rutas que existen) | Aprobar |
| **D2-6** | **Grupo "Asistente IA".** Una sola entrada que abre el panel; Memoria, Insights y Automatizaciones se listan como pendientes dentro del panel y no como enlaces | Aprobar |
| **D2-7** | **Nombre y foto del usuario.** Diferidos a Home (Fase 3); el menú de cuenta usa un icono genérico | Aprobar |
| **D2-8** | **`Nav.js`.** Mantenerlo sin uso durante la fase y retirarlo en el cierre solo si lo apruebas | Aprobar |
| **D2-9** | **`error.js`.** Pasar a `ErrorState` (es un archivo del grupo `(app)`, no de un módulo) | Aprobar |
| **D2-10** | **Puntos de corte.** Riel a partir de 768 px y barra inferior por debajo; barra expandida desde 1280 px | Aprobar |
| **D2-11** | **`body:has()`.** Usar `:has()` para acotar el relleno heredado solo al shell, aceptando que los navegadores muy antiguos mantengan el relleno | Aprobar |
| **D2-12** | **Título del documento.** Actualizarlo desde el cliente según la ruta | Aprobar |
| **D2-13** | **Colores de los frentes.** Siguen como propuesta en el selector. ¿Los apruebas o los ajustas viéndolos en el shell? | Revisarlos en el punto de aprobación 2 |

---

## 10. Qué queda fuera de la Fase 2
Rediseño de Home y de cualquier módulo, filtros que realmente actúen sobre los módulos, búsqueda de contenido, notificaciones reales, nombre y avatar, conexión de la IA y su memoria, Personas, Calendario, Conexiones, reubicación de rutas y eliminación de módulos o de `Nav.js`.
