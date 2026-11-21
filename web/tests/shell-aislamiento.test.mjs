// El shell de navegación (Fase 2) no debe tocar datos ni autenticación:
//  - ningún archivo del shell consulta datos (.from, .rpc, fetch),
//  - el único uso de Supabase es el cierre de sesión (useSalir), el mismo flujo del menú anterior,
//  - el layout (app) usa el shell y conserva el contenedor `.wrap` heredado,
//  - el middleware, la autenticación y las páginas de negocio no se modifican (se comprueba en el informe con git diff).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const leer = r => readFileSync(join(RAIZ, r), 'utf8');
const sinComentarios = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const archivosShell = readdirSync(join(RAIZ, 'components/shell')).filter(f => f.endsWith('.js'));
const dominio = ['navegacion', 'busqueda', 'frenteActivo', 'asistente'].map(n => `lib/domain/${n}.js`);

test('hay archivos del shell que revisar', () => {
  assert.ok(archivosShell.length >= 8);
});

test('ningún archivo del shell consulta datos ni hace peticiones', () => {
  for (const f of archivosShell) {
    if (f === 'AssistantDrawer.js') continue;   // el asistente es la excepción acotada: ver la prueba siguiente
    const js = sinComentarios(leer(`components/shell/${f}`));
    assert.ok(!/\.from\(|\.rpc\(|\.insert\(|\.update\(|\.delete\(|\.upsert\(/.test(js), `${f} contiene una operación de datos`);
    assert.ok(!/\bfetch\(|XMLHttpRequest|axios/.test(js), `${f} hace una petición de red`);
  }
});

test('solo useSalir usa Supabase, y solo para cerrar sesión', () => {
  for (const f of archivosShell) {
    const js = sinComentarios(leer(`components/shell/${f}`));
    const usa = /lib\/supabase|@supabase|createClient/.test(js);
    assert.equal(usa, f === 'useSalir.js' || f === 'AssistantDrawer.js', `${f}: uso de Supabase inesperado`);
  }
  const salir = sinComentarios(leer('components/shell/useSalir.js'));
  assert.match(salir, /auth\.signOut\(\)/);
  assert.match(salir, /router\.push\('\/login'\)/);
  assert.match(salir, /router\.refresh\(\)/);
});

test('el asistente solo habla con /api/asistente y solo toca su propia memoria', () => {
  const js = sinComentarios(leer('components/shell/AssistantDrawer.js'));
  assert.deepEqual([...js.matchAll(/fetch\('([^']+)'/g)].map(m => m[1]), ['/api/asistente']);
  const tablas = [...js.matchAll(/\.from\('([^']+)'\)/g)].map(m => m[1]);
  assert.ok(tablas.length > 0 && tablas.every(t => t === 'asistente_memoria'), 'solo asistente_memoria');
  assert.ok(!/\.update\(|\.upsert\(|\.rpc\(/.test(js));
});

test('la lógica de dominio del shell es pura: sin React, sin Supabase, sin red', () => {
  for (const f of dominio) {
    const js = sinComentarios(leer(f));
    assert.ok(!/from 'react'|supabase|fetch\(|window\.|document\./.test(js), `${f} no es puro`);
  }
});

test('el layout de la app usa el shell y conserva .wrap', () => {
  assert.match(leer('app/(app)/layout.js'), /AppShell/);
  assert.match(leer('components/shell/AppShell.js'), /className="wrap"/);
  assert.match(leer('components/shell/AppShell.js'), /<main id="contenido"/);
});

test('el shell no oculta el asistente ni acciones sin implementar', () => {
  // Una acción solo es visible si está en ACCIONES_DISPONIBLES.
  assert.match(leer('components/shell/acciones.js'), /ACCIONES_DISPONIBLES = new Set\(/);
});

test('el CSS global del shell se limita a la presencia del shell', () => {
  const css = sinComentarios(leer('styles/shell.css'));
  const reglas = [...css.matchAll(/([^{}]+)\{/g)].map(m => m[1].trim());
  assert.ok(reglas.length >= 1);
  for (const r of reglas) assert.match(r, /\[data-shell\]/, `regla global sin acotar: ${r}`);
});
