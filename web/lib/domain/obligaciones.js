// Obligaciones y Execution (Fase 3, §5.2 y DISENO §9). Lógica pura: sin red ni reloj propio.
//
// Una OBLIGACIÓN es la evaluación de un compromiso (pendiente o hito) frente una fecha límite efectiva. Todas las
// obligaciones de un compromiso pertenecen al mismo compromiso (P6). Se reconstruyen desde el historial de cambios
// (`cambios_registro`, que escriben los disparadores del SQL v1.11), no desde el estado actual de la tabla.
//
// Reglas (DISENO §9.2 y §9.3):
//  - La fecha d «llega» al terminar el día d en America/Bogota: A(d) = 00:00 del día siguiente.
//  - Si la fecha se cambia (o el compromiso se elimina) ANTES de A(d), esa fecha no genera obligación (T-4).
//  - Resultado: cumplida (a tiempo si se completó antes de A(d), tardía si después), incumplida (llegó A(d) sin
//    completarse dentro de su intervalo) o abierta (A(d) aún no llega).
//  - Desmarcar reevalúa con el último estado de `hecho` dentro del intervalo (T-5); un intervalo ya cerrado por un
//    aplazamiento queda congelado con el estado que tenía al cerrarse.
//  - Un compromiso ya completado cuando se le asigna una fecha cuenta como cumplido desde ese instante.
//  - Peso 3/2/1 por la prioridad VIGENTE AL CIERRE del día de vencimiento (T-6), igual que public.prioridad_en_cierre.
//  - Un cumplimiento tardío se atribuye al período de la fecha d y conserva la fecha real de cumplimiento.
import { sumarDias } from './fechas.js';

export const PESO_PRIORIDAD = { alta: 3, media: 2, baja: 1 };
const PRIORIDADES = Object.keys(PESO_PRIORIDAD);

/** Corte A(d): 00:00 de America/Bogota del día siguiente a la fecha límite (ms). */
export const cierreDeFecha = fecha => Date.parse(`${sumarDias(fecha, 1)}T00:00:00-05:00`);

const ms = iso => Date.parse(iso);
const ordenar = eventos => [...eventos].sort((a, b) => (ms(a.cambiado_en) - ms(b.cambiado_en)) || (Number(a.seq ?? 0) - Number(b.seq ?? 0)));
const esFecha = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v);
const aBool = v => v === true || v === 'true' || v === 't';
const dia = v => (esFecha(v) ? v.slice(0, 10) : null);

/**
 * Prioridad vigente al cierre del día de vencimiento (T-6). Replica public.prioridad_en_cierre:
 *  1) último cambio de prioridad anterior al corte; 2) valor anterior del primer cambio posterior; 3) instantánea de
 *  creación; 4) instantánea de eliminación; 5) `prioridadActual` (respaldo); 6) 'media'.
 * Un cambio exactamente en el instante del corte cuenta como posterior.
 */
export function prioridadEnCierre(eventos, fechaLimite, prioridadActual = null) {
  const corte = cierreDeFecha(fechaLimite);
  const ev = ordenar(eventos);
  const cambios = ev.filter(e => e.evento === 'actualizado' && e.campo === 'prioridad');
  const antes = cambios.filter(e => ms(e.cambiado_en) < corte);
  if (antes.length && antes[antes.length - 1].valor_nuevo) return antes[antes.length - 1].valor_nuevo;
  const despues = cambios.filter(e => ms(e.cambiado_en) >= corte);
  if (despues.length && despues[0].valor_anterior) return despues[0].valor_anterior;
  const creado = ev.find(e => e.evento === 'creado');
  if (creado?.contexto?.prioridad) return creado.contexto.prioridad;
  const eliminado = [...ev].reverse().find(e => e.evento === 'eliminado');
  if (eliminado?.contexto?.prioridad) return eliminado.contexto.prioridad;
  return PRIORIDADES.includes(prioridadActual) ? prioridadActual : 'media';
}

/** Intervalos de fecha límite efectiva de un compromiso: [{ fecha, inicio, fin|null, hecho, completadoEn|null }]. */
export function intervalosDeFecha(tabla, eventos) {
  const campoFecha = tabla === 'pendientes' ? 'fecha_limite' : 'fecha';
  const ev = ordenar(eventos);
  const creado = ev.find(e => e.evento === 'creado');
  if (!creado) return null;                                          // sin instantánea de creación: no se puede reconstruir
  let hecho = aBool(creado.contexto?.hecho);
  let hechoEn = hecho ? ms(creado.cambiado_en) : null;
  let actual = { fecha: dia(creado.contexto?.[campoFecha]), inicio: ms(creado.cambiado_en), fin: null, hecho, completadoEn: hechoEn };
  const intervalos = [];
  const cerrar = t => { actual.fin = t; actual.hecho = hecho; actual.completadoEn = hecho ? hechoEn : null; intervalos.push(actual); };
  for (const e of ev) {
    if (e === creado) continue;
    const t = ms(e.cambiado_en);
    if (e.evento === 'eliminado') { cerrar(t); return intervalos.filter(i => i.fecha); }
    if (e.evento !== 'actualizado') continue;
    if (e.campo === campoFecha) {
      cerrar(t);
      actual = { fecha: dia(e.valor_nuevo), inicio: t, fin: null, hecho, completadoEn: hecho ? t : null };   // ya completado: cuenta desde este instante
      if (hecho) hechoEn = t;
    } else if (e.campo === 'hecho') {
      hecho = aBool(e.valor_nuevo);
      hechoEn = hecho ? t : null;
    }
  }
  actual.hecho = hecho; actual.completadoEn = hecho ? hechoEn : null;
  intervalos.push(actual);
  return intervalos.filter(i => i.fecha);
}

/**
 * Obligaciones de un compromiso. `ahora` en ms. Las fechas que se cambiaron o eliminaron antes de llegar no generan
 * obligación. Devuelve [] si no hay historial reconstruible (se informa aparte con `reconstruible`).
 */
export function obligacionesDe({ tabla, registroId, eventos, ahora, prioridadActual = null }) {
  const intervalos = intervalosDeFecha(tabla, eventos);
  if (!intervalos) return { reconstruible: false, obligaciones: [] };
  const obligaciones = [];
  intervalos.forEach((iv, indice) => {
    const A = cierreDeFecha(iv.fecha);
    if (iv.fin !== null && iv.fin < A) return;                          // cambio o eliminación antes de llegar: se descarta
    let resultado;
    if (iv.hecho) resultado = iv.completadoEn < A ? 'cumplida_a_tiempo' : 'cumplida_tardia';
    else if (iv.fin !== null || ahora >= A) resultado = 'incumplida';
    else resultado = 'abierta';
    const prioridad = prioridadEnCierre(eventos, iv.fecha, prioridadActual);
    obligaciones.push({
      tabla, registroId, indice, fecha: iv.fecha, cierreMs: A, resultado,
      completadoEn: iv.hecho ? iv.completadoEn : null, prioridad, peso: PESO_PRIORIDAD[prioridad] ?? 2,
    });
  });
  return { reconstruible: true, obligaciones };
}

/** Agrupa filas de cambios_registro por (tabla, registro). */
export function agruparEventos(filas) {
  const m = new Map();
  for (const f of Array.isArray(filas) ? filas : []) {
    const k = `${f.tabla}|${f.registro_id}`;
    if (!m.has(k)) m.set(k, { tabla: f.tabla, registroId: f.registro_id, eventos: [] });
    m.get(k).eventos.push(f);
  }
  return [...m.values()];
}

/** Todas las obligaciones de todos los compromisos. `actuales` = {pendientes: Map(id→prioridad), hitos: Map} para el respaldo. */
export function todasLasObligaciones({ filas, ahora, actuales = {} }) {
  const out = []; let sinHistorial = 0;
  for (const g of agruparEventos(filas)) {
    const r = obligacionesDe({ ...g, ahora, prioridadActual: actuales[g.tabla]?.get?.(g.registroId) ?? null });
    if (!r.reconstruible) { sinHistorial += 1; continue; }
    out.push(...r.obligaciones);
  }
  return { obligaciones: out, sinHistorial };
}

/**
 * Componente de Execution (T para compromisos, M para hitos) en [desde, hasta]:
 *   cumplimiento = peso completado / peso programado × 100.
 * Elegible: la fecha d ya llegó (d <= hoy). Regla D3-25 (vencimiento de hoy; APROBADA), coherente con D3-3 y D3-19a:
 *  - Las obligaciones que vencen HOY entran al denominador desde el inicio del día.
 *  - Las ya cumplidas cuentan como completadas; las que siguen abiertas cuentan como incumplidas PROVISIONALMENTE
 *    (se cuentan en `provisionales`) y se consolidan al cierre del día (00:00 de Bogotá), con la prioridad vigente al
 *    cierre del vencimiento (T-6). Si se cumplen después, quedan como cumplimiento tardío en el período de su fecha.
 *  - Las fechas futuras no cuentan, ni siquiera si ya se cumplieron.
 * Sin peso programado → null (sin información).
 */
export function componenteExecution({ obligaciones, tabla, desde, hasta, hoy }) {
  let programado = 0; let completado = 0; let n = 0; let provisionales = 0; let pesoProvisional = 0;
  for (const o of obligaciones) {
    if (o.tabla !== tabla || o.fecha < desde || o.fecha > hasta || o.fecha > hoy) continue;
    programado += o.peso; n += 1;
    if (o.resultado === 'cumplida_a_tiempo' || o.resultado === 'cumplida_tardia') completado += o.peso;
    else if (o.resultado === 'abierta') { provisionales += 1; pesoProvisional += o.peso; }
  }
  return { valor: programado > 0 ? (100 * completado) / programado : null, pesoProgramado: programado, pesoCompletado: completado, obligaciones: n, provisionales, pesoProvisional };
}

/**
 * Execution: E = 0,6·T + 0,4·M.
 * Ambos con información → fórmula completa; solo uno → ese componente y estado 'parcial'; ninguno → 'sin_datos'.
 * Cada período se recalcula desde las obligaciones originales (no se promedian períodos menores).
 */
export function execution({ obligaciones, desde, hasta, hoy }) {
  const T = componenteExecution({ obligaciones, tabla: 'pendientes', desde, hasta, hoy });
  const M = componenteExecution({ obligaciones, tabla: 'hitos', desde, hasta, hoy });
  const enCurso = hoy >= desde && hoy <= hasta;
  const provisional = T.provisionales + M.provisionales > 0;   // incluye obligaciones de hoy aún abiertas (D3-25)
  if (T.valor !== null && M.valor !== null) return { estado: 'ok', valor: 0.6 * T.valor + 0.4 * M.valor, T, M, enCurso, provisional, parcialDe: null };
  if (T.valor !== null) return { estado: 'parcial', valor: T.valor, T, M, enCurso, provisional, parcialDe: 'pendientes' };
  if (M.valor !== null) return { estado: 'parcial', valor: M.valor, T, M, enCurso, provisional, parcialDe: 'hitos' };
  return { estado: 'sin_datos', valor: null, T, M, enCurso, provisional: false, parcialDe: null };
}
