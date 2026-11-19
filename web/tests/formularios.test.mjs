// Pruebas de lib/domain/formularios.js (decisión D-F3): el frente inicial de cada formulario es explícito
// y NO depende del orden de las filas de la tabla `frentes`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { FRENTE_INICIAL, frenteInicial } from '../lib/domain/formularios.js';
import { revisarMapa } from '../lib/domain/frentesMap.js';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const SLUGS_BASE = ['ticketcode-eventos', 'ticketcode-eve', 'tanku', 'hama', 'crochet', 'jardin', 'salud-abuela', 'hogar', 'personal', 'salud'];

// Valores aprobados por el usuario el 8 nov 2026.
const APROBADO = {
  miDiaPendiente: 'ticketcode-eventos',
  metaNueva: 'ticketcode-eventos',
  notaNueva: 'ticketcode-eventos',
  notaEdicionSinFrente: 'personal',
  gastoNuevo: 'personal',
  ingresoNuevo: 'personal',
  recurrenteNuevo: 'personal',
};

test('los siete valores conservan exactamente lo aprobado', () => {
  assert.deepEqual({ ...FRENTE_INICIAL }, APROBADO);
});

test('cada valor es un frente que existe en la base y está asignado al mapa de diseño', () => {
  for (const [formulario, slug] of Object.entries(FRENTE_INICIAL)) {
    assert.ok(SLUGS_BASE.includes(slug), `${formulario}: "${slug}" no es un frente existente`);
  }
  assert.deepEqual(revisarMapa(SLUGS_BASE).sinAsignar, []);
});

test('el objeto está congelado: ningún código puede cambiar un valor en ejecución', () => {
  assert.ok(Object.isFrozen(FRENTE_INICIAL));
  assert.throws(() => { 'use strict'; FRENTE_INICIAL.gastoNuevo = 'tanku'; }, TypeError);
  assert.equal(frenteInicial('gastoNuevo'), 'personal');
});

test('frenteInicial devuelve el valor de cada formulario', () => {
  for (const [formulario, slug] of Object.entries(APROBADO)) assert.equal(frenteInicial(formulario), slug);
});

test('un formulario desconocido falla de forma visible en vez de elegir un frente por su cuenta', () => {
  for (const f of ['noExiste', '', undefined, null, 'toString', '__proto__', 'constructor']) {
    assert.throws(() => frenteInicial(f), RangeError, String(f));
  }
});

test('ningún valor depende del orden: no hay datos de la base en este módulo', () => {
  const texto = readFileSync(join(RAIZ, 'lib/domain/formularios.js'), 'utf8').replace(/\/\/.*$/gm, '');
  assert.ok(!/frentes\s*\[|\.orden|supabase/i.test(texto));
});

// ---- Guardas sobre los componentes: la dependencia del orden no puede volver ----
const componentes = [...readdirSync(join(RAIZ, 'components')).filter(f => f.endsWith('.js')).map(f => `components/${f}`), 'components/finanzas/FinanzasPanel.js', 'components/metas/MetasPanel.js'];

test('ningún componente toma su frente inicial de frentes[0] (el orden de la base)', () => {
  for (const ruta of componentes) {
    const texto = readFileSync(join(RAIZ, ruta), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.ok(!/frentes\s*\[\s*0\s*\]/.test(texto), `${ruta} usa frentes[0]`);
  }
});

test('cada formulario declara su frente inicial con frenteInicial(...)', () => {
  const esperado = {
    'components/Pendientes.js': ['miDiaPendiente'],
    'components/metas/MetasPanel.js': ['metaNueva'],
    'components/Cerebro.js': ['notaNueva', 'notaEdicionSinFrente'],
    'components/finanzas/FinanzasPanel.js': ['gastoNuevo', 'ingresoNuevo', 'recurrenteNuevo'],
  };
  for (const [ruta, claves] of Object.entries(esperado)) {
    const texto = readFileSync(join(RAIZ, ruta), 'utf8');
    assert.match(texto, /from '@\/lib\/domain\/formularios'/, `${ruta} no importa formularios`);
    for (const clave of claves) assert.ok(texto.includes(`frenteInicial('${clave}')`), `${ruta} no usa frenteInicial('${clave}')`);
  }
});

test('todas las claves definidas se usan en algún componente (no quedan valores huérfanos)', () => {
  const todo = componentes.map(r => readFileSync(join(RAIZ, r), 'utf8')).join('\n');
  for (const clave of Object.keys(FRENTE_INICIAL)) assert.ok(todo.includes(`frenteInicial('${clave}')`), `"${clave}" no se usa`);
});

test("ningún formulario fija un frente escrito a mano ('personal' o un slug) como valor inicial", () => {
  for (const ruta of ['components/finanzas/FinanzasPanel.js', 'components/metas/MetasPanel.js', 'components/Cerebro.js', 'components/Pendientes.js']) {
    const texto = readFileSync(join(RAIZ, ruta), 'utf8').replace(/\/\/.*$/gm, '');
    assert.ok(!/frente:\s*'[a-z-]+'/.test(texto), `${ruta} tiene un frente escrito a mano`);
    assert.ok(!/useState\(\s*'personal'\s*\)/.test(texto), `${ruta} inicia el estado con 'personal' escrito a mano`);
  }
});
