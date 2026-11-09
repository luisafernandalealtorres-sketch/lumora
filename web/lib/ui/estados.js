// Estados de datos de un widget: cargando, vacío, error, parcial y ok. Puro, con pruebas en tests/estados.test.mjs.
//
// Regla central: un ERROR nunca se muestra como VACÍO. Si una consulta falla, el usuario debe ver
// un error (con reintento), no una pantalla "sin datos" que parezca que no tiene nada guardado.

export const ESTADOS = ['cargando', 'vacio', 'error', 'parcial', 'ok'];
export const esEstado = e => ESTADOS.includes(e);

/** Vacío = no hay nada que mostrar. El número 0 y el valor false son datos, no vacío. */
export function esVacio(datos) {
  if (datos === null || datos === undefined || datos === '') return true;
  if (Array.isArray(datos)) return datos.length === 0;
  if (typeof datos === 'object') return Object.keys(datos).length === 0;
  return false;
}

/**
 * Deriva el estado de lo que devuelve una consulta.
 * Orden: cargando (también al reintentar), error, vacío, parcial, ok.
 * Un error con `datos` vacío es 'error', nunca 'vacio'.
 */
export function estadoDeConsulta({ cargando = false, error = null, datos, parcial = false } = {}) {
  if (cargando) return 'cargando';
  if (error) return 'error';
  if (esVacio(datos)) return 'vacio';
  return parcial ? 'parcial' : 'ok';
}

/** Un estado desconocido falla de forma visible (error), nunca como vacío. */
export function resolverEstado(estado) {
  return esEstado(estado) ? estado : 'error';
}
