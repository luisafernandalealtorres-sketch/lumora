// Actividad reciente de Home (§3.6, P11). Lógica pura.
// Solo registros REALES de fuentes verificadas; nada se inventa. Fuentes: pendientes completados, notas, biblioteca y
// jornadas (las de la Fase 3 —sesiones de Focus y tiempo de hábitos— se suman cuando su migración esté aplicada).
// Se excluye finanzas. Cada registro aparece una sola vez, bajo su propio tipo.
import { fechaBogota } from './fechas.js';

export const TIPOS_ACTIVIDAD = {
  pendiente: { etiqueta: 'Pendiente completado', ruta: '/' },
  nota: { etiqueta: 'Nota', ruta: '/cerebro' },
  biblioteca: { etiqueta: 'Biblioteca', ruta: '/biblioteca' },
  jornada: { etiqueta: 'Jornada', ruta: '/jornada' },
};

const ms = iso => { const t = Date.parse(iso); return Number.isNaN(t) ? null : t; };

/**
 * Une las fuentes en una lista ordenada de la más reciente a la más antigua.
 * Cada fuente es un arreglo de filas ya leídas (o undefined si no se pudo leer: se omite sin inventar).
 * Una jornada solo tiene fecha: se ubica al mediodía de Bogotá de ese día.
 */
export function actividadReciente({ pendientes, notas, biblioteca, jornadas, limite = 8 }) {
  const out = [];
  for (const p of Array.isArray(pendientes) ? pendientes : []) {
    const t = p.hecho && p.hecho_en ? ms(p.hecho_en) : null;
    if (t !== null) out.push({ clave: `pendiente:${p.id}`, tipo: 'pendiente', titulo: p.texto, cuando: t, frente: p.frente ?? null });
  }
  for (const n of Array.isArray(notas) ? notas : []) {
    const t = ms(n.actualizado_en ?? n.creado_en);
    if (t !== null) out.push({ clave: `nota:${n.id}`, tipo: 'nota', titulo: n.titulo, cuando: t, frente: n.frente ?? null });
  }
  for (const b of Array.isArray(biblioteca) ? biblioteca : []) {
    const t = ms(b.guardado_en);
    if (t !== null) out.push({ clave: `biblioteca:${b.id}`, tipo: 'biblioteca', titulo: b.titulo, cuando: t, frente: null });
  }
  for (const j of Array.isArray(jornadas) ? jornadas : []) {
    const t = typeof j.fecha === 'string' ? ms(`${j.fecha}T12:00:00-05:00`) : null;
    if (t !== null) out.push({ clave: `jornada:${j.fecha}`, tipo: 'jornada', titulo: `Jornada del ${j.fecha}`, cuando: t, frente: null });
  }
  const vistos = new Set();
  return out.filter(x => (vistos.has(x.clave) ? false : vistos.add(x.clave))).sort((a, b) => b.cuando - a.cuando).slice(0, limite);
}

/** «hoy», «ayer» o la fecha, en America/Bogota. */
export function cuandoLegible(cuandoMs, ahoraMs) {
  const f = fechaBogota(new Date(cuandoMs));
  const hoy = fechaBogota(new Date(ahoraMs));
  const ayer = fechaBogota(new Date(ahoraMs - 864e5));
  return f === hoy ? 'hoy' : f === ayer ? 'ayer' : f;
}
