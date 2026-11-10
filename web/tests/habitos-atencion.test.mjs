import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  versionVigente, hayOcurrencia, ocurrenciasEntre, tiempoVigente, textoProgramacion, estadoDeFecha, wellbeing,
} from '../lib/domain/habitos.js';
import { puntosPorFrente, objetivosPorSemana, balancePeriodo, balanceSemana, semanaCerrada, lunesDe } from '../lib/domain/atencion.js';

// 2026-11-09 es lunes
const H = { id: 'h1', archivado_desde: null };
const diaria = (desde, obj = 2700) => ({ habito_id: 'h1', vigente_desde: desde, frecuencia: 'diaria', dias_semana: [], objetivo_s: obj });
const dias = (desde, d, obj = 2700) => ({ habito_id: 'h1', vigente_desde: desde, frecuencia: 'dias', dias_semana: d, objetivo_s: obj });

test('versión vigente: la más reciente que no supere la fecha; antes de la primera no hay ocurrencias', () => {
  const vs = [diaria('2026-11-01'), dias('2026-11-10', [0, 2])];
  assert.equal(versionVigente(vs, '2026-10-31'), null);
  assert.equal(versionVigente(vs, '2026-11-09').frecuencia, 'diaria');
  assert.equal(versionVigente(vs, '2026-11-10').frecuencia, 'dias');
  assert.equal(hayOcurrencia(H, vs, '2026-10-31'), false);
});

test('ocurrencias por días de la semana (0 = lunes) y programación hacia delante', () => {
  const vs = [dias('2026-11-02', [0, 2, 4])];                  // lunes, miércoles, viernes
  assert.deepEqual(ocurrenciasEntre(H, vs, '2026-11-09', '2026-11-15'), ['2026-11-09', '2026-11-11', '2026-11-13']);
  const cambio = [dias('2026-11-02', [0, 2, 4]), diaria('2026-11-12')];
  assert.deepEqual(ocurrenciasEntre(H, cambio, '2026-11-09', '2026-11-13'), ['2026-11-09', '2026-11-11', '2026-11-12', '2026-11-13']);
});

test('archivar: no hay ocurrencias desde la fecha de archivo (inclusive) y el historial anterior se conserva', () => {
  const h = { id: 'h1', archivado_desde: '2026-11-12' };
  assert.deepEqual(ocurrenciasEntre(h, [diaria('2026-11-09')], '2026-11-09', '2026-11-14'), ['2026-11-09', '2026-11-10', '2026-11-11']);
});

test('tiempo vigente: sin fila = sin registro (null); fila en cero = cero real', () => {
  assert.equal(tiempoVigente(undefined), null);
  assert.equal(tiempoVigente({ manual_s: 0, temporizador_s: 0 }), 0);
  assert.equal(tiempoVigente({ manual_s: 600, temporizador_s: 300 }), 900);
  assert.equal(tiempoVigente({ manual_s: null, temporizador_s: 120 }), 120);
});

test('texto de programación', () => {
  assert.equal(textoProgramacion(diaria('2026-11-01', 3600)), 'Todos los días · 60 min');
  assert.equal(textoProgramacion(dias('2026-11-01', [4, 0, 2], 2700)), 'Lun, Mié, Vie · 45 min');
  assert.equal(textoProgramacion(null), 'Sin programación vigente');
});

test('estado de fecha: futura, en curso (hoy) y cerrada', () => {
  assert.deepEqual(['2026-11-10', '2026-11-09', '2026-11-08'].map(f => estadoDeFecha(f, '2026-11-09')), ['futura', 'en_curso', 'cerrada']);
});

// ---- Wellbeing
const base = { habitos: [H], versiones: [diaria('2026-11-02')], desde: '2026-11-09', hasta: '2026-11-15' };

test('Wellbeing: sin ocurrencias elegibles es «sin datos», no 0 %', () => {
  const w = wellbeing({ ...base, tiempos: [], hoy: '2026-11-08' });
  assert.equal(w.estado, 'sin_datos'); assert.equal(w.valor, null);
  assert.equal(wellbeing({ habitos: [], versiones: [], tiempos: [], desde: '2026-11-09', hasta: '2026-11-15', hoy: '2026-11-12' }).estado, 'sin_datos');
});

test('Wellbeing: ocurrencia elegible sin tiempo es un cero real (distinto de sin datos)', () => {
  const w = wellbeing({ ...base, tiempos: [], hoy: '2026-11-09' });
  assert.equal(w.estado, 'ok'); assert.equal(w.valor, 0); assert.equal(w.ocurrencias, 1); assert.equal(w.enCurso, true);
});

test('Wellbeing: tope del 100 % por ocurrencia; el exceso no compensa otras', () => {
  const tiempos = [{ habito_id: 'h1', fecha: '2026-11-09', manual_s: 5400, temporizador_s: 0 }, { habito_id: 'h1', fecha: '2026-11-10', manual_s: 0, temporizador_s: 0 }];
  const w = wellbeing({ ...base, tiempos, hoy: '2026-11-10' });
  assert.equal(w.valor, 50);                                  // min(5400,2700)+0 = 2700 de 5400
  assert.equal(w.ocurrencias, 2);
});

test('Wellbeing: los días futuros no cuentan y se recalcula desde los registros (no promedia días)', () => {
  const tiempos = [{ habito_id: 'h1', fecha: '2026-11-09', manual_s: 2700, temporizador_s: 0 }];
  const w = wellbeing({ ...base, tiempos, hoy: '2026-11-11' });
  assert.equal(w.ocurrencias, 3);
  assert.ok(Math.abs(w.valor - 100 / 3) < 1e-9);
});

test('Wellbeing: cambio de programación rige hacia delante y usa el objetivo vigente de cada fecha', () => {
  const versiones = [diaria('2026-11-02', 1800), diaria('2026-11-11', 3600)];
  const tiempos = [{ habito_id: 'h1', fecha: '2026-11-09', manual_s: 1800, temporizador_s: 0 }, { habito_id: 'h1', fecha: '2026-11-11', manual_s: 1800, temporizador_s: 0 }];
  const w = wellbeing({ habitos: [H], versiones, tiempos, desde: '2026-11-09', hasta: '2026-11-15', hoy: '2026-11-11' });
  // 9: 1800/1800, 10: 0/1800, 11: 1800/3600  => 3600 / 7200
  assert.equal(w.valor, 50); assert.equal(w.objetivoS, 7200);
});

// ---- Balance
const ses = (frente, fin, estado = 'completada') => ({ id: Math.random().toString(), frente_id: frente, estado, puntos: estado === 'completada' ? 1 : 0, finalizado_en: fin });
const L = '2026-11-09';
const obj = o => ({ [L]: o });

test('puntos por frente: solo completadas, por fecha de Bogotá (23:30 del día llega a 04:30 UTC del siguiente)', () => {
  const s = [
    ses('tanku', '2026-11-10T04:30:00Z'),                        // 23:30 Bogotá del 9
    ses('tanku', '2026-11-10T05:00:00Z'),                        // 00:00 Bogotá del 10
    ses('tanku', '2026-11-10T06:00:00Z', 'parcial'),
    ses('salud', '2026-11-10T06:00:00Z', 'cancelada'),
  ];
  assert.equal(puntosPorFrente(s, '2026-11-09', '2026-11-09').tanku, 1);
  assert.equal(puntosPorFrente(s, '2026-11-10', '2026-11-10').tanku, 1);
  assert.equal(puntosPorFrente(s, '2026-11-09', '2026-11-15').salud, 0);
  assert.deepEqual(Object.values(puntosPorFrente([], L, L)), [0, 0, 0, 0, 0, 0], 'sin sesiones: ceros reales');
});

test('Balance semana cerrada: objetivo completo, fórmula con tope por frente', () => {
  const s = [...Array(5).fill(0).map(() => ses('tanku', '2026-11-10T15:00:00Z')), ses('ticketcode', '2026-11-11T15:00:00Z')];
  const b = balanceSemana({ lunes: L, hoy: '2026-11-20', objetivos: obj({ tanku: 4, ticketcode: 4 }), sesiones: s });
  assert.equal(b.estado, 'ok'); assert.equal(b.enCurso, false);
  // tanku: min(1,5/4)=1 → 4; ticketcode: 1/4 → 1; B = 100*(4+1)/8 = 62.5 (el exceso de tanku no compensa)
  assert.equal(b.valor, 62.5);
  assert.equal(b.frentes.find(f => f.id === 'tanku').cumplimiento, 1);
});

test('Balance semana en curso: el denominador solo incluye los días transcurridos (incluido hoy)', () => {
  const s = [ses('tanku', '2026-11-09T15:00:00Z')];
  const b = balanceSemana({ lunes: L, hoy: '2026-11-10', objetivos: obj({ tanku: 7 }), sesiones: s });
  assert.equal(b.enCurso, true); assert.equal(b.diasElegibles, 2);
  assert.equal(b.frentes.find(f => f.id === 'tanku').objetivo, 2);   // 7/7 × 2 días
  assert.equal(b.valor, 50);                                          // 1 de 2
});

test('Balance: sin objetivos es «sin objetivo» (no 0 %), no hereda semanas anteriores y muestra puntos aparte', () => {
  const s = [ses('tanku', '2026-11-10T15:00:00Z')];
  const b = balanceSemana({ lunes: L, hoy: '2026-11-12', objetivos: { '2026-11-02': { tanku: 10 } }, sesiones: s });
  assert.equal(b.estado, 'sin_objetivo'); assert.equal(b.valor, null); assert.equal(b.puntosTotales, 1);
  assert.equal(b.frentes.find(f => f.id === 'tanku').cumplimiento, null);
});

test('Balance: frente con objetivo 0 o sin objetivo queda fuera del denominador y no penaliza', () => {
  const b = balanceSemana({ lunes: L, hoy: '2026-11-20', objetivos: obj({ tanku: 4, salud: 0 }), sesiones: [ses('tanku', '2026-11-10T15:00:00Z'), ses('personal', '2026-11-10T15:00:00Z')] });
  assert.equal(b.valor, 25);
  assert.equal(b.frentes.find(f => f.id === 'salud').cumplimiento, null);
  assert.equal(b.frentes.find(f => f.id === 'personal').cumplimiento, null);
});

test('Balance: semana futura aún no iniciada no calcula nada', () => {
  const b = balanceSemana({ lunes: '2026-11-16', hoy: '2026-11-10', objetivos: { '2026-11-16': { tanku: 5 } }, sesiones: [] });
  assert.equal(b.estado, 'no_iniciado'); assert.equal(b.valor, null);
});

test('Balance mensual: cada semana aporta solo los días del mes y las semanas sin objetivo no aportan', () => {
  // Noviembre 2026: semana del 26 oct aporta 1–1 nov... solo los días dentro del mes; la del 30 nov aporta 30 nov.
  const objetivos = { '2026-10-26': { tanku: 7 }, '2026-11-02': { tanku: 14 } };
  const b = balancePeriodo({ desde: '2026-11-01', hasta: '2026-11-30', hoy: '2026-12-05', objetivos, sesiones: [] });
  // 1 nov (domingo de la semana 26 oct): 7/7 = 1; 2–8 nov: 14 ; resto sin objetivo
  assert.equal(b.frentes.find(f => f.id === 'tanku').objetivo, 15);
  assert.equal(b.diasConObjetivo, 8);
  assert.equal(b.valor, 0);
});

test('Balance diario: objetivo semanal ÷ 7', () => {
  const b = balancePeriodo({ desde: '2026-11-10', hasta: '2026-11-10', hoy: '2026-11-10', objetivos: obj({ tanku: 14 }), sesiones: [ses('tanku', '2026-11-10T15:00:00Z')] });
  assert.equal(b.frentes.find(f => f.id === 'tanku').objetivo, 2);
  assert.equal(b.valor, 50);
});

test('objetivos por semana y semana cerrada', () => {
  assert.deepEqual(objetivosPorSemana([{ semana_inicio: L, frente_id: 'tanku', puntos: 3 }]), { [L]: { tanku: 3 } });
  assert.equal(semanaCerrada('2026-11-02', '2026-11-09'), true);
  assert.equal(semanaCerrada('2026-11-09', '2026-11-15'), false);
  assert.equal(lunesDe('2026-11-15'), '2026-11-09');
});
