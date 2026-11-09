// Garantiza que el laboratorio esté completamente aislado (D-F2):
//  - nada fuera de él importa sus datos de demostración,
//  - no usa Supabase ni hace consultas o escrituras,
//  - responde 404 en producción y rotula sus datos como demostración.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const LAB = 'app/(app)/laboratorio';

function archivos(dir) {
  const out = [];
  for (const nombre of readdirSync(dir)) {
    if (['node_modules', '.next', 'tests', '.git'].includes(nombre)) continue;
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) out.push(...archivos(ruta));
    else if (/\.(js|jsx|mjs|css)$/.test(nombre)) out.push(ruta);
  }
  return out;
}
const rel = ruta => relative(RAIZ, ruta).replaceAll('\\', '/');
const todos = ['app', 'components', 'lib', 'styles', 'middleware.js'].flatMap(p => {
  const ruta = join(RAIZ, p);
  if (!existsSync(ruta)) return [];
  return statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
});
const delLab = todos.filter(r => rel(r).startsWith(LAB + '/'));
const fueraDelLab = todos.filter(r => !rel(r).startsWith(LAB + '/'));

test('el laboratorio tiene sus archivos', () => {
  assert.ok(existsSync(join(RAIZ, LAB, 'page.js')));
  assert.ok(existsSync(join(RAIZ, LAB, 'demo.js')));
});

test('nada fuera del laboratorio importa su carpeta ni sus datos de demostración', () => {
  for (const r of fueraDelLab) {
    const texto = readFileSync(r, 'utf8');
    const codigo = texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    if (rel(r) === 'lib/domain/navegacion.js') {
      // Fase 2: la navegación puede ENLAZAR al laboratorio, pero solo como elemento de desarrollo
      // y nunca importando su carpeta ni sus datos.
      assert.ok(!/(import|from|require)[^\n]*laboratorio/.test(codigo), `${rel(r)} importa el laboratorio`);
      assert.match(codigo, /ruta: '\/laboratorio'[^\n]*soloDesarrollo: true/, 'el enlace al laboratorio debe ser solo de desarrollo');
    } else {
      assert.ok(!/laboratorio/.test(codigo), `${rel(r)} hace referencia al laboratorio`);
    }
    assert.ok(!/\bdemo(\.js)?['"]/.test(texto), `${rel(r)} importa un módulo "demo"`);
  }
});

test('el laboratorio no usa Supabase ni hace consultas, escrituras ni peticiones de red', () => {
  for (const r of delLab.filter(x => /\.(js|jsx|mjs)$/.test(x))) {
    const texto = readFileSync(r, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/lib\/supabase|@supabase|createClient|createServerClient|createBrowserClient/.test(texto), `${rel(r)} usa un cliente de Supabase`);
    assert.ok(!/\.from\(|\.rpc\(|\.insert\(|\.update\(|\.delete\(|\.upsert\(/.test(texto), `${rel(r)} contiene una operación de datos`);
    assert.ok(!/\bfetch\(|XMLHttpRequest|axios/.test(texto), `${rel(r)} hace una petición de red`);
  }
});

test('la página responde 404 en producción', () => {
  const pagina = readFileSync(join(RAIZ, LAB, 'page.js'), 'utf8');
  assert.match(pagina, /process\.env\.NODE_ENV\s*===\s*'production'\)\s*notFound\(\)/);
});

test('los datos de demostración están rotulados como tales', () => {
  const demo = readFileSync(join(RAIZ, LAB, 'demo.js'), 'utf8');
  assert.match(demo, /DATOS DE DEMOSTRACIÓN/);
});

test('la página del laboratorio avisa que son muestras y no datos reales', () => {
  const pagina = readFileSync(join(RAIZ, LAB, 'page.js'), 'utf8');
  assert.match(pagina, /no datos reales/);
});
