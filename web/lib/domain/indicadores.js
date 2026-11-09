// Contrato de indicador (base de Life Pulse). Lógica pura, con pruebas en tests/indicadores.test.mjs.
//
// Este módulo define SOLO el contrato y sus garantías. Las fórmulas de cada área se definen y aprueban
// en la Fase 3; aquí no hay ninguna.
//
// Reglas duras:
//  - Si el estado no es 'ok' ni 'parcial', `valor` es null. Nunca se inventa un número.
//  - Con `muestra` menor que `minimo` no hay datos suficientes: estado 'sin-datos'.
//  - Cada indicador explica cómo se calculó (`formula`) y de dónde salen los datos (`fuentes`).
//  - NO existe un indicador global de equilibrio personal. Está pendiente de una metodología aprobada
//    (decisión D7). No se agrega ninguna función que mezcle áreas en un promedio.

/** Áreas de Life Pulse según la especificación. */
export const AREAS_LIFE_PULSE = [
  { id: 'trabajo', nombre: 'Trabajo' },
  { id: 'finanzas', nombre: 'Finanzas' },
  { id: 'salud', nombre: 'Salud' },
  { id: 'metas', nombre: 'Metas' },
  { id: 'personal', nombre: 'Personal' },
  { id: 'familia', nombre: 'Familia' },
];

export const ESTADOS_INDICADOR = ['ok', 'parcial', 'sin-datos', 'error'];

const textoNoVacio = t => typeof t === 'string' && t.trim().length > 0;
const esNumero = n => typeof n === 'number' && Number.isFinite(n);

/**
 * Construye un indicador válido.
 * @param {object} p
 * @param {string} p.id          Id del área (ver AREAS_LIFE_PULSE).
 * @param {string} p.nombre
 * @param {number|null} p.valor  Valor calculado de 0 a 100. Se ignora si faltan datos.
 * @param {number} p.muestra     Cuántos datos reales respaldan el valor.
 * @param {number} p.minimo      Cuántos datos hacen falta para que el valor sea confiable.
 * @param {string} p.formula     Explicación legible del cálculo.
 * @param {string[]} p.fuentes   Qué datos se usaron (por ejemplo "pendientes").
 * @param {boolean} [p.completo=true]  false si faltan fuentes: el valor se marca 'parcial'.
 * @param {boolean} [p.error=false]    true si la lectura de datos falló.
 */
export function crearIndicador({ id, nombre, valor, muestra, minimo, formula, fuentes, completo = true, error = false }) {
  let estado;
  if (error) estado = 'error';
  else if (!esNumero(valor) || !esNumero(muestra) || !esNumero(minimo) || muestra < minimo) estado = 'sin-datos';
  else estado = completo ? 'ok' : 'parcial';

  const conValor = estado === 'ok' || estado === 'parcial';
  return {
    id,
    nombre,
    valor: conValor ? Math.min(100, Math.max(0, Math.round(valor))) : null,
    estado,
    muestra: esNumero(muestra) && muestra >= 0 ? muestra : 0,
    minimo: esNumero(minimo) && minimo >= 0 ? minimo : 0,
    formula,
    fuentes: Array.isArray(fuentes) ? [...fuentes] : [],
  };
}

/** Lista los problemas de un indicador. Vacía si es válido. */
export function validarIndicador(ind) {
  const problemas = [];
  if (!ind || typeof ind !== 'object') return ['no es un objeto'];
  if (!AREAS_LIFE_PULSE.some(a => a.id === ind.id)) problemas.push(`id desconocido: ${ind.id}`);
  if (!textoNoVacio(ind.nombre)) problemas.push('falta el nombre');
  if (!ESTADOS_INDICADOR.includes(ind.estado)) problemas.push(`estado inválido: ${ind.estado}`);
  const conValor = ind.estado === 'ok' || ind.estado === 'parcial';
  if (conValor && !(esNumero(ind.valor) && ind.valor >= 0 && ind.valor <= 100)) problemas.push('un indicador con valor debe estar entre 0 y 100');
  if (!conValor && ind.valor !== null) problemas.push('sin datos o con error, el valor debe ser null');
  if (!esNumero(ind.muestra) || ind.muestra < 0) problemas.push('muestra inválida');
  if (!esNumero(ind.minimo) || ind.minimo < 0) problemas.push('mínimo inválido');
  if (ind.estado === 'ok' && ind.muestra < ind.minimo) problemas.push('un indicador ok no puede tener menos muestra que el mínimo');
  if (!textoNoVacio(ind.formula)) problemas.push('falta la fórmula: el cálculo debe ser transparente');
  if (!Array.isArray(ind.fuentes) || ind.fuentes.length === 0 || !ind.fuentes.every(textoNoVacio)) problemas.push('faltan las fuentes de datos');
  return problemas;
}

/** Valor del indicador como fracción de 0 a 1 (para Ring y ProgressBar), o null si no hay valor. */
export function aFraccion(ind) {
  return ind && (ind.estado === 'ok' || ind.estado === 'parcial') && esNumero(ind.valor) ? ind.valor / 100 : null;
}
