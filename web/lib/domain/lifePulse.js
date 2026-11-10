// Life Pulse (Fase 3, §5): tres indicadores INDEPENDIENTES —Execution, Balance y Wellbeing— para un período diario,
// semanal o mensual. NO existe un indicador global ni un promedio entre ellos (decisión D7, vigente).
// Cada período se recalcula desde los registros originales; nunca se promedian porcentajes de períodos menores.
// Lógica pura: sin red ni reloj propio. «Sin datos», «sin objetivo» y cero real son estados distintos.
import { sumarDias, inicioSemana, ultimoDiaMes, diasEntre } from './fechas.js';
import { execution } from './obligaciones.js';
import { wellbeing } from './habitos.js';
import { balancePeriodo, objetivosPorSemana } from './atencion.js';

export const TIPOS_PERIODO = [
  { id: 'dia', nombre: 'Diario' },
  { id: 'semana', nombre: 'Semanal' },
  { id: 'mes', nombre: 'Mensual' },
];

/** Rango {desde, hasta} de un período que contiene la fecha `ancla` (fechas AAAA-MM-DD de Bogotá). */
export function rangoPeriodo(tipo, ancla) {
  if (tipo === 'dia') return { desde: ancla, hasta: ancla };
  if (tipo === 'semana') { const l = inicioSemana(ancla); return { desde: l, hasta: sumarDias(l, 6) }; }
  if (tipo === 'mes') {
    const [a, m] = ancla.split('-').map(Number);
    return { desde: `${a}-${String(m).padStart(2, '0')}-01`, hasta: `${a}-${String(m).padStart(2, '0')}-${String(ultimoDiaMes(a, m)).padStart(2, '0')}` };
  }
  throw new RangeError(`Tipo de período inválido: ${tipo}`);
}

/** Ancla del período anterior (-1) o siguiente (+1). */
export function moverPeriodo(tipo, ancla, sentido) {
  const { desde, hasta } = rangoPeriodo(tipo, ancla);
  return sentido < 0 ? sumarDias(desde, -1) : sumarDias(hasta, 1);
}

/** ¿El período contiene a «hoy» (está abierto)? */
export const periodoEnCurso = (rango, hoy) => hoy >= rango.desde && hoy <= rango.hasta;

/** ¿El período aún no empezó? Los días futuros no se contabilizan. */
export const periodoFuturo = (rango, hoy) => rango.desde > hoy;

/**
 * Los tres indicadores de un período. Entrada: datos ya leídos.
 *  - obligaciones: salida de todasLasObligaciones
 *  - objetivos: filas de objetivos_atencion;  sesiones: sesiones Focus (se cuentan solo las completadas)
 *  - habitos, versiones, tiempos: hábitos nuevos
 * `frenteId` (opcional, de ?frente= en la URL) filtra SOLO Balance: los compromisos y los hábitos no tienen frente de diseño
 * definido en la especificación, así que Execution y Wellbeing no se filtran (no se simula).
 * Devuelve { rango, enCurso, futuro, execution, balance, wellbeing } sin ninguna combinación entre ellos.
 */
export function lifePulse({ tipo, ancla, hoy, obligaciones, objetivos, sesiones, habitos, versiones, tiempos, frenteId = null }) {
  const rango = rangoPeriodo(tipo, ancla);
  return {
    tipo, rango, frenteId: frenteId ?? null, enCurso: periodoEnCurso(rango, hoy), futuro: periodoFuturo(rango, hoy),
    execution: execution({ obligaciones, desde: rango.desde, hasta: rango.hasta, hoy }),
    balance: balancePeriodo({ desde: rango.desde, hasta: rango.hasta, hoy, objetivos: objetivosPorSemana(objetivos), sesiones, frenteId }),
    wellbeing: wellbeing({ habitos, versiones, tiempos, desde: rango.desde, hasta: rango.hasta, hoy }),
  };
}

/** Valor 0–1 para anillos y barras: null si el indicador no tiene valor (nunca 0 inventado). */
export const fraccion = ind => (ind && Number.isFinite(ind.valor) ? Math.min(1, Math.max(0, ind.valor / 100)) : null);

/** Texto de estado de un indicador para mostrar junto al valor. */
export function textoEstado(nombre, ind) {
  if (!ind) return 'Sin datos';
  if (ind.estado === 'sin_objetivo') return 'Sin objetivo';
  if (ind.estado === 'no_iniciado') return 'Aún no empieza';
  if (ind.estado === 'sin_datos') return 'Sin datos';
  if (ind.estado === 'parcial') return `Parcial: solo ${ind.parcialDe === 'hitos' ? 'hitos' : 'compromisos'}`;
  return ind.enCurso ? 'En curso' : 'Cerrado';
}

/** Días del rango (para etiquetas). */
export const diasDelRango = r => diasEntre(r.desde, r.hasta) + 1;
