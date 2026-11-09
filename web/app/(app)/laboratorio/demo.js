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

// ---- Fase 1.3: anillos, minigráficas y estados ----

export const ANILLOS_DEMO = [
  { etiqueta: 'Ejemplo: 78 %', valor: 0.78, tono: 'primario' },
  { etiqueta: 'Ejemplo: 35 %', valor: 0.35, tono: 'advertencia' },
  { etiqueta: 'Ejemplo: completo', valor: 1, tono: 'exito' },
  { etiqueta: 'Ejemplo: cero real', valor: 0, tono: 'primario' },
  { etiqueta: 'Ejemplo: sin datos (null)', valor: null, tono: 'primario' },
  { etiqueta: 'Ejemplo: inválido (NaN)', valor: NaN, tono: 'primario' },
];

export const ANILLOS_FRENTES_DEMO = [
  { etiqueta: 'Ejemplo de TANKU', valor: 0.82, tono: 'tanku' },
  { etiqueta: 'Ejemplo de TICKETCODE', valor: 0.64, tono: 'ticketcode' },
  { etiqueta: 'Ejemplo de Personal', valor: 0.5, tono: 'personal' },
  { etiqueta: 'Ejemplo de Salud', valor: 0.7, tono: 'salud' },
  { etiqueta: 'Ejemplo de Familia', valor: 0.3, tono: 'familia' },
  { etiqueta: 'Ejemplo de Otros proyectos', valor: 0.58, tono: 'otros' },
];

export const SERIES_DEMO = [
  { etiqueta: 'Ejemplo: sube', puntos: [2, 3, 3, 5, 6, 8, 9], tono: 'exito' },
  { etiqueta: 'Ejemplo: baja', puntos: [9, 8, 8, 6, 5, 3, 2], tono: 'peligro' },
  { etiqueta: 'Ejemplo: irregular', puntos: [4, 7, 3, 8, 5, 9, 6, 10], tono: 'primario' },
  { etiqueta: 'Ejemplo: plana', puntos: [5, 5, 5, 5, 5], tono: 'neutro' },
  { etiqueta: 'Ejemplo: con meta de referencia', puntos: [3, 4, 6, 5, 7, 8], tono: 'ticketcode', meta: 9 },
  { etiqueta: 'Ejemplo: valores inválidos descartados', puntos: [1, NaN, 3, null, 4, 6], tono: 'salud' },
  { etiqueta: 'Ejemplo: un solo punto', puntos: [4], tono: 'primario' },
  { etiqueta: 'Ejemplo: vacía', puntos: [], tono: 'primario' },
];

// Entradas de una consulta ficticia. La tabla del laboratorio muestra qué estado deriva cada una.
export const CASOS_ESTADO_DEMO = [
  { descripcion: 'Consulta en curso', entrada: { cargando: true, datos: [] } },
  { descripcion: 'Reintento tras un fallo', entrada: { cargando: true, error: 'fallo anterior', datos: [] } },
  { descripcion: 'La consulta falló y no hay datos', entrada: { error: { message: 'permission denied' }, datos: [] } },
  { descripcion: 'Respondió bien, pero no hay registros', entrada: { datos: [] } },
  { descripcion: 'Respondió bien con registros', entrada: { datos: [1, 2, 3] } },
  { descripcion: 'Respondió con un resultado 0 (es un dato)', entrada: { datos: 0 } },
  { descripcion: 'Registros, pero faltan datos de otra fuente', entrada: { datos: [1, 2], parcial: true } },
];

// ---- Fase 1.5: contrato de indicador ----
// Entradas de `crearIndicador`. Los textos de fórmula y fuentes son de ejemplo, no las fórmulas reales
// de Life Pulse (esas se definen y aprueban en la Fase 3).
const FORMULA_EJEMPLO = 'Ejemplo de fórmula: cómo se calcularía este indicador, explicado en una frase.';
export const INDICADORES_DEMO = [
  { id: 'finanzas', nombre: 'Finanzas', valor: 76.4, muestra: 5, minimo: 3, formula: FORMULA_EJEMPLO, fuentes: ['ejemplo: gastos', 'ejemplo: presupuestos'], nota: 'Muestra suficiente: estado ok' },
  { id: 'salud', nombre: 'Salud', valor: 68, muestra: 6, minimo: 3, formula: FORMULA_EJEMPLO, fuentes: ['ejemplo: hábitos'], completo: false, nota: 'Faltan fuentes: estado parcial, conserva el valor' },
  { id: 'metas', nombre: 'Metas', valor: 80, muestra: 1, minimo: 3, formula: FORMULA_EJEMPLO, fuentes: ['ejemplo: metas'], nota: 'Hay un número pero la muestra no alcanza: sin datos, valor null' },
  { id: 'trabajo', nombre: 'Trabajo', valor: 90, muestra: 8, minimo: 3, formula: FORMULA_EJEMPLO, fuentes: ['ejemplo: pendientes'], error: true, nota: 'La lectura falló: error, nunca "sin datos"' },
  { id: 'personal', nombre: 'Personal', valor: 0, muestra: 4, minimo: 3, formula: FORMULA_EJEMPLO, fuentes: ['ejemplo: pendientes'], nota: 'Un cero real con muestra suficiente es 0 %, no "sin datos"' },
  { id: 'familia', nombre: 'Familia', valor: null, muestra: 0, minimo: 3, formula: FORMULA_EJEMPLO, fuentes: ['ejemplo: pendientes'], nota: 'Sin ningún dato: sin datos' },
];
