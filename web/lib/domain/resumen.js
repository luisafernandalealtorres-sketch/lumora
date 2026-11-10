// Resumen ejecutivo de Home: funciones PURAS con las fórmulas del dashboard existente (Panel, Metas, Finanzas, Salud).
// Diferencia con las pantallas heredadas: aquí un valor que no se puede calcular es `null` con estado «sin_datos»,
// nunca 0. No modifica ni reemplaza esas pantallas (siguen con su lógica).
import { sumarDias, diasEntre, inicioSemana } from './fechas.js';

const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
const dia = iso => (typeof iso === 'string' ? iso.slice(0, 10) : null);
const lista = x => (Array.isArray(x) ? x : []);
const ESTADO = lista0 => (lista0.length ? 'datos' : 'sin_registros');

// ---------------------------------------------------------------- Pendientes
/**
 * Pendientes abiertos y completados, vencidos, que vencen hoy, completados en 7 días y hoy, y avance (completados / total).
 * `hoy` AAAA-MM-DD de Bogotá. El avance es null (sin datos) si no hay pendientes.
 */
export function resumenPendientes({ pendientes, hoy }) {
  const p = lista(pendientes);
  const abiertos = p.filter(x => !x.hecho);
  const completados = p.filter(x => x.hecho);
  const desde7 = sumarDias(hoy, -6);
  const comp7 = completados.filter(x => dia(x.hecho_en) && dia(x.hecho_en) >= desde7 && dia(x.hecho_en) <= hoy);
  const compHoy = completados.filter(x => dia(x.hecho_en) === hoy);
  const vencidos = abiertos.filter(x => x.fecha_limite && x.fecha_limite < hoy);
  const vencenHoy = abiertos.filter(x => x.fecha_limite === hoy);
  return {
    estado: ESTADO(p), total: p.length, abiertos: abiertos.length, completados: completados.length,
    completados7: comp7.length, completadosHoy: compHoy.length, vencidos: vencidos.length, vencenHoy: vencenHoy.length,
    avance: p.length ? completados.length / p.length : null,
  };
}

/**
 * Prioridades de hoy (definición de la auditoría 8.2): vencidos (el más antiguo primero), que vencen hoy y, para completar
 * `limite`, los abiertos más antiguos. Cada una con su motivo. Las columnas de prioridad llegan con la migración (Fase 3).
 */
export function prioridadesHoy({ pendientes, hoy, limite = 5 }) {
  const abiertos = lista(pendientes).filter(x => !x.hecho);
  const porAntiguedad = (a, b) => String(a.creado_en ?? '').localeCompare(String(b.creado_en ?? ''));
  const venc = abiertos.filter(x => x.fecha_limite && x.fecha_limite < hoy).sort((a, b) => a.fecha_limite.localeCompare(b.fecha_limite));
  const hoyL = abiertos.filter(x => x.fecha_limite === hoy).sort(porAntiguedad);
  const resto = abiertos.filter(x => !x.fecha_limite || x.fecha_limite > hoy).sort(porAntiguedad);
  const out = [
    ...venc.map(x => ({ ...x, motivo: `Vencido hace ${diasEntre(x.fecha_limite, hoy)} ${diasEntre(x.fecha_limite, hoy) === 1 ? 'día' : 'días'}`, urgencia: 'vencido' })),
    ...hoyL.map(x => ({ ...x, motivo: 'Vence hoy', urgencia: 'hoy' })),
    ...resto.map(x => ({ ...x, motivo: x.fecha_limite ? `Vence el ${x.fecha_limite}` : 'Abierto, sin fecha', urgencia: 'abierto' })),
  ];
  return { items: out.slice(0, limite), totalAbiertos: abiertos.length, ocultos: Math.max(0, out.length - limite) };
}

// ---------------------------------------------------------------- Metas (avance de objetivos)
/** Avance por meta activa = (hitos hechos + pendientes hechos) / (hitos + pendientes vinculados), como en Metas. Sin elementos → null. */
export function avanceMetas({ metas, hitos, pendientes }) {
  const activas = lista(metas).filter(m => m.estado === 'activa');
  const porMeta = activas.map(m => {
    const hs = lista(hitos).filter(h => h.meta_id === m.id);
    const ts = lista(pendientes).filter(t => t.meta_id === m.id);
    const total = hs.length + ts.length;
    const hechos = hs.filter(h => h.hecho).length + ts.filter(t => t.hecho).length;
    return { id: m.id, titulo: m.titulo, frente: m.frente, total, hechos, faltan: total - hechos, avance: total ? hechos / total : null };
  });
  const conTotal = porMeta.filter(m => m.total > 0);
  const total = conTotal.reduce((s, m) => s + m.total, 0);
  const hechos = conTotal.reduce((s, m) => s + m.hechos, 0);
  return {
    estado: activas.length === 0 ? 'sin_registros' : conTotal.length === 0 ? 'sin_datos' : 'datos',
    activas: activas.length, porMeta, avance: total ? hechos / total : null, hechos, total,
  };
}

// ---------------------------------------------------------------- Finanzas
/** Gasto del mes, por categoría, negocio y personal, presupuesto usado y disponible (null sin presupuesto). */
export function resumenGastos({ gastos, presupuestos, mes, esNegocio }) {
  const g = lista(gastos).filter(x => typeof x.fecha === 'string' && x.fecha.slice(0, 7) === mes);
  const total = g.reduce((s, x) => s + num(x.valor_cop), 0);
  const negocio = g.filter(x => esNegocio(x.frente)).reduce((s, x) => s + num(x.valor_cop), 0);
  const presupuesto = lista(presupuestos).reduce((s, p) => s + num(p.monto_cop), 0);
  const tienePres = lista(presupuestos).length > 0 && presupuesto > 0;
  return {
    estado: g.length ? 'datos' : 'sin_registros', cantidad: g.length, total, negocio, personal: total - negocio,
    presupuesto: tienePres ? presupuesto : null,
    usado: tienePres ? total / presupuesto : null,                      // sin presupuesto → null (sin datos), no 0
    disponible: tienePres ? presupuesto - total : null,
  };
}

// ---------------------------------------------------------------- Jornada
/** Racha de Jornada (terminando hoy o ayer) y días con jornada en la semana. */
export function resumenJornada({ fechas, hoy }) {
  const set = new Set(lista(fechas).map(f => dia(f.fecha ?? f)).filter(Boolean));
  let d = set.has(hoy) ? hoy : sumarDias(hoy, -1);
  let racha = 0;
  while (set.has(d)) { racha += 1; d = sumarDias(d, -1); }
  const lunes = inicioSemana(hoy);
  const semana = [...set].filter(f => f >= lunes && f <= hoy).length;
  // Racha que había antes de romperse (terminando anteayer) para detectar «racha rota»
  let previa = 0; let p = sumarDias(hoy, -2);
  if (!set.has(hoy) && !set.has(sumarDias(hoy, -1))) { while (set.has(p)) { previa += 1; p = sumarDias(p, -1); } }
  return { estado: set.size ? 'datos' : 'sin_registros', racha, rachaPrevia: previa, diasSemana: semana, hoyEscrita: set.has(hoy), ayerEscrita: set.has(sumarDias(hoy, -1)), total: set.size };
}

// ---------------------------------------------------------------- Hábitos de Salud (heredados)
/** Cumplimiento de hoy y mejor racha de los hábitos activos de Salud heredado (`habitos` + `habito_registros`). */
export function resumenHabitosSalud({ habitos, registros, hoy }) {
  const activos = lista(habitos).filter(h => h.activo !== false);
  const mapa = new Map(lista(registros).map(r => [`${r.habito_id}|${dia(r.fecha)}`, num(r.valor)]));
  const cumplido = (h, f) => (mapa.get(`${h.id}|${f}`) ?? 0) >= num(h.objetivo_dia || 1);
  const rachaDe = h => { let d = cumplido(h, hoy) ? hoy : sumarDias(hoy, -1); let n = 0; while (cumplido(h, d)) { n += 1; d = sumarDias(d, -1); } return n; };
  const hechosHoy = activos.filter(h => cumplido(h, hoy)).length;
  return {
    estado: activos.length ? 'datos' : 'sin_registros', total: activos.length, hechosHoy,
    mejorRacha: activos.reduce((m, h) => Math.max(m, rachaDe(h)), 0),
  };
}

// ---------------------------------------------------------------- Recurrentes
const ultimoDiaMes = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
/** Próximo vencimiento de un pago recurrente (igual que Finanzas): según el día del mes y el último pago. */
export function proximoVencimiento(r, hoy) {
  const [y, m] = hoy.split('-').map(Number);
  const pagadoEsteMes = r.ultimo_pago && String(r.ultimo_pago).slice(0, 7) === hoy.slice(0, 7);
  let yy = y; let mm = m;
  if (pagadoEsteMes) { mm += 1; if (mm > 12) { mm = 1; yy += 1; } }
  const d = Math.min(num(r.dia_mes), ultimoDiaMes(yy, mm));
  return `${yy}-${String(mm).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Recurrentes activos con su vencimiento y los días que faltan (negativo = vencido), del más próximo al más lejano. */
export function recurrentesProximos({ recurrentes, hoy }) {
  return lista(recurrentes).filter(r => r.activo !== false && num(r.dia_mes) > 0)
    .map(r => { const vence = proximoVencimiento(r, hoy); return { ...r, vence, dias: diasEntre(hoy, vence) }; })
    .sort((a, b) => a.dias - b.dias);
}
