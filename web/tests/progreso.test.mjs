// Pruebas de lib/ui/progreso.js: un valor ausente o inválido es "sin datos", nunca 0 %.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarProgreso, textoProgreso } from '../lib/ui/progreso.js';

test('valores válidos de 0 a 1 dan su porcentaje redondeado', () => {
  assert.deepEqual(normalizarProgreso(0.35), { estado: 'ok', fraccion: 0.35, porcentaje: 35 });
  assert.deepEqual(normalizarProgreso(1), { estado: 'ok', fraccion: 1, porcentaje: 100 });
  assert.equal(normalizarProgreso(0.666).porcentaje, 67);
});

test('un cero REAL es 0 %, no "sin datos"', () => {
  assert.deepEqual(normalizarProgreso(0), { estado: 'ok', fraccion: 0, porcentaje: 0 });
});

test('null y undefined son "sin datos", no 0 %', () => {
  for (const v of [null, undefined]) {
    assert.deepEqual(normalizarProgreso(v), { estado: 'sin-datos', fraccion: null, porcentaje: null });
  }
});

test('NaN, infinitos, texto y objetos son "sin datos"', () => {
  for (const v of [NaN, Infinity, -Infinity, '0.5', '', {}, [], true]) {
    assert.equal(normalizarProgreso(v).estado, 'sin-datos', String(v));
  }
});

test('valores fuera de rango se acotan a 0 y 1', () => {
  assert.equal(normalizarProgreso(1.7).porcentaje, 100);
  assert.equal(normalizarProgreso(-0.4).porcentaje, 0);
  assert.equal(normalizarProgreso(-0.4).estado, 'ok');
});

test('el texto para lectores de pantalla distingue 0 % de "Sin datos"', () => {
  assert.equal(textoProgreso(0), '0 %');
  assert.equal(textoProgreso(0.5), '50 %');
  assert.equal(textoProgreso(null), 'Sin datos');
  assert.equal(textoProgreso(NaN), 'Sin datos');
});

test('nunca devuelve NaN en ningún campo', () => {
  for (const v of [0, 0.2, 1, 5, -5, null, undefined, NaN, 'x']) {
    const r = normalizarProgreso(v);
    for (const campo of [r.fraccion, r.porcentaje]) assert.ok(campo === null || Number.isFinite(campo), String(v));
  }
});
