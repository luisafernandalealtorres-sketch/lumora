// Pruebas de lib/ui/estados.js. Regla central: un error nunca se muestra como vacío.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ESTADOS, esEstado, esVacio, estadoDeConsulta, resolverEstado } from '../lib/ui/estados.js';

test('existen los cinco estados de la especificación', () => {
  assert.deepEqual([...ESTADOS].sort(), ['cargando', 'error', 'ok', 'parcial', 'vacio']);
  assert.ok(esEstado('parcial'));
  assert.ok(!esEstado('roto'));
});

test('esVacio: null, undefined, texto vacío, arreglo y objeto vacíos', () => {
  for (const d of [null, undefined, '', [], {}]) assert.ok(esVacio(d), JSON.stringify(d));
});

test('esVacio: el 0, false y cualquier contenido son datos, no vacío', () => {
  for (const d of [0, false, [0], [null], { a: 1 }, 'x', 5]) assert.ok(!esVacio(d), JSON.stringify(d));
});

test('un ERROR con datos vacíos es "error", nunca "vacio"', () => {
  assert.equal(estadoDeConsulta({ error: new Error('x'), datos: [] }), 'error');
  assert.equal(estadoDeConsulta({ error: { message: 'permission denied' }, datos: null }), 'error');
  assert.equal(estadoDeConsulta({ error: 'fallo' }), 'error');
});

test('sin error, datos vacíos son "vacio"', () => {
  assert.equal(estadoDeConsulta({ datos: [] }), 'vacio');
  assert.equal(estadoDeConsulta({ datos: null }), 'vacio');
  assert.equal(estadoDeConsulta({}), 'vacio');
  assert.equal(estadoDeConsulta(), 'vacio');
});

test('cargando manda, también cuando se reintenta tras un error', () => {
  assert.equal(estadoDeConsulta({ cargando: true, datos: [] }), 'cargando');
  assert.equal(estadoDeConsulta({ cargando: true, error: 'fallo anterior', datos: [] }), 'cargando');
});

test('con datos es "ok", o "parcial" si se indica', () => {
  assert.equal(estadoDeConsulta({ datos: [1, 2] }), 'ok');
  assert.equal(estadoDeConsulta({ datos: { a: 1 } }), 'ok');
  assert.equal(estadoDeConsulta({ datos: [1], parcial: true }), 'parcial');
});

test('un 0 devuelto por una consulta es un dato válido, no un vacío', () => {
  assert.equal(estadoDeConsulta({ datos: 0 }), 'ok');
});

test('un parcial sin datos es vacío: no hay nada que mostrar', () => {
  assert.equal(estadoDeConsulta({ datos: [], parcial: true }), 'vacio');
});

test('un estado desconocido falla de forma visible, nunca como vacío', () => {
  assert.equal(resolverEstado('roto'), 'error');
  assert.equal(resolverEstado(undefined), 'error');
  assert.equal(resolverEstado(null), 'error');
  assert.equal(resolverEstado('vacio'), 'vacio');
  assert.equal(resolverEstado('parcial'), 'parcial');
});

test('todos los estados válidos se conservan tal cual', () => {
  for (const e of ESTADOS) assert.equal(resolverEstado(e), e);
});
