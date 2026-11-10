import { test } from 'node:test';
import assert from 'node:assert/strict';
import { obligacionesDe, prioridadEnCierre, cierreDeFecha, componenteExecution, execution, todasLasObligaciones, agruparEventos } from '../lib/domain/obligaciones.js';
import { rangoPeriodo, moverPeriodo, lifePulse, fraccion, textoEstado } from '../lib/domain/lifePulse.js';

// Bogotá = UTC-5. 2026-11-09 es lunes.
const t = (fecha, hhmm = '12:00') => `${fecha}T${hhmm}:00-05:00`;
let n = 0;
const creado = (cuando, ctx) => ({ evento: 'creado', campo: null, contexto: ctx, cambiado_en: cuando, seq: ++n });
const cambio = (cuando, campo, ant, nue) => ({ evento: 'actualizado', campo, valor_anterior: ant, valor_nuevo: nue, cambiado_en: cuando, seq: ++n });
const elim = (cuando, ctx) => ({ evento: 'eliminado', contexto: ctx, cambiado_en: cuando, seq: ++n });
const AHORA = Date.parse(t('2026-11-20'));
const ob = (tabla, eventos, ahora = AHORA) => obligacionesDe({ tabla, registroId: 'r', eventos, ahora }).obligaciones;
const P = (extra = {}) => ({ hecho: false, fecha_limite: '2026-11-09', prioridad: 'media', ...extra });

test('el corte es 00:00 de Bogotá del día siguiente (05:00 UTC)', () => {
  assert.equal(new Date(cierreDeFecha('2026-11-09')).toISOString(), '2026-11-10T05:00:00.000Z');
});

test('sin completar y vencido: incumplida; con fecha futura: abierta', () => {
  assert.equal(ob('pendientes', [creado(t('2026-11-01'), P())])[0].resultado, 'incumplida');
  assert.equal(ob('pendientes', [creado(t('2026-11-01'), P({ fecha_limite: '2026-11-25' }))])[0].resultado, 'abierta');
});

test('«vence hoy» sigue abierto hasta el cierre del día', () => {
  const ev = [creado(t('2026-11-01'), P())];
  assert.equal(ob('pendientes', ev, Date.parse(t('2026-11-09', '23:59')))[0].resultado, 'abierta');
  assert.equal(ob('pendientes', ev, Date.parse('2026-11-10T05:00:00Z'))[0].resultado, 'incumplida');
});

test('cumplida a tiempo y cumplida tardía (atribuida a la fecha d, con su fecha real)', () => {
  const aTiempo = ob('pendientes', [creado(t('2026-11-01'), P()), cambio(t('2026-11-09', '22:00'), 'hecho', 'false', 'true')])[0];
  assert.equal(aTiempo.resultado, 'cumplida_a_tiempo');
  const tardia = ob('pendientes', [creado(t('2026-11-01'), P()), cambio(t('2026-11-11', '09:00'), 'hecho', 'false', 'true')])[0];
  assert.equal(tardia.resultado, 'cumplida_tardia');
  assert.equal(tardia.fecha, '2026-11-09');
  assert.equal(new Date(tardia.completadoEn).toISOString(), '2026-11-11T14:00:00.000Z');
});

test('P6: vence el lunes sin cumplir y el martes se aplaza al viernes: dos obligaciones del mismo compromiso', () => {
  const ev = [creado(t('2026-11-01'), P()), cambio(t('2026-11-10', '09:00'), 'fecha_limite', '2026-11-09', '2026-11-13'), cambio(t('2026-11-12', '10:00'), 'hecho', 'false', 'true')];
  const o = ob('pendientes', ev);
  assert.deepEqual(o.map(x => [x.fecha, x.resultado]), [['2026-11-09', 'incumplida'], ['2026-11-13', 'cumplida_a_tiempo']]);
  assert.equal(new Set(o.map(x => x.registroId)).size, 1);
});

test('cambiar la fecha ANTES de que llegue no genera obligación para la fecha original', () => {
  const ev = [creado(t('2026-11-01'), P()), cambio(t('2026-11-09', '10:00'), 'fecha_limite', '2026-11-09', '2026-11-12')];
  assert.deepEqual(ob('pendientes', ev).map(x => x.fecha), ['2026-11-12']);
});

test('T-4: eliminar conserva las obligaciones ya llegadas y descarta las futuras', () => {
  const ev = [creado(t('2026-11-01'), P()), elim(t('2026-11-15'), P())];
  assert.deepEqual(ob('pendientes', ev).map(x => [x.fecha, x.resultado]), [['2026-11-09', 'incumplida']]);
  const futura = [creado(t('2026-11-01'), P({ fecha_limite: '2026-11-25' })), elim(t('2026-11-15'), P({ fecha_limite: '2026-11-25' }))];
  assert.deepEqual(ob('pendientes', futura), []);
});

test('T-5: desmarcar reevalúa la obligación vigente, pero no reabre una sustituida por un aplazamiento', () => {
  const vigente = [creado(t('2026-11-01'), P()), cambio(t('2026-11-09', '10:00'), 'hecho', 'false', 'true'), cambio(t('2026-11-12', '10:00'), 'hecho', 'true', 'false')];
  assert.equal(ob('pendientes', vigente)[0].resultado, 'incumplida');
  const sustituida = [creado(t('2026-11-01'), P()), cambio(t('2026-11-09', '10:00'), 'hecho', 'false', 'true'),
    cambio(t('2026-11-12', '10:00'), 'fecha_limite', '2026-11-09', '2026-11-16'), cambio(t('2026-11-13', '10:00'), 'hecho', 'true', 'false')];
  const o = ob('pendientes', sustituida);
  assert.equal(o[0].resultado, 'cumplida_a_tiempo', 'congelada');
  assert.equal(o[1].fecha, '2026-11-16');
});

test('un compromiso ya completado al asignarle fecha cuenta como cumplido desde ese instante', () => {
  const ev = [creado(t('2026-11-01'), P({ fecha_limite: null, hecho: true })), cambio(t('2026-11-05'), 'fecha_limite', null, '2026-11-09')];
  const o = ob('pendientes', ev);
  assert.equal(o.length, 1);
  assert.equal(o[0].resultado, 'cumplida_a_tiempo');
});

test('sin fecha límite no hay obligación (A2, D3-1)', () => {
  assert.deepEqual(ob('pendientes', [creado(t('2026-11-01'), P({ fecha_limite: null }))]), []);
});

test('hitos usan el campo «fecha»', () => {
  const o = ob('hitos', [creado(t('2026-11-01'), { hecho: false, fecha: '2026-11-09', prioridad: 'alta' })]);
  assert.deepEqual([o[0].fecha, o[0].peso], ['2026-11-09', 3]);
});

// ---- T-6
test('T-6: prioridad vigente al cierre del día de vencimiento; los cambios posteriores no alteran el peso histórico', () => {
  const ev = [creado(t('2026-11-01'), P({ prioridad: 'alta' })),
    cambio(t('2026-11-09', '23:00'), 'prioridad', 'alta', 'baja'),       // antes del cierre: cuenta
    cambio(t('2026-11-10', '09:00'), 'prioridad', 'baja', 'media')];     // después: no cuenta
  assert.equal(prioridadEnCierre(ev, '2026-11-09'), 'baja');
  assert.equal(ob('pendientes', ev)[0].peso, 1);
});

test('T-6: un cambio exactamente en el corte (05:00:00 UTC) cuenta como posterior', () => {
  const base = [creado(t('2026-11-01'), P({ prioridad: 'alta' }))];
  const justoAntes = [...base, cambio('2026-11-10T04:59:59.999Z', 'prioridad', 'alta', 'baja')];
  const enCorte = [...base, cambio('2026-11-10T05:00:00.000Z', 'prioridad', 'alta', 'baja')];
  assert.equal(prioridadEnCierre(justoAntes, '2026-11-09'), 'baja');
  assert.equal(prioridadEnCierre(enCorte, '2026-11-09'), 'alta');
});

test('T-6: respaldos (creación → eliminación → actual → media) y orden por seq en el mismo instante', () => {
  assert.equal(prioridadEnCierre([creado(t('2026-11-01'), P({ prioridad: 'baja' }))], '2026-11-09'), 'baja');
  assert.equal(prioridadEnCierre([elim(t('2026-11-05'), P({ prioridad: 'alta' }))], '2026-11-09'), 'alta');
  assert.equal(prioridadEnCierre([], '2026-11-09', 'alta'), 'alta');
  assert.equal(prioridadEnCierre([], '2026-11-09'), 'media');
  const mismo = t('2026-11-09', '10:00');
  const ev = [creado(t('2026-11-01'), P()), cambio(mismo, 'prioridad', 'media', 'alta'), cambio(mismo, 'prioridad', 'alta', 'baja')];
  assert.equal(prioridadEnCierre(ev, '2026-11-09'), 'baja');
});

test('T-6 (§9.6): ejemplo 75 % y 60 %', () => {
  const A = [creado(t('2026-11-01'), P({ prioridad: 'alta' })), cambio(t('2026-11-09', '08:00'), 'hecho', 'false', 'true')];
  const Bbase = creado(t('2026-11-01'), P({ prioridad: 'media' }));
  const bLunes = [Bbase, cambio(t('2026-11-09', '23:00'), 'prioridad', 'media', 'baja')];
  const bMartes = [Bbase, cambio(t('2026-11-10', '09:00'), 'prioridad', 'media', 'baja')];
  const calc = bEventos => {
    const oA = obligacionesDe({ tabla: 'pendientes', registroId: 'A', eventos: A, ahora: AHORA }).obligaciones;
    const oB = obligacionesDe({ tabla: 'pendientes', registroId: 'B', eventos: bEventos, ahora: AHORA }).obligaciones;
    return componenteExecution({ obligaciones: [...oA, ...oB], tabla: 'pendientes', desde: '2026-11-09', hasta: '2026-11-09', hoy: '2026-11-20' }).valor;
  };
  assert.equal(calc(bLunes), 75);
  assert.equal(calc(bMartes), 60);
});

// ---- Execution
const o = (tabla, fecha, resultado, peso) => ({ tabla, fecha, resultado, peso, registroId: 'x' });

test('Execution: E = 0,6T + 0,4M con ambos componentes', () => {
  const obl = [o('pendientes', '2026-11-09', 'cumplida_a_tiempo', 3), o('pendientes', '2026-11-09', 'incumplida', 1), o('hitos', '2026-11-09', 'cumplida_tardia', 2)];
  const e = execution({ obligaciones: obl, desde: '2026-11-09', hasta: '2026-11-15', hoy: '2026-11-20' });
  assert.equal(e.estado, 'ok');
  assert.equal(e.T.valor, 75); assert.equal(e.M.valor, 100);
  assert.equal(e.valor, 0.6 * 75 + 0.4 * 100);
});

test('Execution: con un solo componente es parcial y lo identifica; sin ninguno es «sin datos»', () => {
  const soloT = execution({ obligaciones: [o('pendientes', '2026-11-09', 'incumplida', 2)], desde: '2026-11-09', hasta: '2026-11-15', hoy: '2026-11-20' });
  assert.deepEqual([soloT.estado, soloT.parcialDe, soloT.valor], ['parcial', 'pendientes', 0]);
  const soloM = execution({ obligaciones: [o('hitos', '2026-11-09', 'cumplida_a_tiempo', 2)], desde: '2026-11-09', hasta: '2026-11-15', hoy: '2026-11-20' });
  assert.deepEqual([soloM.estado, soloM.parcialDe, soloM.valor], ['parcial', 'hitos', 100]);
  const nada = execution({ obligaciones: [], desde: '2026-11-09', hasta: '2026-11-15', hoy: '2026-11-20' });
  assert.deepEqual([nada.estado, nada.valor], ['sin_datos', null]);
});

test('Execution: cero real (todo incumplido) es distinto de «sin datos»', () => {
  const e = execution({ obligaciones: [o('pendientes', '2026-11-09', 'incumplida', 3)], desde: '2026-11-09', hasta: '2026-11-09', hoy: '2026-11-20' });
  assert.equal(e.estado, 'parcial'); assert.equal(e.valor, 0);
});

test('Execution (D3-25): lo que vence hoy entra desde el inicio del día; abierto cuenta como incumplido provisional; las fechas futuras no cuentan', () => {
  const obl = [o('pendientes', '2026-11-09', 'incumplida', 2), o('pendientes', '2026-11-10', 'abierta', 2), o('pendientes', '2026-11-10', 'cumplida_a_tiempo', 2), o('pendientes', '2026-11-12', 'cumplida_a_tiempo', 3)];
  const e = execution({ obligaciones: obl, desde: '2026-11-09', hasta: '2026-11-15', hoy: '2026-11-10' });
  assert.equal(e.T.pesoProgramado, 6); assert.equal(e.T.pesoCompletado, 2);
  assert.ok(Math.abs(e.valor - 100 / 3) < 1e-9);
  assert.equal(e.provisional, true); assert.equal(e.T.provisionales, 1); assert.equal(e.T.pesoProvisional, 2); assert.equal(e.enCurso, true);
});

test('D3-25: solo hay obligaciones abiertas de hoy: Execution es 0 provisional (no «sin datos») y no infla al ignorarlas', () => {
  const e = execution({ obligaciones: [o('pendientes', '2026-11-10', 'abierta', 3)], desde: '2026-11-10', hasta: '2026-11-10', hoy: '2026-11-10' });
  assert.deepEqual([e.estado, e.valor, e.provisional], ['parcial', 0, true]);
});

test('D3-25: si lo de hoy ya se cumplió no es provisional; al cumplirlo cambia a 100 % sin tocar el denominador', () => {
  const abierta = execution({ obligaciones: [o('pendientes', '2026-11-10', 'abierta', 2), o('pendientes', '2026-11-10', 'cumplida_a_tiempo', 2)], desde: '2026-11-10', hasta: '2026-11-10', hoy: '2026-11-10' });
  const cumplidas = execution({ obligaciones: [o('pendientes', '2026-11-10', 'cumplida_a_tiempo', 2), o('pendientes', '2026-11-10', 'cumplida_a_tiempo', 2)], desde: '2026-11-10', hasta: '2026-11-10', hoy: '2026-11-10' });
  assert.deepEqual([abierta.valor, abierta.provisional], [50, true]);
  assert.deepEqual([cumplidas.valor, cumplidas.provisional], [100, false]);
});

test('D3-25: al cierre del día se consolida con la prioridad vigente al cierre (T-6) y el cumplimiento tardío conserva su atribución', () => {
  // Vence el 10; sigue abierto a las 10:00 (peso provisional 2: prioridad «media»); a las 23:00 baja a «baja»: al cierre pesa 1.
  const base = [creado(t('2026-11-01'), P({ fecha_limite: '2026-11-10', prioridad: 'media' }))];
  const abierta = obligacionesDe({ tabla: 'pendientes', registroId: 'r', eventos: base, ahora: Date.parse(t('2026-11-10', '10:00')) }).obligaciones[0];
  assert.deepEqual([abierta.resultado, abierta.peso], ['abierta', 2]);
  const evCierre = [...base, cambio(t('2026-11-10', '23:00'), 'prioridad', 'media', 'baja')];
  const consolidada = obligacionesDe({ tabla: 'pendientes', registroId: 'r', eventos: evCierre, ahora: Date.parse(t('2026-11-11', '08:00')) }).obligaciones[0];
  assert.deepEqual([consolidada.resultado, consolidada.peso], ['incumplida', 1]);
  const tardia = obligacionesDe({ tabla: 'pendientes', registroId: 'r', eventos: [...evCierre, cambio(t('2026-11-12', '09:00'), 'hecho', 'false', 'true')], ahora: AHORA }).obligaciones[0];
  assert.deepEqual([tardia.fecha, tardia.resultado, tardia.peso], ['2026-11-10', 'cumplida_tardia', 1]);
  const dia = obl => execution({ obligaciones: obl, desde: '2026-11-10', hasta: '2026-11-10', hoy: '2026-11-20' }).valor;
  assert.equal(dia([consolidada]), 0); assert.equal(dia([tardia]), 100);
});

test('Execution: pendientes sin fecha excluidos y recalculado desde las obligaciones (no promedia días)', () => {
  const obl = [o('pendientes', '2026-11-09', 'cumplida_a_tiempo', 3), o('pendientes', '2026-11-10', 'incumplida', 1), o('pendientes', '2026-11-10', 'incumplida', 1), o('pendientes', '2026-11-10', 'incumplida', 1)];
  const semana = execution({ obligaciones: obl, desde: '2026-11-09', hasta: '2026-11-15', hoy: '2026-11-20' });
  assert.equal(semana.valor, 50);                                 // 3 de 6 (el promedio de 100 % y 0 % daría 50 por azar; el peso lo distingue)
  const dia1 = execution({ obligaciones: obl, desde: '2026-11-09', hasta: '2026-11-09', hoy: '2026-11-20' });
  const dia2 = execution({ obligaciones: obl, desde: '2026-11-10', hasta: '2026-11-10', hoy: '2026-11-20' });
  assert.equal(dia1.valor, 100); assert.equal(dia2.valor, 0);
});

test('un compromiso sin instantánea de creación no se inventa: se informa como sin historial', () => {
  const r = todasLasObligaciones({ filas: [{ tabla: 'pendientes', registro_id: 'z', evento: 'actualizado', campo: 'hecho', valor_nuevo: 'true', cambiado_en: t('2026-11-09'), seq: 1 }], ahora: AHORA });
  assert.deepEqual([r.obligaciones.length, r.sinHistorial], [0, 1]);
  assert.equal(agruparEventos([{ tabla: 'hitos', registro_id: 'a' }, { tabla: 'pendientes', registro_id: 'a' }]).length, 2);
});

// ---- Life Pulse
test('períodos: día, semana (lunes–domingo) y mes (bisiesto y cambio de año)', () => {
  assert.deepEqual(rangoPeriodo('semana', '2026-11-15'), { desde: '2026-11-09', hasta: '2026-11-15' });
  assert.deepEqual(rangoPeriodo('mes', '2028-02-10'), { desde: '2028-02-01', hasta: '2028-02-29' });
  assert.equal(moverPeriodo('mes', '2026-12-15', 1), '2027-01-01');
  assert.equal(moverPeriodo('mes', '2026-01-15', -1), '2025-12-31');
  assert.equal(moverPeriodo('semana', '2026-11-09', -1), '2026-11-08');
  assert.throws(() => rangoPeriodo('año', '2026-01-01'));
});

test('Life Pulse: tres indicadores independientes y sin indicador global', () => {
  const lp = lifePulse({ tipo: 'semana', ancla: '2026-11-10', hoy: '2026-11-10', obligaciones: [], objetivos: [], sesiones: [], habitos: [], versiones: [], tiempos: [] });
  assert.deepEqual(Object.keys(lp).filter(k => ['execution', 'balance', 'wellbeing', 'global', 'total', 'score', 'puntaje'].includes(k)), ['execution', 'balance', 'wellbeing']);
  assert.equal(lp.execution.estado, 'sin_datos'); assert.equal(lp.balance.estado, 'sin_objetivo'); assert.equal(lp.wellbeing.estado, 'sin_datos');
  assert.equal(lp.enCurso, true);
});

test('Life Pulse con datos: cada indicador usa solo sus fuentes (Focus no mueve Execution; hábitos no suman puntos)', () => {
  const sesiones = [{ id: 's', frente_id: 'tanku', estado: 'completada', puntos: 1, finalizado_en: '2026-11-10T15:00:00Z' }];
  const lp = lifePulse({
    tipo: 'dia', ancla: '2026-11-10', hoy: '2026-11-10',
    obligaciones: [o('pendientes', '2026-11-10', 'cumplida_a_tiempo', 2)],
    objetivos: [{ semana_inicio: '2026-11-09', frente_id: 'tanku', puntos: 7 }], sesiones,
    habitos: [{ id: 'h', archivado_desde: null }], versiones: [{ habito_id: 'h', vigente_desde: '2026-11-01', frecuencia: 'diaria', dias_semana: [], objetivo_s: 3600 }],
    tiempos: [{ habito_id: 'h', fecha: '2026-11-10', manual_s: 1800, temporizador_s: 0 }],
  });
  assert.equal(lp.execution.valor, 100);
  assert.equal(lp.balance.valor, 100);                              // 1 punto de 1 (7/7)
  assert.equal(lp.wellbeing.valor, 50);
  assert.equal(fraccion(lp.wellbeing), 0.5);
});

test('fracción y texto de estado nunca fabrican valores', () => {
  assert.equal(fraccion({ valor: null }), null); assert.equal(fraccion(undefined), null); assert.equal(fraccion({ valor: 0 }), 0);
  assert.equal(textoEstado('b', { estado: 'sin_objetivo' }), 'Sin objetivo');
  assert.equal(textoEstado('e', { estado: 'parcial', parcialDe: 'hitos' }), 'Parcial: solo hitos');
  assert.equal(textoEstado('e', { estado: 'ok', enCurso: true }), 'En curso');
});

test('período futuro: el balance no calcula y los indicadores no inventan valores', () => {
  const lp = lifePulse({ tipo: 'semana', ancla: '2026-11-16', hoy: '2026-11-10', obligaciones: [], objetivos: [{ semana_inicio: '2026-11-16', frente_id: 'tanku', puntos: 5 }], sesiones: [], habitos: [], versiones: [], tiempos: [] });
  assert.equal(lp.futuro, true); assert.equal(lp.balance.estado, 'no_iniciado'); assert.equal(lp.balance.valor, null);
});
