// Pruebas de lib/domain/fechas.js: fechas con zona horaria de Colombia, con instantes fijos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  esFechaISO, fechaBogota, mesBogota, horaBogota, sumarDias, diasEntre, diaDeSemana,
  inicioSemana, diasDeLaSemana, ultimoDiaMes, etiquetaFecha, saludo,
} from '../lib/domain/fechas.js';

const d = iso => new Date(iso);

// ---- Hoy en Bogotá (UTC-5): el cambio de día ocurre a las 05:00 UTC ----
test('el día cambia a medianoche de Bogotá (05:00 UTC), no a medianoche UTC', () => {
  assert.equal(fechaBogota(d('2026-11-09T04:59:59Z')), '2026-11-08');
  assert.equal(fechaBogota(d('2026-11-09T05:00:00Z')), '2026-11-09');
  assert.equal(fechaBogota(d('2026-11-08T00:30:00Z')), '2026-11-07');
});

test('el cambio de año y de mes usan la hora de Bogotá', () => {
  assert.equal(fechaBogota(d('2027-01-01T04:59:59Z')), '2026-12-31');
  assert.equal(fechaBogota(d('2027-01-01T05:00:00Z')), '2027-01-01');
  assert.equal(mesBogota(d('2026-12-01T04:59:59Z')), '2026-11');
  assert.equal(mesBogota(d('2026-12-01T05:00:00Z')), '2026-12');
});

test('la hora de Bogotá va de 0 a 23', () => {
  assert.equal(horaBogota(d('2026-11-09T05:00:00Z')), 0);
  assert.equal(horaBogota(d('2026-11-08T23:30:00Z')), 18);
  assert.equal(horaBogota(d('2026-11-09T04:59:59Z')), 23);
  assert.equal(horaBogota(d('2026-11-08T17:00:00Z')), 12);
});

test('sin argumentos usa el instante actual y devuelve el formato esperado', () => {
  assert.match(fechaBogota(), /^\d{4}-\d{2}-\d{2}$/);
  assert.match(mesBogota(), /^\d{4}-\d{2}$/);
  assert.ok(horaBogota() >= 0 && horaBogota() <= 23);
});

// ---- Aritmética de calendario ----
test('sumarDias cruza mes, año y año bisiesto', () => {
  assert.equal(sumarDias('2026-12-31', 1), '2027-01-01');
  assert.equal(sumarDias('2028-02-28', 1), '2028-02-29');
  assert.equal(sumarDias('2027-02-28', 1), '2027-03-01');
  assert.equal(sumarDias('2026-03-01', -1), '2026-02-28');
  assert.equal(sumarDias('2026-11-08', 0), '2026-11-08');
  assert.equal(sumarDias('2026-11-08', 37), '2026-12-15');
});

test('diasEntre cuenta días de calendario (coincide con "vence en 37 d")', () => {
  assert.equal(diasEntre('2026-11-08', '2026-12-15'), 37);
  assert.equal(diasEntre('2026-11-08', '2026-11-08'), 0);
  assert.equal(diasEntre('2026-12-15', '2026-11-08'), -37);
  assert.equal(diasEntre('2026-12-31', '2027-01-01'), 1);
});

test('sumarDias y diasEntre son inversas en un rango amplio', () => {
  for (let n = -400; n <= 400; n += 7) assert.equal(diasEntre('2026-11-08', sumarDias('2026-11-08', n)), n, `n=${n}`);
});

test('ultimoDiaMes respeta los bisiestos y los siglos', () => {
  assert.equal(ultimoDiaMes(2026, 2), 28);
  assert.equal(ultimoDiaMes(2028, 2), 29);
  assert.equal(ultimoDiaMes(2100, 2), 28);
  assert.equal(ultimoDiaMes(2000, 2), 29);
  assert.equal(ultimoDiaMes(2026, 11), 30);
  assert.equal(ultimoDiaMes(2026, 12), 31);
});

// ---- Semana: empieza el lunes ----
test('el domingo 8 de noviembre de 2026 es el día 6 de la semana (lunes = 0)', () => {
  assert.equal(diaDeSemana('2026-11-08'), 6);
  assert.equal(diaDeSemana('2026-11-09'), 0);
  assert.equal(diaDeSemana('2026-11-11'), 2);
});

test('inicioSemana devuelve el lunes, también cuando cruza de mes', () => {
  assert.equal(inicioSemana('2026-11-08'), '2026-11-02');
  assert.equal(inicioSemana('2026-11-09'), '2026-11-09');
  assert.equal(inicioSemana('2026-12-02'), '2026-11-30');
});

test('diasDeLaSemana da los 7 días, de lunes a domingo', () => {
  assert.deepEqual(diasDeLaSemana('2026-11-08'), ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
  assert.equal(diasDeLaSemana('2026-12-31').at(-1), '2027-01-03');
});

// ---- Texto ----
test('etiquetaFecha escribe día y mes en español', () => {
  assert.equal(etiquetaFecha('2026-11-08'), 'Domingo, 8 de noviembre');
  assert.equal(etiquetaFecha('2026-11-09'), 'Lunes, 9 de noviembre');
  assert.equal(etiquetaFecha('2027-01-01'), 'Viernes, 1 de enero');
});

test('saludo según la hora de Bogotá, con sus bordes', () => {
  assert.equal(saludo(4), 'Buenas noches');
  assert.equal(saludo(5), 'Buenos días');
  assert.equal(saludo(11), 'Buenos días');
  assert.equal(saludo(12), 'Buenas tardes');
  assert.equal(saludo(18), 'Buenas tardes');
  assert.equal(saludo(19), 'Buenas noches');
  assert.equal(saludo(0), 'Buenas noches');
  assert.equal(saludo(23), 'Buenas noches');
});

// ---- Validación ----
test('esFechaISO acepta solo días reales con el formato exacto', () => {
  for (const ok of ['2026-11-08', '2028-02-29', '2026-12-31']) assert.ok(esFechaISO(ok), ok);
  for (const mal of ['2026-02-30', '2027-02-29', '2026-13-01', '2026-00-10', '2026-1-1', '2026-11-08T00:00', '', null, undefined, 20261108, {}]) {
    assert.ok(!esFechaISO(mal), String(mal));
  }
});

test('las funciones de calendario rechazan una fecha inválida en vez de devolver basura', () => {
  assert.throws(() => sumarDias('2026-02-30', 1), RangeError);
  assert.throws(() => diasEntre('hola', '2026-11-08'), RangeError);
  assert.throws(() => inicioSemana(''), RangeError);
  assert.throws(() => etiquetaFecha('2026-13-01'), RangeError);
  assert.throws(() => saludo(24), RangeError);
  assert.throws(() => saludo(1.5), RangeError);
});

// ---- Independencia de la zona horaria del equipo ----
test('el resultado no depende de la zona horaria del sistema donde corre', () => {
  const codigo = `
    import * as F from ${JSON.stringify(new URL('../lib/domain/fechas.js', import.meta.url).href)};
    const ahora = new Date('2026-11-09T04:59:59Z');
    console.log(JSON.stringify([F.fechaBogota(ahora), F.mesBogota(ahora), F.horaBogota(ahora), F.sumarDias('2026-12-31', 1),
      F.diasEntre('2026-11-08', '2026-12-15'), F.inicioSemana('2026-11-08'), F.etiquetaFecha('2026-11-08')]));`;
  const salidas = ['America/Bogota', 'Asia/Tokyo', 'Pacific/Auckland', 'America/Los_Angeles', 'UTC'].map(TZ =>
    execFileSync(process.execPath, ['--no-warnings', '--input-type=module', '-e', codigo], { env: { ...process.env, TZ }, encoding: 'utf8' }).trim());
  assert.equal(new Set(salidas).size, 1, `distintas según la zona: ${salidas.join(' | ')}`);
  assert.equal(salidas[0], JSON.stringify(['2026-11-08', '2026-11', 23, '2027-01-01', 37, '2026-11-02', 'Domingo, 8 de noviembre']));
});
