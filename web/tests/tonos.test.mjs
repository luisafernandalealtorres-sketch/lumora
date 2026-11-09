// Pruebas de lib/ui/tonos.js: tonos de estado y de frente para chips y barras.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TONOS, TONOS_ESTADO, TONOS_FRENTE, esTono, resolverTono, nombreDeFrente } from '../lib/ui/tonos.js';

test('hay 5 tonos de estado y 6 de frente, sin repetidos', () => {
  assert.equal(TONOS_ESTADO.length, 5);
  assert.equal(TONOS_FRENTE.length, 6);
  assert.equal(new Set(TONOS).size, 11);
});

test('los tonos de frente coinciden con los seis frentes de diseño', () => {
  assert.deepEqual([...TONOS_FRENTE].sort(), ['familia', 'otros', 'personal', 'salud', 'ticketcode', 'tanku'].sort());
});

test('un tono explícito y válido gana', () => {
  assert.equal(resolverTono({ tono: 'exito' }), 'exito');
  assert.equal(resolverTono({ tono: 'familia', frente: 'tanku' }), 'familia');
});

test('un tono explícito inválido cae en neutro y no se sustituye por el frente', () => {
  assert.equal(resolverTono({ tono: 'rojo' }), 'neutro');
  assert.equal(resolverTono({ tono: 'rojo', frente: 'tanku' }), 'neutro');
});

test('un slug original se traduce a su frente de diseño', () => {
  assert.equal(resolverTono({ frente: 'salud-abuela' }), 'familia');
  assert.equal(resolverTono({ frente: 'jardin' }), 'familia');
  assert.equal(resolverTono({ frente: 'ticketcode-eve' }), 'ticketcode');
  assert.equal(resolverTono({ frente: 'hogar' }), 'personal');
  assert.equal(resolverTono({ frente: 'hama' }), 'otros');
  assert.equal(resolverTono({ frente: 'salud' }), 'salud');
});

test('un id de diseño también se acepta', () => {
  assert.equal(resolverTono({ frente: 'familia' }), 'familia');
  assert.equal(resolverTono({ frente: 'otros' }), 'otros');
});

test('la salud de la abuela nunca usa el tono de Salud', () => {
  assert.notEqual(resolverTono({ frente: 'salud-abuela' }), 'salud');
});

test('un frente desconocido usa tono neutro: no se le inventa un color', () => {
  assert.equal(resolverTono({ frente: 'slug-nuevo-no-mapeado' }), 'neutro');
  assert.equal(resolverTono({ frente: 'sin-asignar' }), 'neutro');
});

test('sin argumentos el tono es neutro', () => {
  assert.equal(resolverTono(), 'neutro');
  assert.equal(resolverTono({}), 'neutro');
});

test('esTono reconoce solo los tonos definidos', () => {
  assert.ok(esTono('peligro'));
  assert.ok(esTono('otros'));
  assert.ok(!esTono('morado'));
  assert.ok(!esTono(undefined));
});

test('nombreDeFrente devuelve el nombre del frente de diseño', () => {
  assert.equal(nombreDeFrente('salud-abuela'), 'Familia');
  assert.equal(nombreDeFrente('otros'), 'Otros proyectos');
  assert.equal(nombreDeFrente('slug-raro'), 'Sin asignar');
  assert.equal(nombreDeFrente(undefined), '');
});
