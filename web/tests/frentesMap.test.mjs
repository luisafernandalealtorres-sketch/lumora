// Pruebas del mapeo visual de frentes (web/lib/domain/frentesMap.js).
// Ejecutar: npm test   (desde la carpeta web)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../lib/domain/frentesMap.js';

// Slugs reales de la tabla `frentes` (9 originales + salud). Si cambian en la base, actualizar aquí.
const SLUGS_BASE = ['ticketcode-eventos', 'ticketcode-eve', 'tanku', 'hama', 'crochet', 'jardin', 'salud-abuela', 'hogar', 'personal', 'salud'];

// Mapeo aprobado el 8 nov 2026 (docs/MAPEO-FRENTES.md).
const APROBADO = {
  'ticketcode-eventos': 'TICKETCODE', 'ticketcode-eve': 'TICKETCODE', tanku: 'TANKU',
  personal: 'Personal', hogar: 'Personal', jardin: 'Familia', 'salud-abuela': 'Familia',
  hama: 'Otros proyectos', crochet: 'Otros proyectos', salud: 'Salud',
};

const ids = r => r.map(x => x.id).sort((a, b) => a - b);
const regs = Object.freeze([
  Object.freeze({ id: 1, frente: 'salud-abuela' }), Object.freeze({ id: 2, frente: 'jardin' }),
  Object.freeze({ id: 3, frente: 'ticketcode-eve' }), Object.freeze({ id: 4, frente: 'ticketcode-eventos' }),
  Object.freeze({ id: 5, frente: 'hama' }), Object.freeze({ id: 6, frente: 'salud' }),
  Object.freeze({ id: 7, frente: 'slug-nuevo-no-mapeado' }), Object.freeze({ id: 8, frente: null }),
]);

test('devuelve los seis frentes de diseño, en el orden de la especificación', () => {
  assert.deepEqual(M.FRENTES_DISENO.map(f => f.nombre), ['TANKU', 'TICKETCODE', 'Personal', 'Salud', 'Familia', 'Otros proyectos']);
});

for (const [slug, esperado] of Object.entries(APROBADO)) {
  test(`el slug "${slug}" pertenece a ${esperado}`, () => assert.equal(M.nombreFrenteDeSlug(slug), esperado));
}

test('los slugs de la base quedan todos asignados (sin huérfanos, sin fantasmas, sin duplicados)', () => {
  assert.deepEqual(M.revisarMapa(SLUGS_BASE), { sinAsignar: [], fantasma: [], duplicados: [] });
});

test('salud-abuela está en Familia y NO en Salud', () => {
  assert.ok(M.slugsDeFrente('familia').includes('salud-abuela'));
  assert.ok(!M.slugsDeFrente('salud').includes('salud-abuela'));
});

test('Salud contiene únicamente el slug "salud"', () => assert.deepEqual(M.slugsDeFrente('salud'), ['salud']));
test('Familia agrupa jardin y salud-abuela', () => assert.deepEqual(M.slugsDeFrente('familia').sort(), ['jardin', 'salud-abuela']));

test('slugsDeFrente devuelve una copia: editarla no altera el mapa', () => {
  const a = M.slugsDeFrente('ticketcode');
  a.push('x');
  assert.deepEqual(M.slugsDeFrente('ticketcode'), ['ticketcode-eventos', 'ticketcode-eve']);
});

test('filtro con varios slugs: Familia', () => assert.deepEqual(ids(M.filtrarPorFrente(regs, 'familia')), [1, 2]));
test('filtro con varios slugs: TICKETCODE', () => assert.deepEqual(ids(M.filtrarPorFrente(regs, 'ticketcode')), [3, 4]));
test('filtro Salud devuelve solo el slug salud, no el de la abuela', () => assert.deepEqual(ids(M.filtrarPorFrente(regs, 'salud')), [6]));
test('filtro "todos" no pierde registros', () => assert.equal(M.filtrarPorFrente(regs, 'todos').length, 8));
test('filtro vacío no pierde registros', () => assert.equal(M.filtrarPorFrente(regs, '').length, 8));
test('slug desconocido y slug nulo caen en "Sin asignar" y no desaparecen', () => {
  assert.deepEqual(ids(M.filtrarPorFrente(regs, 'sin-asignar')), [7, 8]);
});
test('un slug desconocido nunca se reasigna a otro frente', () => {
  assert.equal(M.frenteDeSlug('slug-nuevo-no-mapeado').id, 'sin-asignar');
});

test('agruparPorFrente conserva todos los registros', () => {
  assert.equal(M.agruparPorFrente(regs).reduce((s, g) => s + g.registros.length, 0), 8);
});
test('agruparPorFrente agrega "Sin asignar" solo cuando hace falta', () => {
  assert.equal(M.agruparPorFrente(regs).at(-1).frente.nombre, 'Sin asignar');
  assert.ok(!M.agruparPorFrente(regs.slice(0, 6)).some(g => g.frente.id === 'sin-asignar'));
});
test('slugsDeFrente("sin-asignar") devuelve solo los slugs no contemplados', () => {
  assert.deepEqual(M.slugsDeFrente('sin-asignar', [...SLUGS_BASE, 'otro']), ['otro']);
});
test('revisarMapa detecta un slug nuevo de la base como sin asignar', () => {
  assert.deepEqual(M.revisarMapa([...SLUGS_BASE, 'nuevo']).sinAsignar, ['nuevo']);
});
test('agruparFrentes (selectores) conserva los 10 frentes', () => {
  const filas = SLUGS_BASE.map(s => ({ slug: s, nombre: s }));
  assert.equal(M.agruparFrentes(filas).reduce((s, g) => s + g.frentes.length, 0), 10);
});
test('no modifica los registros recibidos (los slugs originales se conservan)', () => {
  M.filtrarPorFrente(regs, 'familia');
  M.agruparPorFrente(regs);
  assert.deepEqual(regs.map(r => r.frente), ['salud-abuela', 'jardin', 'ticketcode-eve', 'ticketcode-eventos', 'hama', 'salud', 'slug-nuevo-no-mapeado', null]);
});
