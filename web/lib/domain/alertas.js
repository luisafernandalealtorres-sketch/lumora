// Alertas, oportunidades, recomendaciones y próximas acciones de Home. Funciones PURAS.
//
// Son ALERTAS AUTOMÁTICAS POR REGLAS, no IA. Cada elemento muestra qué detectó, con qué datos (evidencia), por qué importa y qué
// acción sugiere. Solo se generan con datos reales; si una fuente no se pudo leer se informa, no se calla ni se rellena.
// Orden de las próximas acciones (aprobado): 1 vencidos, 2 vencen hoy, 3 objetivo de atención/Focus en riesgo,
// 4 recurrente o presupuesto, 5 Jornada de hoy sin escribir (desde las 7 p. m.); después oportunidades y recomendaciones.
import { diasEntre } from './fechas.js';

export const TIPOS_ALERTA = { alerta: 'Alerta', oportunidad: 'Oportunidad', recomendacion: 'Recomendación', accion: 'Acción' };
export const HORA_JORNADA = 19;
export const UMBRAL_PRESUPUESTO = 0.9;

const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;
const cop = n => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

/**
 * Entradas (todas opcionales; una regla sin su fuente no se ejecuta):
 *  hoy, hora (0–23, Bogotá), pendientes (filas), metas (salida de avanceMetas), gastos (salida de resumenGastos),
 *  recurrentes (salida de recurrentesProximos), jornada (salida de resumenJornada), mapa (salida de mapaFrentes),
 *  errores (arreglo de nombres de fuentes que fallaron al leerse).
 */
export function generarAlertas({ hoy, hora = 0, pendientes, metas, gastos, recurrentes, jornada, mapa, errores = [] }) {
  const items = [];
  const abiertos = Array.isArray(pendientes) ? pendientes.filter(p => !p.hecho) : null;

  if (abiertos) {
    const venc = abiertos.filter(p => p.fecha_limite && p.fecha_limite < hoy).sort((a, b) => a.fecha_limite.localeCompare(b.fecha_limite));
    if (venc.length) {
      items.push({
        id: 'vencidos', tipo: 'alerta', rango: 1, titulo: plural(venc.length, 'pendiente vencido', 'pendientes vencidos'),
        motivo: 'Pasó su fecha límite y siguen abiertos.', evidencia: [`El más antiguo: «${venc[0].texto}», vencía el ${venc[0].fecha_limite} (hace ${plural(diasEntre(venc[0].fecha_limite, hoy), 'día', 'días')}).`],
        accion: { texto: 'Revisar pendientes', ruta: '/' }, fuente: 'pendientes',
      });
    }
    const hoyL = abiertos.filter(p => p.fecha_limite === hoy);
    if (hoyL.length) {
      items.push({
        id: 'vencen-hoy', tipo: 'alerta', rango: 2, titulo: `${plural(hoyL.length, 'pendiente vence', 'pendientes vencen')} hoy`,
        motivo: 'Su fecha límite es hoy y siguen abiertos.', evidencia: hoyL.slice(0, 3).map(p => `«${p.texto}»`),
        accion: { texto: 'Completar hoy', ruta: '/' }, fuente: 'pendientes',
      });
    }
  }

  if (mapa) {
    for (const f of mapa.filas) {
      for (const r of f.requiereAtencion) {
        if (r.regla === 3 || r.regla === 4) {
          items.push({
            id: `atencion-${r.regla}-${f.id}`, tipo: 'alerta', rango: 3, titulo: `${f.nombre}: objetivo de atención en riesgo`, motivo: r.motivo,
            evidencia: f.atencion ? [`${f.atencion.puntos} de ${Number.isInteger(f.atencion.objetivo) ? f.atencion.objetivo : f.atencion.objetivo.toFixed(1)} puntos de atención hasta hoy.`] : [],
            accion: { texto: 'Iniciar Focus', ruta: '/focus' }, fuente: 'focus',
          });
        }
        if (r.regla === 2) {
          items.push({
            id: `sin-registros-${f.id}`, tipo: 'recomendacion', rango: 7, titulo: `${f.nombre}: sin registros recientes`, motivo: r.motivo,
            evidencia: [`${plural(f.pendientes.abiertos, 'pendiente abierto', 'pendientes abiertos')}; ningún pendiente completado, nota ni sesión en la última semana.`],
            accion: { texto: 'Ver pendientes', ruta: '/' }, fuente: 'pendientes',
          });
        }
      }
    }
  }

  if (gastos && gastos.usado !== null && gastos.usado > UMBRAL_PRESUPUESTO) {
    items.push({
      id: 'presupuesto', tipo: 'alerta', rango: 4, titulo: `Presupuesto del mes al ${Math.round(gastos.usado * 100)} %`,
      motivo: `Superó el ${Math.round(UMBRAL_PRESUPUESTO * 100)} % del presupuesto mensual.`, evidencia: [`Gastado ${cop(gastos.total)} de ${cop(gastos.presupuesto)}.`],
      accion: { texto: 'Ver Finanzas', ruta: '/finanzas' }, fuente: 'gastos',
    });
  }
  if (Array.isArray(recurrentes)) {
    const cerca = recurrentes.filter(r => r.dias <= 3);
    if (cerca.length) {
      const r = cerca[0];
      items.push({
        id: 'recurrente', tipo: 'alerta', rango: 4,
        titulo: r.dias < 0 ? `Pago vencido: ${r.nombre}` : r.dias === 0 ? `Pago de ${r.nombre} vence hoy` : `Pago de ${r.nombre} vence en ${plural(r.dias, 'día', 'días')}`,
        motivo: 'Pago recurrente vencido o a tres días o menos.', evidencia: [`${r.nombre}: ${cop(Number(r.valor_cop) || 0)}, día ${r.dia_mes} de cada mes${cerca.length > 1 ? ` (y ${cerca.length - 1} más)` : ''}.`],
        accion: { texto: 'Ver pagos', ruta: '/finanzas' }, fuente: 'recurrentes',
      });
    }
  }

  if (jornada) {
    if (!jornada.hoyEscrita && hora >= HORA_JORNADA) {
      items.push({
        id: 'jornada-hoy', tipo: 'accion', rango: 5, titulo: 'Escribe tu jornada de hoy', motivo: `Ya pasaron las ${HORA_JORNADA - 12}:00 p. m. y hoy no hay jornada.`,
        evidencia: [jornada.racha > 0 ? `Llevas ${plural(jornada.racha, 'día', 'días')} seguidos.` : 'Sin racha activa.'], accion: { texto: 'Abrir Jornada', ruta: '/jornada' }, fuente: 'jornadas',
      });
    }
    if (!jornada.hoyEscrita && !jornada.ayerEscrita && jornada.total > 0 && jornada.racha === 0 && jornada.rachaPrevia > 0) {
      items.push({
        id: 'racha-rota', tipo: 'alerta', rango: 6, titulo: 'Se rompió tu racha de Jornada', motivo: 'Ayer y hoy sin jornada.', evidencia: [`La racha anterior era de ${plural(jornada.rachaPrevia, 'día', 'días')}.`],
        accion: { texto: 'Abrir Jornada', ruta: '/jornada' }, fuente: 'jornadas',
      });
    }
  }

  if (metas && Array.isArray(metas.porMeta)) {
    for (const m of metas.porMeta.filter(x => x.total >= 2 && x.faltan === 1)) {
      items.push({
        id: `meta-${m.id}`, tipo: 'oportunidad', rango: 8, titulo: `A un paso de completar «${m.titulo}»`, motivo: 'Solo falta un hito o pendiente de la meta.',
        evidencia: [`${m.hechos} de ${m.total} completados.`], accion: { texto: 'Ver metas', ruta: '/metas' }, fuente: 'metas',
      });
    }
  }
  if (gastos && gastos.usado !== null && gastos.usado < 0.5 && hoy) {
    const diaMes = Number(hoy.slice(8)); const [y, m] = hoy.split('-').map(Number); const dias = new Date(Date.UTC(y, m, 0)).getUTCDate();
    if (diaMes / dias >= 0.7) {
      items.push({
        id: 'presupuesto-disponible', tipo: 'oportunidad', rango: 9, titulo: 'Tienes presupuesto disponible', motivo: 'El mes va avanzado y has usado menos de la mitad.',
        evidencia: [`Disponible ${cop(gastos.disponible)} (${Math.round(gastos.usado * 100)} % usado, día ${diaMes} de ${dias}).`], accion: { texto: 'Ver Finanzas', ruta: '/finanzas' }, fuente: 'gastos',
      });
    }
  }

  items.sort((a, b) => a.rango - b.rango);
  const sinLeer = [...new Set(errores)];
  const estado = items.length ? 'datos' : sinLeer.length ? 'error_lectura' : 'sin_registros';
  return { items, proximas: items.slice(0, 5), estado, fuentesConError: sinLeer };
}

/** Reglas que se vigilan (para mostrarlas cuando no hay nada que atender, en lugar de una superficie vacía). */
export const REGLAS_VIGILADAS = [
  { id: 'vencidos', texto: 'Pendientes vencidos' }, { id: 'hoy', texto: 'Vencen hoy' }, { id: 'presupuesto', texto: 'Presupuesto del mes' },
  { id: 'recurrentes', texto: 'Pagos recurrentes' }, { id: 'jornada', texto: 'Jornada del día' }, { id: 'metas', texto: 'Metas a un paso' }, { id: 'frentes', texto: 'Frentes sin registros' },
];
