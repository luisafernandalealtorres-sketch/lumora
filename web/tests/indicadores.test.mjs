// Pruebas de lib/domain/indicadores.js: el contrato de indicador de Life Pulse.
// Regla central: sin datos suficientes, el valor es null. Nunca se inventa un número.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Modulo from '../lib/domain/indicadores.js';
import { AREAS_LIFE_PULSE, ESTADOS_INDICADOR, crearIndicador, validarIndicador, aFraccion } from '../lib/domain/indicadores.js';
import { normalizarProgreso } from '../lib/ui/progreso.js';

const base = { id: 'finanzas', nombre: 'Finanzas', valor: 76.4, muestra: 5, minimo: 3, formula: 'Ejemplo de fórmula', fuentes: ['gastos', 'presupuestos'] };

test('las seis áreas de Life Pulse de la especificación', () => {
  assert.deepEqual(AREAS_LIFE_PULSE.map(a => a.id), ['trabajo', 'finanzas', 'salud', 'metas', 'personal', 'familia']);
});

test('un indicador con muestra suficiente es "ok", con el valor redondeado', () => {
  const i = crearIndicador(base);
  assert.equal(i.estado, 'ok');
  assert.equal(i.valor, 76);
  assert.deepEqual(validarIndicador(i), []);
});

test('con menos muestra que el mínimo es "sin-datos" y el valor es null, aunque haya un número', () => {
  const i = crearIndicador({ ...base, muestra: 2, minimo: 3 });
  assert.equal(i.estado, 'sin-datos');
  assert.equal(i.valor, null);
  assert.deepEqual(validarIndicador(i), []);
});

test('un valor ausente o inválido es "sin-datos", nunca 0', () => {
  for (const valor of [null, undefined, NaN, Infinity, '76', {}]) {
    const i = crearIndicador({ ...base, valor });
    assert.equal(i.estado, 'sin-datos', String(valor));
    assert.equal(i.valor, null, String(valor));
  }
});

test('una muestra o un mínimo inválidos dan "sin-datos"', () => {
  assert.equal(crearIndicador({ ...base, muestra: NaN }).estado, 'sin-datos');
  assert.equal(crearIndicador({ ...base, minimo: undefined }).estado, 'sin-datos');
  assert.equal(crearIndicador({ ...base, muestra: undefined }).valor, null);
});

test('un cero REAL con muestra suficiente es 0 %, no "sin datos"', () => {
  const i = crearIndicador({ ...base, valor: 0 });
  assert.equal(i.estado, 'ok');
  assert.equal(i.valor, 0);
  assert.equal(aFraccion(i), 0);
});

test('el valor se acota de 0 a 100', () => {
  assert.equal(crearIndicador({ ...base, valor: 140 }).valor, 100);
  assert.equal(crearIndicador({ ...base, valor: -5 }).valor, 0);
});

test('con fuentes incompletas es "parcial" y conserva el valor', () => {
  const i = crearIndicador({ ...base, completo: false });
  assert.equal(i.estado, 'parcial');
  assert.equal(i.valor, 76);
  assert.deepEqual(validarIndicador(i), []);
});

test('un parcial sin muestra suficiente sigue siendo "sin-datos"', () => {
  const i = crearIndicador({ ...base, completo: false, muestra: 1 });
  assert.equal(i.estado, 'sin-datos');
  assert.equal(i.valor, null);
});

test('un error de lectura es "error" y el valor es null, aunque llegue un número', () => {
  const i = crearIndicador({ ...base, error: true });
  assert.equal(i.estado, 'error');
  assert.equal(i.valor, null);
});

test('un error nunca se presenta como "sin-datos"', () => {
  assert.notEqual(crearIndicador({ ...base, error: true, muestra: 0 }).estado, 'sin-datos');
});

test('el indicador guarda una copia de las fuentes: cambiar el original no lo altera', () => {
  const fuentes = ['gastos'];
  const i = crearIndicador({ ...base, fuentes });
  fuentes.push('otra');
  assert.deepEqual(i.fuentes, ['gastos']);
});

test('validarIndicador detecta cada incumplimiento del contrato', () => {
  const bueno = crearIndicador(base);
  const hay = (mod, texto) => assert.ok(validarIndicador({ ...bueno, ...mod }).some(p => p.includes(texto)), `no detectó: ${texto}`);
  hay({ id: 'inventada' }, 'id desconocido');
  hay({ nombre: '  ' }, 'nombre');
  hay({ estado: 'raro' }, 'estado inválido');
  hay({ valor: 150 }, 'entre 0 y 100');
  hay({ valor: null }, 'entre 0 y 100');
  hay({ formula: '' }, 'fórmula');
  hay({ fuentes: [] }, 'fuentes');
  hay({ fuentes: ['ok', ''] }, 'fuentes');
  hay({ muestra: 1, minimo: 3 }, 'menos muestra');
  hay({ estado: 'sin-datos', valor: 50 }, 'valor debe ser null');
  assert.deepEqual(validarIndicador(null), ['no es un objeto']);
});

test('aFraccion entrega 0 a 1 para Ring y ProgressBar, o null si no hay valor', () => {
  assert.equal(aFraccion(crearIndicador(base)), 0.76);
  assert.equal(aFraccion(crearIndicador({ ...base, completo: false })), 0.76);
  assert.equal(aFraccion(crearIndicador({ ...base, muestra: 0 })), null);
  assert.equal(aFraccion(crearIndicador({ ...base, error: true })), null);
  assert.equal(aFraccion(null), null);
  assert.equal(aFraccion(undefined), null);
});

test('encaja con los componentes: un indicador sin valor se dibuja como "sin datos", nunca como 0 %', () => {
  assert.equal(normalizarProgreso(aFraccion(crearIndicador({ ...base, muestra: 0 }))).estado, 'sin-datos');
  assert.equal(normalizarProgreso(aFraccion(crearIndicador(base))).estado, 'ok');
  assert.equal(normalizarProgreso(aFraccion(crearIndicador({ ...base, valor: 0 }))).estado, 'ok');
});

test('NO existe un indicador global de equilibrio personal (pendiente de una metodología aprobada)', () => {
  const nombres = Object.keys(Modulo);
  assert.ok(!nombres.some(n => /global|equilibrio|promedio|total/i.test(n)), nombres.join(', '));
  assert.deepEqual([...ESTADOS_INDICADOR].sort(), ['error', 'ok', 'parcial', 'sin-datos']);
});
