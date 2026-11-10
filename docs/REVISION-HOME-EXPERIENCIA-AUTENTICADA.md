# Preparación: revisión integral de Home y de la experiencia autenticada

Fecha: 9 nov 2026. Base: especificación v1.11.1 §3 (Home), `docs/AUDITORIA-3.0.md` y el código actual de `web/`. **Es un plan y un inventario: no se cambió código, arquitectura, RLS ni autenticación, no se ejecutó SQL en Supabase, no se usaron credenciales de producción y no se hicieron commits.**

## 1. Estado actual de Home (`/`, «Mi día»)

La pantalla es la heredada de la Fase 1 más un bloque nuevo («Life Pulse de hoy»). Se revisó el código; **la experiencia autenticada no se ha visto con datos reales** (el navegador de pruebas no tiene sesión).

| Spec §3 | Qué pide | Estado real | Brecha |
|---|---|---|---|
| 3.1 Bienvenida | Saludo contextual, fecha de Bogotá, resumen breve, acceso a prioridades | Fecha y «Mi día»; sin saludo; resumen desde `resumen_dia` (sin escritor) | Falta saludo (`saludo()` existe en `fechas.js`) y estado honesto del resumen |
| 3.2 Focus Mode | Protagonista de Home: inicio rápido en Productivity/Enjoyment | Existe en `/focus` y barra persistente; **no hay inicio rápido en Home** | Falta un bloque de inicio rápido |
| 3.3 Life Pulse | Tres indicadores, período diario/semanal/mensual, **tendencias** y detalle | Resumen del día en Home; selector de período y detalle en `/life-pulse`; **sin tendencias** | Falta la tendencia (serie por períodos) |
| 3.4 Distribución por frentes | Atención frente a objetivo por frente | Existe en `/atencion` y en Balance | Falta un bloque equivalente en Home |
| 3.5 Prioridades diarias | Prioridad alta/media/baja, orden manual, fijadas | Columnas `prioridad`, `orden`, `fijado_dia` **están en el SQL v1.11 pero no aplicadas**; el componente `Pendientes` heredado no las usa | Bloqueado por la migración; el componente heredado debe conservarse (P10) |
| 3.6 Actividad reciente | Fuentes reales sin duplicar (P11) | No existe | Falta |
| 3.7 Asistente | Disponible sin simular | Botón y panel del shell sin IA conectada (honesto) | Sin brecha |
| 3.8 Nombre «Home» | La navegación se llama «Home» | Sigue «Mi día» | Cambio de nombre pendiente de ejecutar |

### Hallazgos concretos para corregir en la revisión
1. **Agenda, correos y resumen del día muestran «Sin eventos hoy», «Sin correos por revisar» y un texto genérico** aunque las tablas `agenda_hoy`, `correos_hoy` y `resumen_dia` **no tienen escritor** (AUDITORIA-3.0 H7). P10 exige mostrar «fuente no conectada», no «sin eventos». Hoy un vacío por falta de fuente se confunde con un día libre.
2. **Life Pulse de hoy desaparece** (devuelve `null`) cuando la migración no está aplicada. Es seguro, pero Home no explica por qué falta; conviene un aviso discreto de «Fase 3 aún no activada».
3. **Carga de Life Pulse:** cada visita a Home lee todo `cambios_registro` paginado (hasta miles de filas con el tiempo) y reconstruye obligaciones en el navegador. Es correcto hoy, pero **no escala**; las opciones (resumen precalculado, vista SQL, límite por antigüedad) **exigen una migración y no se tocan sin autorización**.
4. **Sondeo del temporizador:** el proveedor del shell consulta 4 tablas al cargar cada ruta y cada 30 s. Con la migración sin aplicar se detiene tras el primer error (verificado en pruebas); con ella aplicada conviene medir el costo en móvil.
5. **Seguridad a vigilar (sin cambiar):** el middleware trata `/login*` como público (`path.startsWith('/login')`). Hoy solo hay `/login`; **ninguna pantalla nueva debe colgar de `/login/…`** (la usé solo en pruebas temporales y ya se eliminó).
6. Mensajes y estados de error: `error.js` cubre las pantallas de servidor; los paneles cliente de la Fase 3 traducen errores propios. Falta verificar que un error de red real (sin conexión) se vea igual en todas.

## 2. Experiencia autenticada: lista de verificación

Requiere **tu sesión real**. Propongo que la hagamos juntos en el navegador de la aplicación (o que me indiques cómo quieres compartirla), sin que yo escriba credenciales.

| # | Verificación | Cómo |
|---|---|---|
| A1 | Entrada con Google, `ALLOWED_EMAIL`, cierre de sesión y redirecciones (`/login` ↔ `/`) | Tú inicias sesión; yo reviso redirecciones y estados |
| A2 | Cada ruta de negocio carga autenticada: `/`, `/life-pulse`, `/panel`, `/focus`, `/habitos`, `/atencion`, `/metas`, `/finanzas`, `/gastos`, `/jornada`, `/salud`, `/biblioteca`, `/cerebro` | Recorrido con captura y consola |
| A3 | Estados de la Fase 3 **sin migración**: «aún no está activado» en Focus, Hábitos, Atención y Life Pulse, sin errores en consola ni peticiones repetidas | Consola y red |
| A4 | Shell: barra lateral, barra superior, barra móvil, hoja «Más», buscador, selector de frente (`?frente=`), asistente | Escritorio y 375 px |
| A5 | Tema claro/oscuro en Home, Life Pulse y Focus (contraste de los anillos) | Emulación de esquema de color |
| A6 | Rendimiento percibido de Home (peticiones por carga, tiempo hasta contenido) | Red del navegador |
| A7 | Regresión de módulos heredados (Pendientes, Salud, Gastos, Metas) sin cambios de comportamiento | Recorrido manual + `tests/visual` si hay línea base |

## 3. Orden propuesto (sin tocar la arquitectura)

1. **Recorrido autenticado (A1–A7)** y lista de defectos reales, solo lectura.
2. **Estados honestos de Home** (hallazgo 1 y 2): cambio de presentación, sin esquema.
3. **Home incrementalmente:** saludo, inicio rápido de Focus y distribución por frentes reutilizando lo existente; `Pendientes` heredado intacto.
4. **Tendencias de Life Pulse** (cálculo en cliente, sin migración) si el costo de carga es aceptable.
5. **Renombrar «Mi día» a «Home»** en la navegación y sus pruebas (3.8), tras tu aprobación.
6. Lo que **requiere migración** queda en espera de tu autorización: prioridades diarias (3.5), rendimiento de Life Pulse (hallazgo 3), actividad reciente consolidada (3.6, opcional).

## 4. Decisiones que necesito de ti

| # | Pregunta | Mi recomendación (no es una aprobación) |
|---|---|---|
| H1 | ¿Hacemos el recorrido autenticado juntos, con tu sesión iniciada en el navegador de la aplicación? | Sí; es el paso que desbloquea todo lo demás |
| H2 | Agenda, correos y resumen sin escritor: ¿«fuente no conectada» (P10) hasta decidir quién los alimenta? | Sí |
| H3 | ¿Aplicamos el cambio de nombre a «Home» en esta fase o al final? | Al final, tras el recorrido |
| H4 | ¿Autorizas, más adelante, la etapa 0 (solo lectura) en Supabase para medir el rendimiento y los roles reales? | Sí, cuando termine la revisión de Home |

## 5. Límites vigentes

No ejecutar SQL en Supabase, no usar credenciales de producción, no modificar autenticación, middleware ni RLS, no implementar T-9 ni la etapa 4, no hacer commits, no tocar la arquitectura ni migrar. Mi día, `Pendientes` y los módulos heredados no se modifican sin autorización.
