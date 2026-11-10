// Frente activo del shell: vive en la URL como `?frente=<id>`. Puro.
// Ausente = todos. Un valor desconocido se ignora (nunca rompe la pantalla).
import { FRENTES_DISENO, frentePorId } from './frentesMap.js';

export const PARAMETRO = 'frente';

/**
 * Módulos cuyas pantallas YA aplican el filtro de frente.
 * Ningún módulo heredado lo lee todavía. Solo los de la Fase 3 que filtran de verdad: Atención (Balance por frente) y
 * Life Pulse (solo el indicador Balance; Execution y Wellbeing no tienen frente definido y no se filtran).
 * Un módulo se agrega aquí solo cuando de verdad filtra su contenido.
 */
export const MODULOS_CON_FILTRO = ['atencion', 'life-pulse'];

/** Id de frente válido (de los seis) o null. 'sin-asignar' no se puede elegir como filtro. */
export function frenteDeParametro(valor) {
  if (typeof valor !== 'string') return null;
  return FRENTES_DISENO.some(f => f.id === valor) ? valor : null;
}

/** Lee el frente de una cadena de consulta ('?frente=tanku' o 'frente=tanku'). */
export function frenteDeBusqueda(busqueda) {
  const p = new URLSearchParams(String(busqueda ?? '').replace(/^\?/, ''));
  return frenteDeParametro(p.get(PARAMETRO));
}

/** Cadena de consulta con el frente puesto o quitado, conservando los demás parámetros. */
export function busquedaConFrente(busqueda, id) {
  const p = new URLSearchParams(String(busqueda ?? '').replace(/^\?/, ''));
  const valido = frenteDeParametro(id);
  if (valido) p.set(PARAMETRO, valido); else p.delete(PARAMETRO);
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** Enlace a `ruta` conservando el frente activo. */
export function enlaceConFrente(ruta, frenteId) {
  const valido = frenteDeParametro(frenteId);
  return valido ? `${ruta}?${PARAMETRO}=${valido}` : ruta;
}

/** ¿La pantalla (id de elemento de navegación) aplica el filtro de frente? */
export function aplicaFiltro(idElemento) {
  return MODULOS_CON_FILTRO.includes(idElemento);
}

/** Nombre visible del frente activo, o null. */
export function nombreFrenteActivo(id) {
  const f = frenteDeParametro(id) ? frentePorId(id) : null;
  return f ? f.nombre : null;
}
