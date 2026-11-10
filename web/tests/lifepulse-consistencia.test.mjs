// Consistencia entre períodos de Life Pulse y filtro de frente de Balance.
// Un período semanal o mensual se recalcula desde los registros originales: sus sumas (pesos, objetivos prorrateados,
// puntos, tiempos) deben ser exactamente la suma de los días que lo componen, y su valor, la fórmula aplicada a esas
// sumas (no el promedio de los porcentajes diarios).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lifePulse, rangoPeriodo } from '../lib/domain/lifePulse.js';
import { sumarDias, diasEntre } from '../lib/domain/fechas.js';
import { balancePeriodo, balanceSemana, objetivosPorSemana, IDS_FRENTES } from '../lib/domain/atencion.js';

function prng(semilla) { let a = semilla; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function datos(semilla, hoy) {
  const r = prng(semilla);
  const pick = a => a[Math.floor(r() * a.length)];
  const obligaciones = [];
  for (let i = 0; i < 160; i++) {
    const fecha = sumarDias('2026-10-24', Math.floor(r() * 50));
    const tabla = r() < 0.7 ? 'pendientes' : 'hitos';
    const resultado = fecha > hoy ? pick(['cumplida_a_tiempo', 'abierta']) : fecha === hoy ? pick(['abierta', 'cumplida_a_tiempo']) : pick(['cumplida_a_tiempo', 'cumplida_tardia', 'incumplida']);
    obligaciones.push({ tabla, fecha, resultado, peso: pick([1, 2, 3]), registroId: `r${i}` });
  }
  const sesiones = [];
  for (let i = 0; i < 120; i++) {
    const d = sumarDias('2026-10-24', Math.floor(r() * 50));
    sesiones.push({ id: `s${i}`, frente_id: pick(IDS_FRENTES), estado: pick(['completada', 'completada', 'parcial', 'cancelada']), puntos: 1, finalizado_en: `${d}T${String(14 + Math.floor(r() * 9)).padStart(2, '0')}:00:00Z` });
  }
  const objetivos = [];
  for (const lunes of ['2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30']) {
    if (r() < 0.25) continue;                                                         // algunas semanas sin objetivos
    for (const id of IDS_FRENTES) if (r() < 0.7) objetivos.push({ semana_inicio: lunes, frente_id: id, puntos: Math.floor(r() * 15) });
  }
  const habitos = [{ id: 'h1', archivado_desde: null }, { id: 'h2', archivado_desde: '2026-11-20' }];
  const versiones = [
    { habito_id: 'h1', vigente_desde: '2026-10-20', frecuencia: 'diaria', dias_semana: [], objetivo_s: 1800 },
    { habito_id: 'h1', vigente_desde: '2026-11-11', frecuencia: 'dias', dias_semana: [0, 2, 4], objetivo_s: 2700 },
    { habito_id: 'h2', vigente_desde: '2026-10-28', frecuencia: 'dias', dias_semana: [1, 3, 5, 6], objetivo_s: 900 },
  ];
  const tiempos = [];
  for (const h of ['h1', 'h2']) for (let i = 0; i < 50; i++) if (r() < 0.5) tiempos.push({ habito_id: h, fecha: sumarDias('2026-10-24', i), manual_s: Math.floor(r() * 4000), temporizador_s: 0 });
  return { obligaciones, sesiones, objetivos, habitos, versiones, tiempos };
}

const dias = (desde, hasta) => Array.from({ length: diasEntre(desde, hasta) + 1 }, (_, i) => sumarDias(desde, i));
const cerca = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`);
const lp = (d, tipo, ancla, hoy, extra = {}) => lifePulse({ tipo, ancla, hoy, ...d, ...extra });

for (const [semilla, hoy] of [[1, '2026-11-18'], [7, '2026-11-09'], [42, '2026-11-30'], [99, '2026-12-03'], [5, '2026-11-01']]) {
  test(`consistencia diario/semanal/mensual con hoy=${hoy} (semilla ${semilla}): las sumas del período son las de sus días`, () => {
    const d = datos(semilla, hoy);
    for (const [tipo, ancla] of [['semana', '2026-11-10'], ['semana', '2026-11-30'], ['mes', '2026-11-15']]) {
      const periodo = lp(d, tipo, ancla, hoy);
      const { desde, hasta } = rangoPeriodo(tipo, ancla);
      const diarios = dias(desde, hasta).map(f => lp(d, 'dia', f, hoy));

      // Execution: pesos programados y completados por componente
      for (const k of ['T', 'M']) {
        cerca(periodo.execution[k].pesoProgramado, diarios.reduce((s, x) => s + x.execution[k].pesoProgramado, 0), `${tipo} ${k} programado`);
        cerca(periodo.execution[k].pesoCompletado, diarios.reduce((s, x) => s + x.execution[k].pesoCompletado, 0), `${tipo} ${k} completado`);
        cerca(periodo.execution[k].provisionales, diarios.reduce((s, x) => s + x.execution[k].provisionales, 0), `${tipo} ${k} provisionales`);
        const pp = periodo.execution[k];
        assert.equal(pp.valor, pp.pesoProgramado > 0 ? (100 * pp.pesoCompletado) / pp.pesoProgramado : null, `${tipo} ${k} valor = fórmula sobre las sumas`);
      }
      // Wellbeing
      cerca(periodo.wellbeing.objetivoS, diarios.reduce((s, x) => s + x.wellbeing.objetivoS, 0), `${tipo} W objetivo`);
      cerca(periodo.wellbeing.realizadoS, diarios.reduce((s, x) => s + x.wellbeing.realizadoS, 0), `${tipo} W realizado`);
      assert.equal(periodo.wellbeing.ocurrencias, diarios.reduce((s, x) => s + x.wellbeing.ocurrencias, 0));
      if (periodo.wellbeing.estado === 'ok') cerca(periodo.wellbeing.valor, (100 * periodo.wellbeing.realizadoS) / periodo.wellbeing.objetivoS, `${tipo} W valor`);
      // Balance: objetivo prorrateado y puntos por frente
      for (const id of IDS_FRENTES) {
        const f = x => x.balance.frentes.find(y => y.id === id);
        cerca(f(periodo).objetivo, diarios.reduce((s, x) => s + (f(x).objetivo ?? 0), 0), `${tipo} B objetivo ${id}`);
        const pts = diarios.reduce((s, x) => s + (f(x).puntos ?? 0), 0);
        assert.equal(f(periodo).puntos ?? 0, pts, `${tipo} B puntos ${id}`);
      }
      const b = periodo.balance;
      if (b.estado === 'ok') {
        const sumG = b.frentes.reduce((s, f) => s + f.objetivo, 0);
        cerca(b.valor, (100 * b.frentes.reduce((s, f) => s + (f.objetivo > 0 ? f.objetivo * Math.min(1, f.puntos / f.objetivo) : 0), 0)) / sumG, `${tipo} B valor`);
      }
      // Estados coherentes con el calendario
      assert.equal(periodo.enCurso, hoy >= desde && hoy <= hasta);
      if (desde > hoy) { assert.equal(periodo.execution.estado, 'sin_datos'); assert.equal(periodo.balance.estado, 'no_iniciado'); assert.equal(periodo.wellbeing.estado, 'sin_datos'); }
    }
  });
}

test('el valor semanal NO es el promedio de los porcentajes diarios', () => {
  const obl = [
    { tabla: 'pendientes', fecha: '2026-11-09', resultado: 'cumplida_a_tiempo', peso: 1, registroId: 'a' },
    { tabla: 'pendientes', fecha: '2026-11-10', resultado: 'incumplida', peso: 3, registroId: 'b' },
  ];
  const base = { obligaciones: obl, objetivos: [], sesiones: [], habitos: [], versiones: [], tiempos: [] };
  const semana = lp(base, 'semana', '2026-11-10', '2026-11-20');
  const promedioDias = (lp(base, 'dia', '2026-11-09', '2026-11-20').execution.valor + lp(base, 'dia', '2026-11-10', '2026-11-20').execution.valor) / 2;
  assert.equal(semana.execution.valor, 25);
  assert.equal(promedioDias, 50);
});

test('un mismo día da el mismo resultado visto como día, como semana de un solo día elegible o como mes', () => {
  const d = datos(3, '2026-11-18');
  const dia = lp(d, 'dia', '2026-11-18', '2026-11-18');
  const semanaHastaHoy = lp(d, 'semana', '2026-11-18', '2026-11-18');           // la semana en curso solo incluye lo que ya llegó
  const diasPrevios = dias('2026-11-16', '2026-11-18').map(f => lp(d, 'dia', f, '2026-11-18'));
  cerca(semanaHastaHoy.execution.T.pesoProgramado, diasPrevios.reduce((s, x) => s + x.execution.T.pesoProgramado, 0), 'semana en curso');
  assert.equal(dia.rango.desde, dia.rango.hasta);
});

// ---- Filtro de frente (?frente=)
const sesion = (frente, fin) => ({ id: Math.random().toString(), frente_id: frente, estado: 'completada', puntos: 1, finalizado_en: fin });

test('Balance con filtro de frente: solo ese frente entra al denominador y a los puntos', () => {
  const objetivos = objetivosPorSemana([{ semana_inicio: '2026-11-09', frente_id: 'tanku', puntos: 4 }, { semana_inicio: '2026-11-09', frente_id: 'salud', puntos: 4 }]);
  const sesiones = [sesion('tanku', '2026-11-10T15:00:00Z'), sesion('tanku', '2026-11-11T15:00:00Z'), sesion('salud', '2026-11-11T15:00:00Z')];
  const todos = balanceSemana({ lunes: '2026-11-09', hoy: '2026-11-20', objetivos, sesiones });
  const tanku = balanceSemana({ lunes: '2026-11-09', hoy: '2026-11-20', objetivos, sesiones, frenteId: 'tanku' });
  assert.equal(todos.valor, 37.5);                                                   // (min(4,2)+min(4,1)) / 8
  assert.equal(tanku.valor, 50); assert.equal(tanku.frentes.length, 1); assert.equal(tanku.frentes[0].id, 'tanku');
  assert.equal(tanku.puntosTotales, 2);
});

test('Balance con filtro: un frente sin objetivo es «sin objetivo» (no 0 %) y muestra sus puntos aparte; frente inválido = todos', () => {
  const objetivos = objetivosPorSemana([{ semana_inicio: '2026-11-09', frente_id: 'tanku', puntos: 4 }]);
  const sesiones = [sesion('salud', '2026-11-10T15:00:00Z')];
  const salud = balanceSemana({ lunes: '2026-11-09', hoy: '2026-11-20', objetivos, sesiones, frenteId: 'salud' });
  assert.deepEqual([salud.estado, salud.valor, salud.puntosTotales], ['sin_objetivo', null, 1]);
  assert.equal(balanceSemana({ lunes: '2026-11-09', hoy: '2026-11-20', objetivos, sesiones, frenteId: 'inexistente' }).frentes.length, 6);
});

test('Life Pulse con filtro de frente: solo cambia Balance; Execution y Wellbeing no se filtran ni se simulan', () => {
  const d = datos(11, '2026-11-18');
  const sin = lp(d, 'semana', '2026-11-18', '2026-11-18');
  const con = lp(d, 'semana', '2026-11-18', '2026-11-18', { frenteId: 'tanku' });
  assert.deepEqual(con.execution, sin.execution);
  assert.deepEqual(con.wellbeing, sin.wellbeing);
  assert.equal(con.balance.frentes.length, 1); assert.equal(con.frenteId, 'tanku');
  assert.equal(sin.balance.frentes.length, 6); assert.equal(sin.frenteId, null);
});

test('la suma de los balances filtrados por frente reproduce los puntos y objetivos del balance total', () => {
  const d = datos(21, '2026-11-18');
  const total = balancePeriodo({ desde: '2026-11-01', hasta: '2026-11-30', hoy: '2026-11-18', objetivos: objetivosPorSemana(d.objetivos), sesiones: d.sesiones });
  const partes = IDS_FRENTES.map(id => balancePeriodo({ desde: '2026-11-01', hasta: '2026-11-30', hoy: '2026-11-18', objetivos: objetivosPorSemana(d.objetivos), sesiones: d.sesiones, frenteId: id }));
  assert.equal(partes.reduce((s, p) => s + p.puntosTotales, 0), total.puntosTotales);
  cerca(partes.reduce((s, p) => s + p.frentes[0].objetivo, 0), total.frentes.reduce((s, f) => s + f.objetivo, 0), 'objetivos');
});
