// Garantiza que los componentes nuevos usan SOLO tokens --ds-* y CSS Modules:
//  - ningún color escrito a mano (hex, rgb, hsl, nombres de color),
//  - toda var(--...) existe en tokens.css y empieza con --ds-,
//  - el modo oscuro lo resuelven los tokens: los componentes no declaran prefers-color-scheme ni !important.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const leer = ruta => readFileSync(join(RAIZ, ruta), 'utf8');
const sinComentarios = s => s.replace(/\/\*[\s\S]*?\*\//g, '');
const listar = (dir, ext) => (existsSync(join(RAIZ, dir)) ? readdirSync(join(RAIZ, dir)).filter(f => f.endsWith(ext)).map(f => `${dir}/${f}`) : []);

const CSS_NUEVOS = [...listar('components/ui', '.module.css'), ...listar('components/shell', '.module.css'), ...listar('app/(app)/laboratorio', '.module.css')];
const JS_NUEVOS = [...listar('components/ui', '.js'), ...listar('components/shell', '.js'), ...listar('app/(app)/laboratorio', '.js')];

const tokensCss = leer('styles/tokens.css');
const TOKENS_DEFINIDOS = new Set([...tokensCss.matchAll(/(--ds-[\w-]+)\s*:/g)].map(m => m[1]));

const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\b(?:black|white|red|green|blue|gray|grey|orange|yellow|purple|pink|violet|indigo|cyan|magenta)\b(?=\s*[;,)\s]|$)/i;

test('hay componentes y hojas de estilo que revisar', () => {
  assert.ok(CSS_NUEVOS.length >= 5, `solo ${CSS_NUEVOS.length} hojas`);
  assert.ok(JS_NUEVOS.length >= 5, `solo ${JS_NUEVOS.length} archivos`);
});

for (const ruta of CSS_NUEVOS) {
  const css = sinComentarios(leer(ruta));

  test(`${ruta}: sin colores escritos a mano`, () => {
    // Se revisan los valores de las declaraciones, no los nombres de clase.
    const valores = [...css.matchAll(/:\s*([^;{}]+);/g)].map(m => m[1]);
    for (const v of valores) assert.ok(!COLOR_LITERAL.test(v), `color literal en "${v.trim()}"`);
  });

  test(`${ruta}: toda variable usada existe en tokens.css y es --ds-*`, () => {
    for (const m of css.matchAll(/var\(\s*(--[\w-]+)/g)) {
      assert.ok(m[1].startsWith('--ds-'), `${m[1]} no es un token --ds-*`);
      assert.ok(TOKENS_DEFINIDOS.has(m[1]), `${m[1]} no está definido en tokens.css`);
    }
  });

  test(`${ruta}: no resuelve el tema por su cuenta ni usa !important`, () => {
    assert.ok(!/prefers-color-scheme/.test(css), 'declara prefers-color-scheme');
    assert.ok(!/data-theme/.test(css), 'declara data-theme');
    assert.ok(!/!important/.test(css), 'usa !important');
  });
}

for (const ruta of JS_NUEVOS) {
  test(`${ruta}: sin colores literales en el código`, () => {
    // Se ignoran los comentarios de línea y de bloque y las cadenas con "#" de rutas (p. ej. ids de anclas).
    const js = leer(ruta).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const hits = [...js.matchAll(/['"`]#[0-9a-fA-F]{3,8}['"`]|\brgba?\(|\bhsla?\(/g)].map(m => m[0]);
    assert.deepEqual(hits, []);
  });
}
