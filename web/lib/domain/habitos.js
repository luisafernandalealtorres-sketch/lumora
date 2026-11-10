// Dominio puro de hábitos nuevos (Fase 3, etapa 3 del SQL v1.11) y de Wellbeing (§5.4).
// Replica en JavaScript las reglas que la base aplica (public._hay_ocurrencia, versión vigente hacia delante),
// para poder mostrar ocurrencias y calcular el indicador a partir de filas ya leídas. La base sigue siendo la
// fuente de verdad de lo que se acredita (segmentos, historial). Sin red ni reloj propio.
// Distingue siempre: sin datos (null) ≠ cero real (ocurrencia elegible sin tiempo = 0).
import { diaDeSemana, sumarDias, diasEntre } from './fechas.js';

export const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** Versión de programación vigente en una fecha (la de `vigente_desde` más reciente que no la supere), o null. */
export function versionVigente(versiones, fecha) {
  const l = (Array.isArray(versiones) ? versiones : []).filter(v => v.vigente_desde <= fecha);
  if (!l.length) return null;
  return l.reduce((a, b) => (b.vigente_desde > a.vigente_desde ? b : a));
}

/** ¿Hay una ocurrencia programada de este hábito en la fecha? Igual que public._hay_ocurrencia (T-13). */
export function hayOcurrencia(habito, versiones, fecha) {
  if (!habito) return false;
  if (habito.archivado_desde && !(fecha < habito.archivado_desde)) return false;
  const v = versionVigente(versiones, fecha);
  if (!v) return false;
  return v.frecuencia === 'diaria' || (Array.isArray(v.dias_semana) && v.dias_semana.includes(diaDeSemana(fecha)));
}

/** Fechas con ocurrencia entre `desde` y `hasta` (inclusive), en orden. */
export function ocurrenciasEntre(habito, versiones, desde, hasta) {
  const n = diasEntre(desde, hasta);
  const out = [];
  for (let i = 0; i <= n; i++) {
    const f = sumarDias(desde, i);
    if (hayOcurrencia(habito, versiones, f)) out.push(f);
  }
  return out;
}

/** Tiempo vigente de una ocurrencia = manual + temporizador (la base deja uno de los dos en 0 al cambiar de fuente). null = sin registro. */
export function tiempoVigente(fila) {
  if (!fila || typeof fila !== 'object') return null;
  const m = Number.isFinite(fila.manual_s) ? fila.manual_s : 0;
  const t = Number.isFinite(fila.temporizador_s) ? fila.temporizador_s : 0;
  return m + t;
}

/** Texto de una programación: «Todos los días · 45 min» o «Lun, Mié, Vie · 45 min». */
export function textoProgramacion(version) {
  if (!version) return 'Sin programación vigente';
  const dur = version.objetivo_s % 60 === 0 ? `${version.objetivo_s / 60} min` : `${Math.round(version.objetivo_s / 6) / 10} min`;
  const dias = version.frecuencia === 'diaria' ? 'Todos los días' : [...(version.dias_semana ?? [])].sort((a, b) => a - b).map(d => DIAS_CORTOS[d]).join(', ');
  return `${dias} · ${dur}`;
}

/**
 * Estado de una ocurrencia en una fecha respecto de «hoy»:
 *   'futura' (aún no llega, no es elegible), 'en_curso' (es hoy), 'cerrada' (ya pasó).
 * El día actual es elegible y se marca «día en curso» (D3-3).
 */
export function estadoDeFecha(fecha, hoy) {
  return fecha > hoy ? 'futura' : fecha === hoy ? 'en_curso' : 'cerrada';
}

/**
 * Wellbeing de un período (§5.4): W = 100 × Σ min(realizado, objetivo) / Σ objetivo, sobre ocurrencias elegibles
 * (fecha <= hoy). Una ocurrencia elegible sin registro cuenta como 0 real. Sin ocurrencias elegibles → 'sin_datos'.
 * Entrada: habitos [{id, archivado_desde}], versiones (todas, con habito_id), tiempos (habito_tiempo con habito_id y fecha).
 * Devuelve { estado:'ok'|'sin_datos', valor, objetivoS, realizadoS, ocurrencias, enCurso, porHabito }.
 */
export function wellbeing({ habitos, versiones, tiempos, desde, hasta, hoy }) {
  const tope = hasta < hoy ? hasta : hoy;
  const porHabito = [];
  let obj = 0; let real = 0; let n = 0;
  if (tope >= desde) {
    for (const h of Array.isArray(habitos) ? habitos : []) {
      const vs = (Array.isArray(versiones) ? versiones : []).filter(v => v.habito_id === h.id);
      let o = 0; let r = 0; let c = 0;
      for (const f of ocurrenciasEntre(h, vs, desde, tope)) {
        const v = versionVigente(vs, f);
        const t = tiempoVigente((Array.isArray(tiempos) ? tiempos : []).find(x => x.habito_id === h.id && x.fecha === f)) ?? 0;
        o += v.objetivo_s; r += Math.min(t, v.objetivo_s); c += 1;
      }
      if (c) porHabito.push({ habitoId: h.id, ocurrencias: c, objetivoS: o, realizadoS: r, valor: (100 * r) / o });
      obj += o; real += r; n += c;
    }
  }
  const enCurso = hoy >= desde && hoy <= hasta;
  if (n === 0 || obj === 0) return { estado: 'sin_datos', valor: null, objetivoS: 0, realizadoS: 0, ocurrencias: 0, enCurso, porHabito };
  return { estado: 'ok', valor: (100 * real) / obj, objetivoS: obj, realizadoS: real, ocurrencias: n, enCurso, porHabito };
}
