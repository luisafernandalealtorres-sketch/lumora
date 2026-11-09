import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PARAMETRO, MODULOS_CON_FILTRO, frenteDeParametro, frenteDeBusqueda, busquedaConFrente, enlaceConFrente, aplicaFiltro, nombreFrenteActivo,
} from '../lib/domain/frenteActivo.js';
import { FRENTES_DISENO } from '../lib/domain/frentesMap.js';

test('los seis frentes son válidos; lo demás se ignora', () => {
  assert.equal(FRENTES_DISENO.length, 6);
  for (const f of FRENTES_DISENO) assert.equal(frenteDeParametro(f.id), f.id);
  for (const malo of ['todos', 'sin-asignar', 'TANKU', '', null, undefined, 5, 'hama', '<x>']) assert.equal(frenteDeParametro(malo), null);
});

test('lee el frente de la cadena de consulta', () => {
  assert.equal(frenteDeBusqueda('?frente=tanku'), 'tanku');
  assert.equal(frenteDeBusqueda('frente=familia&x=1'), 'familia');
  assert.equal(frenteDeBusqueda('?frente=raro'), null);
  assert.equal(frenteDeBusqueda(''), null);
  assert.equal(frenteDeBusqueda(undefined), null);
});

test('poner y quitar el frente conserva los demás parámetros', () => {
  assert.equal(busquedaConFrente('', 'salud'), '?frente=salud');
  assert.equal(busquedaConFrente('?mes=2026-11', 'tanku'), '?mes=2026-11&frente=tanku');
  assert.equal(busquedaConFrente('?frente=tanku&mes=2026-11', 'otros'), '?frente=otros&mes=2026-11');
  assert.equal(busquedaConFrente('?frente=tanku', null), '');
  assert.equal(busquedaConFrente('?frente=tanku&mes=1', 'todos'), '?mes=1');
});

test('enlaceConFrente conserva el frente y no inventa uno', () => {
  assert.equal(enlaceConFrente('/metas', 'tanku'), '/metas?frente=tanku');
  assert.equal(enlaceConFrente('/metas', null), '/metas');
  assert.equal(enlaceConFrente('/metas', 'basura'), '/metas');
  assert.equal(PARAMETRO, 'frente');
});

test('ningún módulo heredado aplica el filtro todavía (no se simula filtrado)', () => {
  assert.deepEqual(MODULOS_CON_FILTRO, []);
  for (const id of ['mi-dia', 'panel', 'metas', 'finanzas', 'gastos', 'salud', 'jornada', 'biblioteca', 'cerebro']) assert.equal(aplicaFiltro(id), false);
});

test('nombre del frente activo', () => {
  assert.equal(nombreFrenteActivo('familia'), 'Familia');
  assert.equal(nombreFrenteActivo('otros'), 'Otros proyectos');
  assert.equal(nombreFrenteActivo('x'), null);
});
