# Home, centro de control: informe de implementación

Fecha: 10 nov 2026. Base aprobada: `05_HOME_CENTRO_DE_CONTROL.md` (D-N1 a D-N8 y las siete precisiones). **Pasos 1 a 6 y 8 implementados; el paso 7 espera la migración v1.11.** Sin SQL en Supabase, sin cambios de autenticación, RLS ni middleware, sin escribir datos de Calendar o Gmail, sin integraciones externas, sin commits.

## 1. Qué se entregó

| Paso | Contenido | Estado |
|---|---|---|
| 1 | Funciones puras: `estadosHome`, `resumen`, `mapaFrentes`, `alertas` (+ `acciones` de datos) | Hecho, con pruebas |
| 2 | Estructura de Home en rejilla de 12 columnas (escritorio), dos columnas (tablet) y orden propio en móvil; encabezado inteligente con degradado y alerta destacada solo con datos reales | Hecho |
| 3 | Mapa de los seis frentes: registros reales de la semana (conteo, sin ponderar), barra de concentración, pendientes, metas, gasto de TANKU y TICKETCODE, y «Requiere atención» con el motivo siempre visible | Hecho (reglas 1 y 2 hoy; 3 y 4 con la Fase 3) |
| 4 | Hoy: prioridades (vencidos, vencen hoy, más antiguos) con casillas reales; «Todos los pendientes» con el componente heredado **intacto**; agenda y correos solo si su fuente tiene datos; actividad reciente | Hecho |
| 5 | Resumen ejecutivo (pendientes, avance de metas, gastos y presupuesto, Jornada, hábitos de Salud) y Próximas acciones por reglas con motivo y evidencia | Hecho |
| 6 | Accesos rápidos funcionales: nuevo pendiente, registrar gasto, agregar nota, capturar idea, consultar al asistente | Hecho |
| 7 | Focus, Life Pulse y atención por frente **con datos** de la Fase 3 | **Condicionado a la migración v1.11** (la interfaz y las reglas 3 y 4 ya están listas) |
| 8 | Responsive, claro/oscuro y regresión de las 13 rutas | Hecho |

## 2. Estados de datos (cinco, distintos y con su texto)

`Sin datos` (no se puede calcular) · `Sin registros` (fuente conectada, sin registros en el período) · `Fuente no conectada` (agenda, correos, resumen) · `Error de lectura` (una fuente falló; solo ella, no la pantalla) · `Fase 3 aún no activada`. Ningún valor sin información se muestra como 0. La franja «Fuentes» mantiene agenda y correos fuera de las tarjetas mientras no estén conectados.

## 3. Archivos

- **Dominio nuevo:** `lib/domain/estadosHome.js`, `resumen.js`, `mapaFrentes.js`, `alertas.js` (y ajustes menores en `fuentes.js`).
- **Datos nuevos:** `lib/data/acciones.js` (escrituras con las mismas columnas que los módulos heredados).
- **Interfaz nueva:** `components/home/` (`HomeApp`, `HomeCentro`, `Bloques`, `HoyPrioridades`, `AccesosRapidos`, `BloqueEstado`, `useFase3Home`, `Home.module.css`); `app/(app)/page.js` reescrito para leer cada fuente por separado.
- **Conservados sin cambios:** `components/Pendientes.js`, `app/(app)/panel/page.js`, todos los módulos, el shell, middleware y `lib/supabase/*`.

## 4. Pruebas y verificación

- **Unitarias:** 512 PASS, 0 FAIL (incluye las de Home: estados, resumen, mapa de frentes y sus cuatro reglas, alertas, acciones y el refinamiento).
- **Build:** compila sin errores.
- **Con tu sesión real, escritorio y móvil, claro y oscuro:** Home carga sin errores de pantalla; los cinco estados aparecen donde corresponde; no hay sondeo repetido; sin desbordes horizontales; las 13 rutas cargan a 1280 px y a 375 px; los accesos rápidos abren y validan.
- **Vista con datos de demostración** (página temporal, ya eliminada): alertas, mapa con «Requiere atención» y motivo, prioridades y resumen se calculan como se espera. Los datos reales de tu base están vacíos, por eso hoy Home muestra estados vacíos honestos.

## 5. Notas y pendientes

- **Datos reales:** tu base no tiene registros todavía; al crear pendientes, gastos o notas con los accesos rápidos, Home los muestra. No escribí datos de prueba en tu base.
- **`/panel`:** su texto ahora dice «Agrega pendientes en Home…» (único cambio en esa pantalla, autorizado).
- **Paso 7:** requiere autorizar la migración v1.11 (y antes la etapa 0 de solo lectura).
- **Hábitos de Fase 3** se sumarán a «Hábitos de hoy» tras la migración, sin duplicar los de Salud.
- **Agenda y correos** siguen «no conectados» (decisión aparte).

## 6. Refinamiento funcional (segunda iteración)

- **Fase 3 sin repetirse:** una sola nota general bajo el encabezado; cada módulo conserva solo su estado corto («Se activa con la migración v1.11.»). En el mapa, las filas usan «—» con la explicación en su etiqueta accesible.
- **Mapa de los seis frentes como pieza central:** borde de énfasis, cabecera comparativa (Frente, Actividad de la semana, Atención frente al objetivo, Pendientes), barras con la misma escala, pendientes en segmentos y motivo visible; en móvil la cabecera se oculta y cada celda lleva su etiqueta.
- **Vacíos útiles:** Próximas acciones muestra las reglas que se vigilan; Hoy ofrece alta rápida de un pendiente y oculta los plegables vacíos.
- **Focus con sesión activa:** el reloj es el protagonista (hasta 112 px), con sesión, avance, controles y tono distinto en pausa.

## 7. Diseño visual (referencia aprobada)

Aplicado el lenguaje visual de `reference-home-dashboard.png` sin cambiar estructura, orden de bloques ni decisiones funcionales:

- **Fondo de Home:** violeta profundo con resplandores (solo en Home; las demás pantallas conservan su fondo).
- **Encabezado:** degradado abstracto violeta-azul con resplandor cálido. **Sin montañas** (D-H3).
- **Tarjetas** con profundidad, bordes luminosos y halo en Focus y el mapa; **casillas** redondeadas con check; **barras** con brillo y puntas redondeadas; **baldosas de icono** en Próximas acciones; **Accesos rápidos** como barra de píldoras.
- **Compartido con el resto de la aplicación:** el ítem activo del menú lateral (degradado violeta-azul) y el botón flotante del asistente (degradado y halo).
- **Tokens nuevos** en `styles/tokens.css`: `--ds-glow-warm`, `--ds-glow-rosa`, `--ds-sheen`, `--ds-grad-accent`, `--ds-grad-card`. Solo los usan Home, el menú activo y el botón del asistente.
- **Sin datos ficticios:** la referencia muestra cifras de ejemplo (78 %, porcentajes por frente, agenda, insights); no se replican. Life Pulse sigue sin puntaje global y las fuentes sin conectar muestran su estado honesto.
- **Objetivos táctiles:** el botón de borrar de Pendientes pasó de 18 px a 44 px mínimo (clase `todo-borrar`), sin cambiar su funcionalidad.
- **Corrección:** el fondo verdoso heredado que el estilo global de `section` ponía detrás de «Accesos rápidos» quedó anulado.
