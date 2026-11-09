// DATOS DE DEMOSTRACIÓN. Solo para revisar el aspecto de los componentes en /laboratorio.
//
// - No son datos reales ni representan nada del usuario. Cada texto se rotula "Ejemplo".
// - Este archivo no puede importarse desde fuera de app/(app)/laboratorio
//   (lo comprueba tests/aislamiento-laboratorio.test.mjs).
// - No hay consultas ni escrituras a Supabase.

export const AVISO_DEMO = 'DATOS DE DEMOSTRACIÓN: ejemplos para ver el aspecto, no son tus datos.';

// Valores de barra de progreso. `null` y los inválidos muestran "Sin datos"; el 0 es un 0 % real.
export const BARRAS_DEMO = [
  { etiqueta: 'Ejemplo: avance bajo', valor: 0.12, tono: 'primario' },
  { etiqueta: 'Ejemplo: avance medio', valor: 0.5, tono: 'exito' },
  { etiqueta: 'Ejemplo: casi completo', valor: 0.92, tono: 'advertencia' },
  { etiqueta: 'Ejemplo: completo', valor: 1, tono: 'exito' },
  { etiqueta: 'Ejemplo: cero real', valor: 0, tono: 'primario' },
  { etiqueta: 'Ejemplo: sin datos (null)', valor: null, tono: 'primario' },
  { etiqueta: 'Ejemplo: valor inválido (NaN)', valor: NaN, tono: 'primario' },
  { etiqueta: 'Ejemplo: fuera de rango (1,7 se acota a 100 %)', valor: 1.7, tono: 'peligro' },
];

// Una barra por frente de diseño, para ver los seis colores propuestos.
export const BARRAS_FRENTES_DEMO = [
  { etiqueta: 'Ejemplo de TANKU', valor: 0.8, tono: 'tanku' },
  { etiqueta: 'Ejemplo de TICKETCODE', valor: 0.6, tono: 'ticketcode' },
  { etiqueta: 'Ejemplo de Personal', valor: 0.45, tono: 'personal' },
  { etiqueta: 'Ejemplo de Salud', valor: 0.7, tono: 'salud' },
  { etiqueta: 'Ejemplo de Familia', valor: 0.3, tono: 'familia' },
  { etiqueta: 'Ejemplo de Otros proyectos', valor: 0.55, tono: 'otros' },
];

// Slugs reales de la tabla `frentes`, solo como entrada de los chips (no son datos del usuario).
export const SLUGS_FRENTES = [
  'tanku', 'ticketcode-eventos', 'ticketcode-eve', 'personal', 'hogar',
  'salud', 'jardin', 'salud-abuela', 'hama', 'crochet',
];
export const SLUG_DESCONOCIDO_DEMO = 'frente-nuevo-sin-mapear';
