import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GRUPOS, ELEMENTOS, RUTAS_NEGOCIO, elementosVisibles, gruposConElementos, elementosBarraMovil, elementosMas,
  itemDeRuta, esActivo, migas, tituloDeRuta, masEstaActivo,
} from '../lib/domain/navegacion.js';
import { ICONOS } from '../components/ui/icons.js';

const aqui = dirname(fileURLToPath(import.meta.url));
const appDir = join(aqui, '..', 'app', '(app)');

test('las trece rutas de negocio (las nueve de la Fase 2 más /focus, /habitos, /atencion y /life-pulse) aparecen exactamente una vez', () => {
  const rutas = ELEMENTOS.filter(e => e.ruta && !e.soloDesarrollo).map(e => e.ruta);
  assert.deepEqual([...rutas].sort(), [...RUTAS_NEGOCIO].sort());
  assert.equal(new Set(rutas).size, rutas.length);
});

test('cada ruta de negocio corresponde a una página existente (rutas sin cambios)', () => {
  for (const r of RUTAS_NEGOCIO) {
    const carpeta = r === '/' ? appDir : join(appDir, r.slice(1));
    assert.ok(existsSync(join(carpeta, 'page.js')), `falta la página de ${r}`);
  }
  // Y no hay páginas de negocio fuera del mapa (salvo el laboratorio)
  const carpetas = readdirSync(appDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => '/' + d.name);
  for (const c of carpetas) assert.ok(RUTAS_NEGOCIO.includes(c) || c === '/laboratorio', `carpeta sin mapear: ${c}`);
});

test('la agrupación es solo visual: ninguna ruta lleva el nombre de un grupo', () => {
  for (const e of ELEMENTOS.filter(x => x.ruta)) {
    assert.equal(e.ruta.split('/').length <= 2, true, `${e.ruta} anidada`);
    for (const g of GRUPOS) assert.ok(!e.ruta.startsWith('/' + g.id), `${e.ruta} usa prefijo de grupo`);
  }
});

test('identificadores únicos, grupos válidos e iconos existentes', () => {
  assert.equal(new Set(ELEMENTOS.map(e => e.id)).size, ELEMENTOS.length);
  const grupos = new Set(GRUPOS.map(g => g.id));
  for (const e of ELEMENTOS) {
    assert.ok(grupos.has(e.grupo), `${e.id}: grupo desconocido`);
    assert.ok(e.icono in ICONOS, `${e.id}: icono inexistente "${e.icono}"`);
    assert.ok(Boolean(e.ruta) !== Boolean(e.accion), `${e.id}: debe tener ruta o acción, no ambas`);
  }
});

test('los cuatro grupos de producción y Gastos subordinado a Finanzas', () => {
  const g = gruposConElementos({ desarrollo: false });
  assert.deepEqual(g.map(x => x.id), ['inicio', 'mi-vida', 'conocimiento', 'asistente']);
  assert.deepEqual(g.find(x => x.id === 'mi-vida').elementos.map(e => e.id), ['focus', 'habitos', 'atencion', 'metas', 'finanzas', 'gastos', 'salud', 'jornada']);
  assert.equal(ELEMENTOS.find(e => e.id === 'gastos').padre, 'finanzas');
});

test('el laboratorio solo existe en desarrollo', () => {
  assert.ok(!elementosVisibles({ desarrollo: false }).some(e => e.id === 'laboratorio'));
  assert.ok(elementosVisibles({ desarrollo: true }).some(e => e.id === 'laboratorio'));
  assert.ok(gruposConElementos({ desarrollo: true }).some(g => g.id === 'desarrollo'));
  assert.ok(!gruposConElementos({ desarrollo: false }).some(g => g.id === 'desarrollo'));
});

test('el asistente es una acción, no una ruta', () => {
  const a = ELEMENTOS.find(e => e.id === 'asistente');
  assert.equal(a.ruta, undefined);
  assert.equal(a.accion, 'asistente');
});

test('barra móvil: Home, Panel y Metas; el resto va en Más', () => {
  assert.deepEqual(elementosBarraMovil().map(e => e.id), ['mi-dia', 'panel', 'metas']);
  const mas = elementosMas({ desarrollo: false }).map(e => e.id);
  assert.deepEqual(mas, ['life-pulse', 'focus', 'habitos', 'atencion', 'finanzas', 'gastos', 'salud', 'jornada', 'biblioteca', 'cerebro', 'asistente']);
});

test('itemDeRuta: exacta, con consulta, con barra final y desconocida', () => {
  assert.equal(itemDeRuta('/').id, 'mi-dia');
  assert.equal(itemDeRuta('/finanzas').id, 'finanzas');
  assert.equal(itemDeRuta('/gastos?frente=tanku').id, 'gastos');
  assert.equal(itemDeRuta('/metas/').id, 'metas');
  assert.equal(itemDeRuta('/metas/123').id, 'metas');
  assert.equal(itemDeRuta('/no-existe'), null);
  assert.equal(itemDeRuta(undefined).id, 'mi-dia');
});

test('esActivo: "/" solo es activo en "/" y Gastos no activa Finanzas', () => {
  const por = id => ELEMENTOS.find(e => e.id === id);
  assert.equal(esActivo(por('mi-dia'), '/'), true);
  assert.equal(esActivo(por('mi-dia'), '/panel'), false);
  assert.equal(esActivo(por('finanzas'), '/gastos'), false);
  assert.equal(esActivo(por('gastos'), '/gastos'), true);
  assert.equal(esActivo(por('asistente'), '/'), false);
});

test('migas por ruta', () => {
  assert.deepEqual(migas('/').map(m => m.nombre), ['Home']);
  assert.deepEqual(migas('/panel').map(m => m.nombre), ['Panel']);
  assert.deepEqual(migas('/metas').map(m => m.nombre), ['Mi vida', 'Metas']);
  assert.deepEqual(migas('/gastos').map(m => m.nombre), ['Mi vida', 'Finanzas', 'Gastos']);
  assert.deepEqual(migas('/cerebro').map(m => m.nombre), ['Conocimiento', 'Cerebro']);
  assert.deepEqual(migas('/nada'), []);
});

test('título del documento', () => {
  assert.equal(tituloDeRuta('/'), 'Cerebro de Lu');
  assert.equal(tituloDeRuta('/metas'), 'Metas · Cerebro de Lu');
  assert.equal(tituloDeRuta('/nada'), 'Cerebro de Lu');
});

test('"Más" está activo cuando la ruta vive en la hoja', () => {
  assert.equal(masEstaActivo('/salud'), true);
  assert.equal(masEstaActivo('/gastos'), true);
  assert.equal(masEstaActivo('/metas'), false);
  assert.equal(masEstaActivo('/'), false);
});

test('en producción el laboratorio no existe como elemento de navegación', () => {
  assert.equal(itemDeRuta('/laboratorio', { desarrollo: false }), null);
  assert.equal(itemDeRuta('/laboratorio').id, 'laboratorio');
  assert.deepEqual(migas('/laboratorio', { desarrollo: false }), []);
  assert.equal(tituloDeRuta('/laboratorio', undefined, { desarrollo: false }), 'Cerebro de Lu');
});
