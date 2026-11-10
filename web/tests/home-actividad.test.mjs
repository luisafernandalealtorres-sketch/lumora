import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { actividadReciente, cuandoLegible } from '../lib/domain/actividad.js';
import { ELEMENTOS } from '../lib/domain/navegacion.js';

const T = (d, h = '15:00') => `${d}T${h}:00Z`;

test('actividad reciente: une fuentes reales, ordena de la más reciente a la más antigua y respeta el límite', () => {
  const a = actividadReciente({
    pendientes: [{ id: 'p1', texto: 'Enviar cotización', hecho: true, hecho_en: T('2026-11-10', '14:00'), frente: 'tanku' }],
    notas: [{ id: 'n1', titulo: 'Idea EVE', actualizado_en: T('2026-11-10', '16:00'), frente: 'ticketcode-eve' }],
    biblioteca: [{ id: 'b1', titulo: 'Artículo', guardado_en: T('2026-11-09', '12:00') }],
    jornadas: [{ fecha: '2026-11-08' }],
    limite: 3,
  });
  assert.deepEqual(a.map(x => x.tipo), ['nota', 'pendiente', 'biblioteca']);
  assert.equal(a.length, 3);
});

test('solo cuentan los pendientes completados con fecha de cumplimiento; sin fuentes no se inventa nada', () => {
  const a = actividadReciente({ pendientes: [{ id: 'x', texto: 'A', hecho: false, hecho_en: null }, { id: 'y', texto: 'B', hecho: true, hecho_en: null }] });
  assert.deepEqual(a, []);
  assert.deepEqual(actividadReciente({}), []);
});

test('cada registro aparece una sola vez y no hay actividad de finanzas', () => {
  const nota = { id: 'n1', titulo: 'N', actualizado_en: T('2026-11-10') };
  const a = actividadReciente({ notas: [nota, nota], gastos: [{ id: 'g', valor_cop: 5 }], ingresos: [{ id: 'i' }] });
  assert.equal(a.length, 1);
  assert.ok(a.every(x => ['pendiente', 'nota', 'biblioteca', 'jornada'].includes(x.tipo)));
});

test('«hoy» y «ayer» se calculan en America/Bogota', () => {
  const ahora = Date.parse('2026-11-10T04:00:00Z');                 // 23:00 del 9 en Bogotá
  assert.equal(cuandoLegible(Date.parse('2026-11-10T03:00:00Z'), ahora), 'hoy');
  assert.equal(cuandoLegible(Date.parse('2026-11-09T03:00:00Z'), ahora), 'ayer');
  assert.equal(cuandoLegible(Date.parse('2026-11-01T15:00:00Z'), ahora), '2026-11-01');
});

test('la navegación llama «Home» a la pantalla de «/» y conserva la ruta y el identificador', () => {
  const e = ELEMENTOS.find(x => x.ruta === '/');
  assert.equal(e.nombre, 'Home'); assert.equal(e.id, 'mi-dia'); assert.ok(e.claves.includes('mi dia'));
});

test('Home (centro de control) compone los bloques aprobados y conserva Pendientes heredado, agenda y correos cuando hay fuente', () => {
  const app = readFileSync(new URL('../components/home/HomeApp.js', import.meta.url), 'utf8');
  for (const s of ['BloqueFocus', 'BloqueLifePulse', 'ProximasAcciones', 'HoyPrioridades', 'MapaFrentes', 'ResumenEjecutivo', 'FranjaFuentes', 'AccesosRapidos', 'Encabezado']) assert.ok(app.includes(s), s);
  const hoy = readFileSync(new URL('../components/home/HoyPrioridades.js', import.meta.url), 'utf8');
  assert.ok(hoy.includes('<Pendientes '), 'componente heredado Pendientes');
  assert.ok(hoy.includes('Agenda de hoy') && hoy.includes('Correos para revisar'));
  const page = readFileSync(new URL('../app/(app)/page.js', import.meta.url), 'utf8');
  assert.ok(page.includes('HomeApp') && page.includes('leerFuente'));
});
