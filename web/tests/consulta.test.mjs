// Pruebas de lib/consulta.js: distinguir un error real de una consulta de un estado vacío.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificar } from '../lib/consulta.js';

test('un resultado vacío legítimo (data [] sin error) no lanza', () => {
  assert.doesNotThrow(() => verificar({ pendientes: { data: [], error: null } }));
});
test('data nula sin error no lanza', () => {
  assert.doesNotThrow(() => verificar({ gastos: { data: null, error: null } }));
});
test('una respuesta con count y sin error no lanza', () => {
  assert.doesNotThrow(() => verificar({ biblioteca: { count: 0, error: null } }));
});
test('un error real de consulta lanza e indica qué consulta falló', () => {
  assert.throws(() => verificar({ notas: { data: null, error: { message: 'permission denied' } } }),
    /No se pudo cargar "notas": permission denied/);
});
test('un error entre varias respuestas también lanza', () => {
  assert.throws(() => verificar({ a: { data: [1], error: null }, b: { data: null, error: { message: 'timeout' } } }),
    /"b": timeout/);
});
