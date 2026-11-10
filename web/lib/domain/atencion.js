// Dominio puro de objetivos de atención y Balance (§5.3, D3-19a/b, T-7).
// Solo cuentan los puntos de sesiones Focus «completada» (1 punto por sesión). Los hábitos no suman puntos.
// Sin red ni reloj propio. «Sin objetivo» y «sin datos» nunca se muestran como 0 %.
import { fechaBogota, inicioSemana, sumarDias, diasEntre } from './fechas.js';
import { FRENTES_DISENO } from './frentesMap.js';

export const FRENTES_ATENCION = FRENTES_DISENO.map(f => ({ id: f.id, nombre: f.nombre }));
export const IDS_FRENTES = FRENTES_ATENCION.map(f => f.id);

/** Lunes de la semana de una fecha de Bogotá. Igual que public.lunes_semana_bogota (verificado en pruebas). */
export const lunesDe = inicioSemana;

/** ¿La semana (identificada por su lunes) ya terminó? Los objetivos de semanas cerradas son inmutables (T-7). */
export function semanaCerrada(lunes, hoy) {
  return lunes < inicioSemana(hoy);
}

/** Puntos de atención por frente en [desde, hasta] (fechas de Bogotá): solo sesiones completadas. Sin sesiones → todos en 0 reales. */
export function puntosPorFrente(sesiones, desde, hasta) {
  const out = Object.fromEntries(IDS_FRENTES.map(id => [id, 0]));
  for (const s of Array.isArray(sesiones) ? sesiones : []) {
    if (s.estado !== 'completada' || !s.finalizado_en || !(s.frente_id in out)) continue;
    const f = fechaBogota(new Date(s.finalizado_en));
    if (f >= desde && f <= hasta) out[s.frente_id] += s.puntos ?? 1;
  }
  return out;
}

/** Objetivos por semana → mapa { lunes: { frente: puntos } }. */
export function objetivosPorSemana(filas) {
  const m = {};
  for (const o of Array.isArray(filas) ? filas : []) {
    (m[o.semana_inicio] ??= {})[o.frente_id] = o.puntos;
  }
  return m;
}

/**
 * Balance de un período (§5.3).  B = 100 × Σ[gᵢ·min(1, aᵢ/gᵢ)] / Σ gᵢ
 *  - gᵢ: objetivo del frente PRORRATEADO por los días elegibles del período (cada día aporta objetivo semanal/7 de la
 *    semana a la que pertenece). Los días futuros no se contabilizan; el día en curso sí (zona America/Bogota).
 *  - Una semana sin objetivos no aporta días (no hereda objetivos de otras semanas, D3-19b).
 *  - Frentes con objetivo prorrateado 0 quedan excluidos. El exceso de un frente no compensa déficits de otros.
 *  - Sin objetivos en el período → estado 'sin_objetivo' y se devuelven los puntos registrados por separado.
 * Devuelve { estado:'ok'|'sin_objetivo'|'no_iniciado', valor, enCurso, diasElegibles, diasConObjetivo, frentes, puntosTotales }.
 */
export function balancePeriodo({ desde, hasta, hoy, objetivos, sesiones, frenteId = null }) {
  const ids = frenteId && IDS_FRENTES.includes(frenteId) ? [frenteId] : IDS_FRENTES;   // filtro de frente de la URL (?frente=): solo ese frente
  const tope = hasta < hoy ? hasta : hoy;
  const enCurso = hoy >= desde && hoy <= hasta;
  const puntos = puntosPorFrente(sesiones, desde, tope >= desde ? tope : desde);
  const puntosTotales = tope >= desde ? ids.reduce((a, id) => a + puntos[id], 0) : 0;
  const g = Object.fromEntries(IDS_FRENTES.map(id => [id, 0]));
  let diasElegibles = 0; let diasConObjetivo = 0;
  if (tope >= desde) {
    diasElegibles = diasEntre(desde, tope) + 1;
    for (let i = 0; i < diasElegibles; i++) {
      const o = objetivos[inicioSemana(sumarDias(desde, i))];
      if (!o || !ids.some(id => (o[id] ?? 0) > 0)) continue;
      diasConObjetivo += 1;
      for (const id of ids) g[id] += o[id] ?? 0;   // en séptimos: se divide una sola vez al final (sin ruido de coma flotante)
    }
  }
  const frentes = FRENTES_ATENCION.filter(f => ids.includes(f.id)).map(f => {
    const a = tope >= desde ? puntos[f.id] : null;
    const gi = g[f.id] / 7;
    return { id: f.id, nombre: f.nombre, objetivo: gi, puntos: a, cumplimiento: gi > 0 && a !== null ? Math.min(1, a / gi) : null };
  });
  if (tope < desde) return { estado: 'no_iniciado', valor: null, enCurso, diasElegibles: 0, diasConObjetivo: 0, frentes, puntosTotales: 0 };
  const sumG = frentes.reduce((s, f) => s + f.objetivo, 0);
  if (sumG <= 0) return { estado: 'sin_objetivo', valor: null, enCurso, diasElegibles, diasConObjetivo, frentes, puntosTotales };
  const valor = (100 * frentes.reduce((s, f) => s + (f.objetivo > 0 ? f.objetivo * Math.min(1, f.puntos / f.objetivo) : 0), 0)) / sumG;
  return { estado: 'ok', valor, enCurso, diasElegibles, diasConObjetivo, frentes, puntosTotales };
}

/** Balance de la semana de `lunes` (lunes a domingo). */
export function balanceSemana({ lunes, hoy, objetivos, sesiones, frenteId = null }) {
  return balancePeriodo({ desde: lunes, hasta: sumarDias(lunes, 6), hoy, objetivos, sesiones, frenteId });
}
