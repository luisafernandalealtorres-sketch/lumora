import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validarPendiente, validarGasto, validarNota, validarIdea, crearPendiente, alternarPendiente, registrarGasto, crearNota,
} from '../lib/data/acciones.js';

function grabador(respuesta = { data: { id: 'x' }, error: null }) {
  const llamadas = [];
  const b = tabla => { const q = { tabla }; const api = { insert(v) { q.insert = v; return api; }, update(v) { q.update = v; return api; }, eq(c, v) { q.eq = [c, v]; return api; }, select() { return api; }, single: async () => { llamadas.push(q); return respuesta; } }; return api; };
  return { llamadas, from: b };
}

test('validación de pendiente: texto y frente obligatorios, fecha opcional válida', () => {
  assert.equal(validarPendiente({ texto: '  ', frente: 'tanku' }).ok, false);
  assert.equal(validarPendiente({ texto: 'A', frente: '' }).ok, false);
  assert.equal(validarPendiente({ texto: 'A', frente: 'tanku', fechaLimite: '12/11' }).ok, false);
  assert.deepEqual(validarPendiente({ texto: ' A ', frente: 'tanku', fechaLimite: '2026-11-12' }).valor, { texto: 'A', frente: 'tanku', fecha_limite: '2026-11-12' });
  assert.equal(validarPendiente({ texto: 'A', frente: 'tanku' }).valor.fecha_limite, null);
});

test('validación de gasto: lugar y valor, fecha, categoría conocida y frente; el valor se limpia a pesos enteros', () => {
  const ok = validarGasto({ fecha: '2026-11-10', lugar: ' Éxito ', categoria: 'Comida', valor: '$ 45.900', frente: 'personal' });
  assert.deepEqual(ok.valor, { fecha: '2026-11-10', lugar: 'Éxito', categoria: 'Comida', valor_cop: 45900, frente: 'personal' });
  assert.equal(validarGasto({ fecha: '2026-11-10', lugar: '', categoria: 'Comida', valor: '5', frente: 'personal' }).ok, false);
  assert.equal(validarGasto({ fecha: '2026-11-10', lugar: 'X', categoria: 'Comida', valor: '0', frente: 'personal' }).ok, false);
  assert.equal(validarGasto({ fecha: 'hoy', lugar: 'X', categoria: 'Comida', valor: '5', frente: 'personal' }).ok, false);
  assert.equal(validarGasto({ fecha: '2026-11-10', lugar: 'X', categoria: 'Inventada', valor: '5', frente: 'personal' }).ok, false);
});

test('nota e idea: título obligatorio, etiquetas limpias; una idea lleva la etiqueta «idea» y un título corto', () => {
  assert.equal(validarNota({ titulo: '', frente: 'tanku' }).ok, false);
  assert.deepEqual(validarNota({ titulo: ' N ', contenido: '', frente: 'tanku', etiquetas: ['#A', 'a', ' b '] }).valor, { titulo: 'N', contenido: null, etiquetas: ['a', 'b'], frente: 'tanku' });
  assert.equal(validarIdea({ texto: ' ', frente: 'tanku' }).ok, false);
  const corta = validarIdea({ texto: 'Usar EVE para TANKU', frente: 'tanku' }).valor;
  assert.deepEqual([corta.titulo, corta.contenido, corta.etiquetas], ['Usar EVE para TANKU', null, ['idea']]);
  const larga = validarIdea({ texto: 'x'.repeat(120), frente: 'tanku' }).valor;
  assert.ok(larga.titulo.length <= 70 && larga.contenido.length === 120);
});

test('las escrituras usan las tablas y columnas de los módulos heredados', async () => {
  const c = grabador();
  await crearPendiente(c, { texto: 'A', frente: 'tanku', fecha_limite: null });
  await registrarGasto(c, { fecha: '2026-11-10', lugar: 'X', categoria: 'Comida', valor_cop: 5, frente: 'personal' });
  await crearNota(c, { titulo: 'N', contenido: null, etiquetas: [], frente: 'tanku' }, () => '2026-11-10T00:00:00Z');
  assert.deepEqual(c.llamadas.map(l => l.tabla), ['pendientes', 'gastos', 'notas']);
  assert.deepEqual(Object.keys(c.llamadas[0].insert).sort(), ['fecha_limite', 'frente', 'meta_id', 'texto']);
  assert.deepEqual(Object.keys(c.llamadas[1].insert).sort(), ['categoria', 'fecha', 'frente', 'lugar', 'valor_cop']);
  assert.deepEqual(Object.keys(c.llamadas[2].insert).sort(), ['actualizado_en', 'contenido', 'etiquetas', 'frente', 'titulo']);
  // Coinciden con lo que escriben los módulos heredados
  const gastos = readFileSync(new URL('../components/Gastos.js', import.meta.url), 'utf8');
  assert.match(gastos, /fecha: f\.fecha, lugar: .*categoria: f\.categoria, valor_cop: valor, frente: f\.frente/);
  const cerebro = readFileSync(new URL('../components/Cerebro.js', import.meta.url), 'utf8');
  assert.match(cerebro, /titulo: f\.titulo\.trim\(\).*contenido:.*etiquetas:.*frente: f\.frente, actualizado_en/s);
});

test('alternar pendiente marca hecho_en al completar y lo limpia al desmarcar, como el módulo heredado', async () => {
  const c = grabador();
  await alternarPendiente(c, { id: 'p1', hecho: false }, () => '2026-11-10T15:00:00Z');
  await alternarPendiente(c, { id: 'p1', hecho: true });
  assert.deepEqual(c.llamadas[0].update, { hecho: true, hecho_en: '2026-11-10T15:00:00Z' });
  assert.deepEqual(c.llamadas[1].update, { hecho: false, hecho_en: null });
  assert.deepEqual(c.llamadas[0].eq, ['id', 'p1']);
});

test('un error de la base se propaga (no se confunde con éxito)', async () => {
  const c = grabador({ data: null, error: { message: 'permission denied' } });
  await assert.rejects(() => crearPendiente(c, { texto: 'A', frente: 'tanku', fecha_limite: null }), e => e.message === 'permission denied');
});

test('las acciones no escriben en agenda, correos ni resumen (no se escriben datos de Calendar ni Gmail)', () => {
  const src = readFileSync(new URL('../lib/data/acciones.js', import.meta.url), 'utf8');
  for (const t of ['agenda_hoy', 'correos_hoy', 'resumen_dia']) assert.ok(!src.includes(t), t);
});
