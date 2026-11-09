// Tonos de color de los componentes (chips, barras). Pura, con pruebas en tests/tonos.test.mjs.
//
// - Los tonos de estado salen de los tokens de estado.
// - Los tonos de frente salen de los seis frentes de diseño. Los colores de frente son una
//   PROPUESTA pendiente de aprobación; cambiar un color es editar tokens.css, no este archivo.
import { FRENTES_DISENO, frenteDeSlug, frentePorId } from '../domain/frentesMap.js';

export const TONOS_ESTADO = ['neutro', 'primario', 'exito', 'advertencia', 'peligro'];
export const TONOS_FRENTE = FRENTES_DISENO.map(f => f.id);
export const TONOS = [...TONOS_ESTADO, ...TONOS_FRENTE];

export const esTono = t => TONOS.includes(t);

/**
 * Resuelve el tono a usar.
 * - `tono` explícito y válido: gana.
 * - `frente`: acepta un slug original ("salud-abuela") o un id de diseño ("familia").
 * - Un frente "Sin asignar" o desconocido usa el tono neutro: no se le inventa un color.
 */
export function resolverTono({ tono, frente } = {}) {
  if (tono !== undefined && tono !== null) return esTono(tono) ? tono : 'neutro';
  if (frente) {
    const f = frentePorId(frente) ?? frenteDeSlug(frente);
    return esTono(f.id) ? f.id : 'neutro';
  }
  return 'neutro';
}

/** Nombre visible del frente de diseño al que pertenece un slug o un id. Vacío si no hay frente. */
export function nombreDeFrente(frente) {
  if (!frente) return '';
  return (frentePorId(frente) ?? frenteDeSlug(frente)).nombre;
}
