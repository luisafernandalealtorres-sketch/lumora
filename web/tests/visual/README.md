# Regresión visual por estilos calculados

Compara, elemento por elemento, los estilos que el navegador calcula para cada pantalla antes y después de un cambio. Si un cambio altera sin querer el aspecto de una pantalla, aparece como una diferencia con el elemento y la propiedad exactos.

No es parte de `npm test` porque necesita un navegador y una sesión iniciada.

## Qué mide
Para cada elemento del `<body>` (y `<html>`): visualización, color, fondo, tipografía, márgenes, rellenos, bordes, radios, separaciones, tamaño, sombra, cursor y otras 50 propiedades. Es una comparación exacta: cualquier diferencia se reporta.

## Cobertura de la línea base de la Fase 1 (commit `6e8782e`)

| Eje | Valores |
|---|---|
| Pantallas | `/`, `/panel`, `/metas`, `/finanzas`, `/gastos`, `/jornada`, `/salud`, `/biblioteca`, `/cerebro` |
| Ancho | Escritorio 1280 px y móvil 390 px |
| Tema | Claro y oscuro (emulando `prefers-color-scheme`) |
| Total | 36 capturas, cada una con 45 a 144 elementos |

Estado de los datos al capturar: **base vacía** (estados vacíos y todos los formularios). Las listas con registros no entran en esta línea base; ver "Limitaciones".

## Procedimiento
1. Levantar la app (`npm run dev`) con la versión de referencia e iniciar sesión.
2. Fijar el tamaño y el esquema de color del navegador (por ejemplo 1280×800 claro).
3. Instalar la función de `snapshot-estilos.js` en `localStorage` bajo `__snapfn`.
4. En cada pantalla ejecutarla en modo `guardar` con la etiqueta `base|<ruta>|<esc>-<tema>` (por ejemplo `base|/panel|desk-light`).
5. Aplicar los cambios, reiniciar el servidor y repetir en modo `comparar`. El resultado esperado es `diferencias: 0`.

## Limitaciones
- Solo detecta cambios de estilo y de estructura, no juzga si algo "se ve bien". Se complementa con una revisión visual.
- Con la base vacía no cubre las listas con datos. Para cubrirlas hay que crear registros de prueba (ver `tests/db/`) con la autorización del dueño.
- Las capturas viven en el `localStorage` del navegador de desarrollo, no en el repositorio.
- Una diferencia en un elemento que depende del tamaño de su contenido (por ejemplo el alto de una caja con texto distinto) también se reporta.

## Modo con alcance al contenido (Fase 2)
`snapshot-estilos.js` incluye también `fnContenido`, que compara solo la columna de contenido (`main#contenido > .wrap`, o `.wrap` en el diseño anterior) sin el menú, y excluye `width`, `height` y `grid-template-columns` (dependen del ancho del contenedor; se revisan aparte con las pruebas responsive).

- Matriz: 9 pantallas × (390, 768, 1024, 1280 px) × (claro, oscuro) = **72 capturas**, etiqueta `c|<ruta>|<ancho>-<tema>`.
- Se corre en un `<iframe>` del mismo origen con el ancho indicado (así los `@media` responden al ancho del iframe) y el tema se fija con `localStorage['sb-theme']`.
- Línea base de la Fase 2: capturada sobre el commit `65ce206` (código de la Fase 1 sin shell). Comprobación de determinismo: 72/72 con 0 diferencias contra sí misma. Prueba de control: un cambio deliberado de `gap` y `letter-spacing` se detecta.
- Estado de los datos: base vacía (igual que la línea base de la Fase 1).
