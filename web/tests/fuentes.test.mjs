import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FUENTES_HOME, estadoFuente, mensajeVacio, TEXTO_NO_CONECTADA } from '../lib/domain/fuentes.js';

const conectada = { ...FUENTES_HOME.agenda, conectada: true };

test('hoy ninguna fuente de Home está conectada (nada escribe en agenda_hoy, correos_hoy ni resumen_dia)', () => {
  for (const f of Object.values(FUENTES_HOME)) assert.equal(f.conectada, false, f.id);
  assert.deepEqual(Object.values(FUENTES_HOME).map(f => f.tabla).sort(), ['agenda_hoy', 'correos_hoy', 'resumen_dia']);
});

test('una fuente sin escritor y sin filas es «no conectada», no «sin eventos»', () => {
  const e = estadoFuente({ fuente: FUENTES_HOME.agenda, filas: [] });
  assert.equal(e.estado, 'no_conectada');
  assert.equal(mensajeVacio(e).titulo, TEXTO_NO_CONECTADA);
  assert.match(mensajeVacio(e).detalle, /tablero/);
  assert.equal(estadoFuente({ fuente: FUENTES_HOME.resumen, filas: null }).estado, 'no_conectada');
});

test('una fuente conectada y vacía sí es un vacío real («sin registros»)', () => {
  const e = estadoFuente({ fuente: conectada, filas: [] });
  assert.equal(e.estado, 'sin_registros');
  assert.equal(mensajeVacio(e).titulo, 'Sin eventos hoy.');
});

test('si hay filas se muestran aunque la fuente figure como no conectada (las filas prueban que algo escribe)', () => {
  assert.equal(estadoFuente({ fuente: FUENTES_HOME.agenda, filas: [{ id: 1 }] }).estado, 'datos');
  assert.equal(estadoFuente({ fuente: FUENTES_HOME.resumen, filas: { texto: 'hola' } }).estado, 'datos');
  assert.equal(mensajeVacio(estadoFuente({ fuente: FUENTES_HOME.agenda, filas: [{ id: 1 }] })), null);
});

test('un error de lectura nunca se convierte en vacío ni en «no conectada»', () => {
  assert.equal(estadoFuente({ fuente: FUENTES_HOME.agenda, filas: [], error: new Error('x') }).estado, 'error');
  assert.equal(mensajeVacio(estadoFuente({ fuente: FUENTES_HOME.agenda, filas: null, error: 'x' })), null);
});

test('Home usa estadoFuente para agenda, correos y resumen y no afirma «Sin eventos» ni «Sin correos» por su cuenta', () => {
  const src = readFileSync(new URL('../components/home/HomeApp.js', import.meta.url), 'utf8');
  for (const k of ['agenda', 'correos', 'resumen']) assert.match(src, new RegExp('FUENTES_HOME\.' + k), k);
  for (const f of ['../components/home/HomeApp.js', '../components/home/HoyPrioridades.js', '../components/home/Bloques.js', '../app/(app)/page.js']) {
    const s = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.ok(!s.includes('Sin eventos hoy'), f);
    assert.ok(!s.includes('Sin correos por revisar'), f);
    assert.ok(!s.includes('cuando se actualiza a las 6:00'), f);
  }
});

test('el componente muestra «Fuente no conectada» y explica que no significa un día vacío', () => {
  const src = readFileSync(new URL('../components/home/EstadoFuente.js', import.meta.url), 'utf8');
  assert.match(src, /mensajeVacio/);
  assert.match(src, /Esto no significa que no tengas/);
});
