// Capa de datos de Life Pulse: lee (solo lectura) lo necesario para los tres indicadores de un período.
// No escribe nada. Usa el historial de cambios (cambios_registro) para reconstruir las obligaciones de Execution.
import { leerPaginado, unica } from './rpc.js';
import { crearServicioHabitos } from './habitos.js';
import { fechaBogota, sumarDias, inicioSemana } from '../domain/fechas.js';
import { rangoPeriodo, lifePulse } from '../domain/lifePulse.js';
import { todasLasObligaciones } from '../domain/obligaciones.js';

/**
 * Carga lo necesario UNA sola vez y calcula uno o varios períodos: `periodos` = [{ tipo, ancla }].
 * Devuelve { hoy, sinHistorial, resultados: [lifePulse, …] } en el mismo orden. Lanza el error de Supabase si alguna
 * lectura falla (un error nunca se convierte en «sin datos»). `ahoraMs` se puede inyectar para pruebas.
 * Así Home calcula «hoy» y «esta semana» con una sola lectura del historial.
 */
export async function cargarLifePulseVarios(supabase, { periodos, frenteId = null, ahoraMs = Date.now(), servicioHabitos = null }) {
  const hoy = fechaBogota(new Date(ahoraMs));
  const rangos = periodos.map(p => rangoPeriodo(p.tipo, p.ancla));
  const desde = rangos.map(r => r.desde).sort()[0];
  const hasta = rangos.map(r => r.hasta).sort().at(-1);
  const hs = servicioHabitos ?? crearServicioHabitos(supabase);
  const [filas, pend, hitos, habitosDatos, objetivos, sesiones] = await Promise.all([
    leerPaginado(() => supabase.from('cambios_registro').select('*').order('cambiado_en').order('seq')),
    leerPaginado(() => supabase.from('pendientes').select('id,prioridad').order('id')),
    leerPaginado(() => supabase.from('hitos').select('id,prioridad').order('id')),
    hs.cargarHabitos({ desde }),
    hs.listarObjetivos({ desde: inicioSemana(desde) }),
    hs.sesionesCompletadas({ desde, hasta: hasta < hoy ? hasta : hoy }),
  ]);
  const actuales = { pendientes: new Map(pend.map(p => [p.id, p.prioridad])), hitos: new Map(hitos.map(h => [h.id, h.prioridad])) };
  const { obligaciones, sinHistorial } = todasLasObligaciones({ filas, ahora: ahoraMs, actuales });
  return {
    hoy, sinHistorial, sesiones, habitos: habitosDatos.habitos,
    resultados: periodos.map(p => lifePulse({ tipo: p.tipo, ancla: p.ancla, hoy, obligaciones, objetivos, sesiones, habitos: habitosDatos.habitos, versiones: habitosDatos.versiones, tiempos: habitosDatos.tiempos, frenteId })),
  };
}

/** Un solo período: { hoy, sinHistorial, lifePulse }. */
export async function cargarLifePulse(supabase, { tipo, ancla, ...resto }) {
  const r = await cargarLifePulseVarios(supabase, { periodos: [{ tipo, ancla }], ...resto });
  return { hoy: r.hoy, sinHistorial: r.sinHistorial, lifePulse: r.resultados[0] };
}

export { unica, sumarDias };
