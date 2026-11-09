// El shell no debe simular lo que todavía no existe (Fase 2): ni filtrado, ni IA, ni notificaciones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const leer = r => readFileSync(join(RAIZ, r), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('el asistente no simula respuestas ni acciones', () => {
  const js = leer('components/shell/AssistantDrawer.js');
  assert.ok(!/setTimeout|setInterval|fetch\(|Math\.random|messages|respuesta:/.test(js));
  assert.match(js, /<textarea[^>]*\bdisabled\b/, 'el campo de mensaje debe estar deshabilitado');
  assert.match(js, /disabled=\{!puedeEnviar\(ESTADO_INICIAL\)\}/, 'enviar depende del estado');
  assert.match(js, /estadoAsistente\(ESTADO_INICIAL\)/);
});

test('el filtro de frente avisa cuando la pantalla no lo aplica', () => {
  const js = leer('components/shell/FrenteControl.js');
  assert.match(js, /pantallaAplica/);
  assert.match(js, /aún no aplica el filtro de frente/);
});

test('el selector de frente ofrece "Todos" y los seis frentes y marca el seleccionado con algo más que color', () => {
  const js = leer('components/shell/FrenteSelector.js');
  assert.match(js, /nombre: 'Todos'/);
  assert.match(js, /FRENTES_DISENO\.map/);
  assert.match(js, /aria-checked=\{sel\}/);
  assert.match(js, /name="check"/);
});

test('las notificaciones no muestran contador ni insignia', () => {
  const js = leer('components/shell/NotificationsMenu.js');
  assert.ok(!/badge|insignia|contador|\.length/.test(js));
  assert.match(js, /Aún no hay notificaciones/);
});

test('la búsqueda declara su alcance y no consulta datos', () => {
  const js = leer('components/shell/SearchPalette.js');
  assert.match(js, /llegará más adelante/);
  assert.ok(!/supabase|fetch\(|\.from\(/i.test(js));
});

test('el asistente flotante es independiente de la navegación y siempre se renderiza', () => {
  const shell = leer('components/shell/AppShell.js');
  assert.match(shell, /<AssistantFloatingButton \/>/);
  assert.ok(!/AssistantFloatingButton[^\n]*Sidebar/.test(shell));
  assert.match(leer('components/shell/AssistantFloatingButton.module.css'), /position: fixed/);
});
