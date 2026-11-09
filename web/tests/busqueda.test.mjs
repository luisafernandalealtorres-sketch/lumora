import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizar, puntuar, buscar } from '../lib/domain/busqueda.js';
import { ELEMENTOS } from '../lib/domain/navegacion.js';

test('normalizar: acentos, mayúsculas, signos y espacios', () => {
  assert.equal(normalizar('  Mi   DÍA!! '), 'mi dia');
  assert.equal(normalizar(null), '');
  assert.equal(normalizar('Reflexión'), 'reflexion');
});

test('puntuar: exacto > prefijo > palabra > contiene > clave', () => {
  const c = { nombre: 'Mi día', claves: ['hoy'] };
  assert.equal(puntuar(c, 'mi dia'), 100);
  assert.equal(puntuar(c, 'mi'), 80);
  assert.equal(puntuar(c, 'dia'), 60);
  assert.equal(puntuar({ nombre: 'Finanzas' }, 'nan'), 40);
  assert.equal(puntuar(c, 'hoy'), 30);
  assert.equal(puntuar(c, 'xyz'), 0);
});

test('consulta vacía devuelve todo en el orden original', () => {
  const lista = [{ nombre: 'B' }, { nombre: 'A' }, { nombre: 'C' }];
  assert.deepEqual(buscar(lista, '').map(x => x.nombre), ['B', 'A', 'C']);
  assert.deepEqual(buscar(lista, '   ').map(x => x.nombre), ['B', 'A', 'C']);
});

test('buscar sobre la navegación real', () => {
  const nav = ELEMENTOS.filter(e => !e.soloDesarrollo);
  assert.equal(buscar(nav, 'GASTOS')[0].id, 'gastos');
  assert.equal(buscar(nav, 'plata')[0].id, 'finanzas');
  assert.equal(buscar(nav, 'jornada')[0].id, 'jornada');
  assert.equal(buscar(nav, 'inteligencia')[0].id, 'asistente');
  assert.deepEqual(buscar(nav, 'zzzz'), []);
});

test('el orden es estable en empates', () => {
  const lista = [{ nombre: 'Casa uno' }, { nombre: 'Casa dos' }];
  assert.deepEqual(buscar(lista, 'casa').map(x => x.nombre), ['Casa uno', 'Casa dos']);
});
