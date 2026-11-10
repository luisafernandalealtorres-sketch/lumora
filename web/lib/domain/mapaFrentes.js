// Mapa de los seis frentes (Home, aprobado el 10 nov 2026). Funciones PURAS.
//
// «Actividad» = CONTEO de registros reales de la semana (pendientes completados + notas + sesiones de Focus completadas).
// NO hay ponderaciones ni puntajes compuestos: se muestran las cifras tal cual, con su proporción. Los frentes se agrupan
// con `frentesMap` (seis frentes de diseño ← slugs originales); lo que no encaja aparece como «Sin asignar», no desaparece.
import { FRENTES_DISENO, SIN_ASIGNAR, frenteDeSlug } from './frentesMap.js';
import { sumarDias, inicioSemana, diasEntre } from './fechas.js';

/** Umbrales iniciales de las cuatro reglas de «requiere atención» (aprobados como ajustables). */
export const UMBRALES = {
  diasSinRegistros: 7,            // R2: ventana de días sin ningún registro
  atencionMinima: 0.5,            // R3: cumplimiento por debajo de esta fracción del objetivo prorrateado…
  semanaTranscurrida: 0.6,        // …cuando ya pasó esta fracción de la semana
  diasSinFocus: 3,                // R4: días sin sesión de Focus completada con objetivo semanal
};

const lista = x => (Array.isArray(x) ? x : []);
const dia = iso => (typeof iso === 'string' ? iso.slice(0, 10) : null);
const idDe = slug => frenteDeSlug(slug).id;

/**
 * Filas del mapa. Entradas (todas opcionales; las que no se pasan no se inventan):
 *  - pendientes, notas, metas, hitos, gastos: filas de las tablas heredadas (con `frente` = slug original)
 *  - sesiones: sesiones Focus completadas {frente_id, finalizado_en} (Fase 3) o `undefined` si la Fase 3 no está activa
 *  - balance: resultado de `balancePeriodo` de la semana (frentes con objetivo y cumplimiento) o `undefined`
 *  - hoy: AAAA-MM-DD de Bogotá;  esNegocio: función de lib/format
 * Devuelve { semana:{desde,hasta}, filas:[…], concentracion:{estado,total,partes}, hayAtencion }.
 */
export function mapaFrentes({ pendientes, notas, metas, hitos, gastos, sesiones, balance, hoy, esNegocio = () => false }) {
  const lunes = inicioSemana(hoy);
  const desde7 = sumarDias(hoy, -(UMBRALES.diasSinRegistros - 1));
  const hayFocus = Array.isArray(sesiones);
  const hayBalance = !!balance && Array.isArray(balance.frentes);
  const ids = [...FRENTES_DISENO.map(f => f.id)];
  const asignados = id => (r, campo = 'frente') => idDe(r[campo]) === id;

  const hayNoAsignados = [...lista(pendientes), ...lista(notas), ...lista(metas), ...lista(gastos)].some(r => idDe(r.frente) === SIN_ASIGNAR.id);
  if (hayNoAsignados) ids.push(SIN_ASIGNAR.id);

  const filas = ids.map(id => {
    const nombre = id === SIN_ASIGNAR.id ? SIN_ASIGNAR.nombre : FRENTES_DISENO.find(f => f.id === id).nombre;
    const de = asignados(id);
    const pend = lista(pendientes).filter(r => de(r));
    const abiertos = pend.filter(r => !r.hecho);
    const completados = pend.filter(r => r.hecho);
    const vencidos = abiertos.filter(r => r.fecha_limite && r.fecha_limite < hoy);
    const metasActivas = lista(metas).filter(m => m.estado === 'activa' && de(m));
    const idsMetas = new Set(metasActivas.map(m => m.id));
    const elementosMeta = [
      ...lista(hitos).filter(h => idsMetas.has(h.meta_id)),
      ...lista(pendientes).filter(t => t.meta_id && idsMetas.has(t.meta_id)),
    ];
    const gastosMes = lista(gastos).filter(g => de(g) && dia(g.fecha) && dia(g.fecha).slice(0, 7) === hoy.slice(0, 7));

    // Registros reales de la semana (lunes → hoy) y de los últimos 7 días (para la regla 2)
    const enRango = (f, a, b) => f && f >= a && f <= b;
    const compSemana = completados.filter(r => enRango(dia(r.hecho_en), lunes, hoy)).length;
    const notasSemana = lista(notas).filter(n => de(n) && enRango(dia(n.actualizado_en), lunes, hoy)).length;
    const focusDe = hayFocus ? sesiones.filter(s => s.frente_id === id) : [];
    const focusSemana = hayFocus ? focusDe.filter(s => enRango(dia(s.finalizado_en), lunes, hoy)).length : null;
    const total = compSemana + notasSemana + (focusSemana ?? 0);
    const reg7 = completados.filter(r => enRango(dia(r.hecho_en), desde7, hoy)).length
      + lista(notas).filter(n => de(n) && enRango(dia(n.actualizado_en), desde7, hoy)).length
      + (hayFocus ? focusDe.filter(s => enRango(dia(s.finalizado_en), desde7, hoy)).length : 0);

    const bal = hayBalance ? balance.frentes.find(f => f.id === id) : null;
    const atencion = bal && bal.objetivo > 0 ? { puntos: bal.puntos, objetivo: bal.objetivo, cumplimiento: bal.cumplimiento } : null;

    // Reglas de «requiere atención»: cada una con su motivo (no hay puntaje oculto)
    const requiere = [];
    if (vencidos.length > 0) {
      requiere.push({ regla: 1, motivo: `${vencidos.length} ${vencidos.length === 1 ? 'pendiente vencido' : 'pendientes vencidos'}` });
    }
    if (abiertos.length > 0 && reg7 === 0) {
      requiere.push({ regla: 2, motivo: `${abiertos.length} ${abiertos.length === 1 ? 'pendiente abierto' : 'pendientes abiertos'} y ningún registro en ${UMBRALES.diasSinRegistros} días` });
    }
    const avanceSemana = (diasEntre(lunes, hoy) + 1) / 7;
    if (atencion && avanceSemana >= UMBRALES.semanaTranscurrida && atencion.cumplimiento !== null && atencion.cumplimiento < UMBRALES.atencionMinima) {
      requiere.push({ regla: 3, motivo: `Atención al ${Math.round(atencion.cumplimiento * 100)} % del objetivo prorrateado, con ${Math.round(avanceSemana * 100)} % de la semana transcurrida` });
    }
    if (hayFocus && atencion) {
      const desdeF = sumarDias(hoy, -(UMBRALES.diasSinFocus - 1));
      if (!focusDe.some(s => enRango(dia(s.finalizado_en), desdeF, hoy))) {
        requiere.push({ regla: 4, motivo: `Tiene objetivo semanal y no completó sesiones de Focus en ${UMBRALES.diasSinFocus} días` });
      }
    }

    return {
      id, nombre,
      registros: { pendientesCompletados: compSemana, notas: notasSemana, sesionesFocus: focusSemana, total },
      pendientes: { abiertos: abiertos.length, vencidos: vencidos.length, completados: completados.length, total: pend.length },
      metas: { activas: metasActivas.length, hechos: elementosMeta.filter(e => e.hecho).length, total: elementosMeta.length,
        avance: elementosMeta.length ? elementosMeta.filter(e => e.hecho).length / elementosMeta.length : null },
      gastoMes: gastosMes.reduce((s, g) => s + (Number(g.valor_cop) || 0), 0),
      gastoNegocio: id === 'tanku' || id === 'ticketcode',
      atencion, requiereAtencion: requiere,
      sinNingunDato: pend.length === 0 && metasActivas.length === 0 && total === 0 && gastosMes.length === 0 && lista(notas).filter(n => de(n)).length === 0,
    };
  });

  const totalRegistros = filas.reduce((s, f) => s + f.registros.total, 0);
  const concentracion = {
    estado: totalRegistros > 0 ? 'datos' : 'sin_registros', total: totalRegistros,
    partes: filas.map(f => ({ id: f.id, nombre: f.nombre, registros: f.registros.total, proporcion: totalRegistros > 0 ? f.registros.total / totalRegistros : null })),
  };
  return { semana: { desde: lunes, hasta: sumarDias(lunes, 6) }, hayFocus, hayBalance, filas, concentracion, hayAtencion: filas.some(f => f.requiereAtencion.length > 0) };
}

/**
 * Datos de dibujo del mapa para comparar los seis frentes con la MISMA escala:
 *  - actividad: ancho relativo al frente con más registros (0–1)
 *  - atención: 'objetivo' (cumplimiento 0–1 y puntos/objetivo) | 'sin_objetivo' | 'no_disponible' (Fase 3 sin activar)
 *  - pendientes: segmentos completados / abiertos / vencidos como proporción del total del frente
 * No calcula puntajes: solo proporciones de conteos reales.
 */
export function vistaMapa(mapa) {
  const max = Math.max(0, ...mapa.filas.map(f => f.registros.total));
  const filas = mapa.filas.map(f => {
    const p = f.pendientes;
    const abiertosNormales = Math.max(0, p.abiertos - p.vencidos);
    const seg = p.total > 0 ? [
      { clave: 'completados', valor: p.completados, proporcion: p.completados / p.total },
      { clave: 'abiertos', valor: abiertosNormales, proporcion: abiertosNormales / p.total },
      { clave: 'vencidos', valor: p.vencidos, proporcion: p.vencidos / p.total },
    ].filter(s => s.valor > 0) : [];
    return {
      id: f.id, nombre: f.nombre, sinNingunDato: f.sinNingunDato,
      actividad: { total: f.registros.total, ancho: max > 0 ? f.registros.total / max : null, desglose: f.registros },
      atencion: f.atencion ? { estado: 'objetivo', puntos: f.atencion.puntos, objetivo: f.atencion.objetivo, cumplimiento: f.atencion.cumplimiento }
        : { estado: mapa.hayBalance ? 'sin_objetivo' : 'no_disponible' },
      pendientes: { total: p.total, abiertos: p.abiertos, vencidos: p.vencidos, completados: p.completados, segmentos: seg },
      requiereAtencion: f.requiereAtencion,
    };
  });
  return { maxActividad: max, filas, hayDatos: mapa.concentracion.estado === 'datos' || filas.some(f => f.pendientes.total > 0) };
}
