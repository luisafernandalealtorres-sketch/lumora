# Revisión integral de Home: hallazgos, causas verificadas y propuesta

Fecha: 10 nov 2026. Complementa `docs/REVISION-HOME-EXPERIENCIA-AUTENTICADA.md`. Hecha con la sesión real del usuario en el navegador de la aplicación (servidor de desarrollo local). **No se ejecutó SQL en Supabase, no se usaron credenciales de producción, no se cambió RLS, autenticación ni middleware y no se hicieron commits.** Solo se aplicó el cambio del hallazgo 1 (autorizado); el resto son hallazgos y propuesta.

## 1. Hallazgos y causas verificadas

| # | Hallazgo | Estado | Causa verificada |
|---|---|---|---|
| **1** | Home mostraba «Sin eventos hoy» y «Sin correos por revisar» (y un resumen «se actualiza a las 6:00 a. m.») aunque nada alimenta esas fuentes | **Resuelto** | Ninguna función de la aplicación ni tarea programada escribe en `agenda_hoy`, `correos_hoy` ni `resumen_dia` (búsqueda en todo el código: solo hay escrituras en las pruebas `tests/db`; las tareas `tablero-mi-dia` y `recordatorio-jornada` solo editan `mi-dia/tablero.html` y `jornada/*.md`). Una consulta vacía sobre una tabla sin escritor no significa «sin eventos» |
| 2 | `/atencion` terminó una vez en `/` | **No es de la aplicación; no reproducible** | Ver §2 |
| 3 | En la barra lateral de escritorio los últimos elementos («Cerebro», «Asistente», «Laboratorio») se dibujan **encima del pie** (selector de tema y «Contraer barra») | Abierto, verificado | `Sidebar.module.css`: `.nav { flex: 1; min-height: 0 }` deja que el menú se encoja por debajo de su contenido (alto asignado 594 px, contenido 838 px) y, al tener `overflow: visible`, el excedente se pinta sobre `.pie`. Con 800 px de alto ya ocurre. Es de la Fase 2, no de la Fase 3 |
| 4 | El formulario del componente heredado `Pendientes` tiene controles de 40 px de alto (campo, selector y botón «Agregar») en móvil | Abierto | El ajuste de 44 px de la Fase 2 cubrió el shell; `Pendientes` se conserva sin modificar (P10) |
| 5 | «Life Pulse de hoy» **desaparece sin explicación** mientras la migración no esté aplicada | Abierto, decisión tuya | Es intencional (`LifePulseResumen` devuelve `null` si la Fase 3 no está disponible) para no alterar Mi día; pero Life Pulse es protagonista de Home (§3.3) y hoy no se ve ni que falta |
| 6 | La página de Home pide `metas` primero y después las otras 5 consultas | Abierto, menor | `page.js` espera `metas` antes del `Promise.all`: es una cascada evitable sin cambiar el resultado |
| 7 | En desarrollo, cada lectura del cliente se ve duplicada | No es defecto | Doble render de React en modo estricto; no ocurre en producción |
| 8 | La bandera «fuente conectada» es manual | Nota | `lib/domain/fuentes.js`: se pasa a `true` solo cuando se decida quién alimenta la fuente; si aparecen filas, Home las muestra aunque la bandera siga en `false` |

Lo verificado sin hallazgos: las 13 rutas cargan autenticadas; los módulos heredados (`/panel`, `/salud`, `/metas`, `/gastos`) no muestran pantalla de error; no hay desbordes horizontales a 375 px ni a 1280 px; encabezados, regiones y nombres accesibles correctos (0 botones sin nombre); no hay sondeo repetido cuando la Fase 3 no está disponible.

## 2. Redirección ocasional `/atencion` → `/`: investigación

**Conclusión: no la causa la aplicación (middleware, navegación, efectos ni compilación). No se modificó nada.**

Evidencia:
1. **El servidor nunca recibió esa petición.** En el registro del servidor de desarrollo, tras `GET /habitos 200` aparece `GET / 200` y recién después `GET /life-pulse`; **no hay `GET /atencion` ni ninguna respuesta 307/308** en ese momento. `/atencion` solo se compiló y sirvió después, en el reintento. Si hubiera sido una redirección del servidor o del middleware, el registro mostraría la petición a `/atencion` y un 3xx.
2. **El middleware no puede producir esa redirección.** Sus únicas redirecciones son a `/login` (sin sesión o cuenta no autorizada) y de `/login*` a `/` (con sesión). `/atencion` no coincide con ninguna; sin sesión iría a `/login`, nunca a `/`.
3. **No hay código del cliente que navegue a `/` solo.** Búsqueda de `router.push/replace`, `location.*`, `redirect(`: solo el cierre de sesión (`/login`), la paleta de búsqueda (acción del usuario), `useFrenteActivo` (misma ruta con `?frente=`) y el callback de autenticación.
4. **No se reproduce.** 5 navegaciones posteriores a `/atencion` (desde 4 pantallas distintas, con `?frente=`, y con el servidor **recién reiniciado** para forzar la compilación en frío) llegaron siempre a `/atencion` con 200. `fetch` manual de `/atencion`, `/habitos`, `/life-pulse`, `/focus` devuelve 200 sin redirecciones; solo `/atencion/` (barra final) tiene la redirección normal de Next a `/atencion`.
5. **Patrón coincidente en la herramienta:** dos veces el navegador del panel terminó en otra URL tras una navegación (una vez a `/login`, tras arrancar el servidor, y esta a `/`), ambas durante la compilación inicial de rutas o inmediatamente después de arrancar el servidor, y con una petición a `/` que no pedí. Lo más probable es una carrera del propio panel (una carga de `/` en curso que gana la navegación), no un fallo de la aplicación.

**Qué haría falta para descartarla del todo (sin tocar nada):** si vuelve a ocurrir fuera del panel de pruebas (por ejemplo en tu navegador normal), anotar la hora y revisar el registro del servidor; con eso se confirma o se reabre.

## 3. Inventario: qué está realmente conectado

| Módulo / fuente | Lectura | Escritura | Estado |
|---|---|---|---|
| Pendientes (en Mi día), Metas e hitos | `pendientes`, `metas`, `hitos` | Sí (insertar, marcar, borrar) | **Conectado y con datos** |
| Gastos, Finanzas (ingresos, recurrentes, deudas, presupuestos) | Sí | Sí | **Conectado** |
| Jornada, Cerebro (notas), Biblioteca | Sí | Sí | **Conectado** |
| Salud heredado (`habitos`, `habito_registros`, `medidas`, `objetivos_salud`) | Sí | Sí | **Conectado** (no se toca) |
| Panel | `pendientes`, `gastos`, `jornadas`, `biblioteca`, `notas` | No | **Conectado (solo lectura)** |
| **Focus, Hábitos, Atención, Life Pulse** (Fase 3) | Tablas v1.11 | RPC v1.11 | **Interfaz y lógica listas y probadas en PostgreSQL local; en Supabase NO activas** (la migración no está aplicada): muestran «aún no está activado» |
| Agenda de hoy, Correos, Resumen del día | `agenda_hoy`, `correos_hoy`, `resumen_dia` | **Nadie escribe** | **No conectadas** → ahora «Fuente no conectada» |
| Tablero estático `mi-dia/tablero.html` | — | Tarea de las 6:00 a. m. (Claude) | Artefacto aparte; **no** alimenta la aplicación |
| Notificaciones (campana) | Sin origen | — | **Solo visual** (lo dice: «Todavía no están conectadas») |
| Asistente IA | — | — | **Solo visual** (dice que no responde ni ejecuta) |
| Búsqueda (Ctrl+K) | Solo navegación entre pantallas | — | Real, pero no busca contenido |
| Selector de frente (`?frente=`) | URL | — | Real en Atención y Life Pulse (solo Balance); **los módulos heredados lo ignoran** y el shell lo avisa |
| Laboratorio | Datos de demostración | — | Solo desarrollo (404 en producción) |

## 4. Propuesta: Home como centro de control

Principios: se conservan la ruta `/` y todas las funciones de Mi día hasta que cada una tenga equivalente verificado (§3.8); `Pendientes` heredado no se modifica; nada simula datos; un bloque sin fuente se declara, no se oculta.

### 4.1 Estructura (móvil, de arriba abajo; en escritorio el orden se reparte en dos columnas)

| Orden | Bloque | Fuente | Estado de datos | ¿Migración? |
|---|---|---|---|---|
| 1 | **Saludo, fecha y resumen del día** (`saludo()` + fecha de Bogotá; el resumen muestra «Fuente no conectada» mientras no tenga escritor) | `resumen_dia` | Honesto | No |
| 2 | **Focus** (protagonista): si hay temporizador, tarjeta con tiempo y controles; si no, inicio rápido (modalidad, frente, «Iniciar») | Fase 3 | Deshabilitado con «Fase 3 aún no activada» | **Sí** |
| 3 | **Life Pulse** (protagonista): tres anillos con selector diario/semanal/mensual y enlace al detalle | Fase 3 | Hoy desaparece: proponer tarjeta «Life Pulse aún no está activado» | **Sí** |
| 4 | **Prioridades del día** (alta/media/baja, orden manual, fijadas) | `pendientes` + columnas nuevas | Mientras tanto sigue el `Pendientes` heredado | **Sí** (columnas `prioridad`, `orden`, `fijado_dia`) |
| 5 | **Distribución por frentes** (puntos frente a objetivo; usa el filtro `?frente=`) | `objetivos_atencion`, sesiones | Reutiliza Balance | **Sí** |
| 6 | **Agenda y correos** (bloque secundario, P10) | `agenda_hoy`, `correos_hoy` | «Fuente no conectada» | No |
| 7 | **Actividad reciente** (P11: sesiones, pendientes completados, notas, biblioteca, jornadas, tiempo de hábitos; sin finanzas ni duplicados) | Varias | Las fuentes heredadas se pueden mostrar ya; las de Fase 3 al migrar | Parcial |
| 8 | **Pendientes** (componente heredado, intacto) y **Avance por frente** (heredado) | Hoy conectadas | Conectado | No |

Escritorio: columna principal ancha (1–3 y 4) y columna lateral (5, 6, 7), con «Pendientes» y «Avance por frente» debajo, como hoy. Móvil: una columna en el orden anterior, barra inferior sin cambios.

### 4.2 Orden de ejecución propuesto (cada paso verificable y reversible)

1. **Sin migración y sin riesgo:** saludo y fecha; tarjeta «Fase 3 aún no activada» (en vez de ocultar Life Pulse); paralelizar la consulta de `metas` (hallazgo 6).
2. **Corrección del menú lateral** (hallazgo 3): una línea de CSS en `Sidebar.module.css`; es de la Fase 2 y requiere tu visto bueno por tocar el shell.
3. **Actividad reciente** con fuentes heredadas (notas, biblioteca, jornadas, pendientes completados).
4. **Tras autorizar la migración v1.11:** Focus rápido, Life Pulse con datos, Distribución por frentes y, con las columnas nuevas, Prioridades del día.
5. **Al final:** renombrar «Mi día» a «Home» en la navegación y sus pruebas (3.8), y decidir quién alimenta agenda, correos y resumen.

### 4.3 Qué **no** cambia
Rutas, módulos heredados, `Pendientes`, autenticación, middleware, RLS, T-9 y etapa 4.

## 5. Decisiones que necesito

| # | Pregunta | Recomendación (no es una aprobación) |
|---|---|---|
| H5 | ¿Aprueba la estructura de §4.1 como la definitiva de Home? | Sí |
| H6 | ¿Corregimos ya el menú lateral (hallazgo 3)? | Sí, es una línea de CSS |
| H7 | ¿Mostramos «Life Pulse aún no está activado» en Home mientras no haya migración? | Sí |
| H8 | ¿Quién alimentará agenda, correos y resumen (Google Calendar/Gmail hacia Supabase, o se queda el tablero estático)? | Decidirlo antes de conectar la fuente; hoy es «no conectada» |
| H9 | ¿Autorizas la etapa 0 (solo lectura) en Supabase, necesaria antes de la migración? | Sí, cuando cierres la revisión de Home |
