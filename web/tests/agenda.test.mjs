import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { frenteDeCalendario, normalizarEvento, estadoAgenda, haceCuanto, eventosDeHoy, esTodoElDia, descartarEvento, tablaFuentesInexistente, VIGENCIA_HORAS } from '../lib/domain/agenda.js';

const AHORA = Date.parse('2026-11-19T15:00:00Z');
const hace = h => new Date(AHORA - h * 3600000).toISOString();
const fuentes = [
  { calendario_id: 'cal-tanku', nombre: 'Tanku', frente_id: 'tanku', estado: 'activa', ultima_sincronizacion: hace(2), ultimo_error: null },
  { calendario_id: 'cal-personal', nombre: 'Personal', frente_id: 'personal', estado: 'activa', ultima_sincronizacion: hace(2), ultimo_error: null },
  { calendario_id: 'cal-greencode', nombre: 'greencode', frente_id: 'ticketcode', estado: 'pendiente', ultima_sincronizacion: null, ultimo_error: null },
];

test('el frente de un evento sale de su calendario; un calendario desconocido queda «sin asignar» (null), no se adivina', () => {
  assert.equal(frenteDeCalendario(fuentes, 'cal-tanku'), 'tanku');
  assert.equal(frenteDeCalendario(fuentes, 'cal-greencode'), 'ticketcode');
  assert.equal(frenteDeCalendario(fuentes, 'otro'), null);
  assert.equal(frenteDeCalendario(null, 'cal-tanku'), null);
  assert.equal(frenteDeCalendario([{ calendario_id: 'x', frente_id: 'inventado' }], 'x'), null);
});

test('normalizar un evento con hora: fecha de Bogotá, hora, título y frente; no guarda invitados ni enlaces', () => {
  const f = normalizarEvento({
    evento: { id: 'e1', summary: ' Reunión ', description: '  Línea 1\n\nLínea 2  ', attendees: [{ email: 'x@y.z' }], hangoutLink: 'https://meet', start: { dateTime: '2026-11-19T21:30:00-05:00' }, end: { dateTime: '2026-11-19T22:00:00-05:00' } },
    calendarioId: 'cal-tanku', fuentes, ahoraIso: '2026-11-19T15:00:00Z',
  });
  assert.deepEqual(Object.keys(f).sort(), ['calendario_id', 'detalle', 'fecha', 'fin', 'frente_id', 'inicio', 'origen_id', 'sincronizado_en', 'titulo']);
  assert.equal(f.titulo, 'Reunión');
  assert.equal(f.detalle, 'Línea 1 Línea 2');
  assert.equal(f.frente_id, 'tanku');
  assert.equal(f.origen_id, 'e1');
  assert.equal(f.fecha, '2026-11-19');
  assert.ok(!JSON.stringify(f).includes('x@y.z') && !JSON.stringify(f).includes('meet'));
});

test('un evento a las 11 p. m. de Bogotá cae en el día de Bogotá, no en el UTC del día siguiente', () => {
  const f = normalizarEvento({ evento: { id: 'e', summary: 'Cena', start: { dateTime: '2026-11-19T23:00:00-05:00' } }, calendarioId: 'cal-personal', fuentes, ahoraIso: 'x' });
  assert.equal(f.fecha, '2026-11-19');
});

test('un evento de todo el día empieza a las 00:00 de Bogotá y sin título se llama «(sin título)»', () => {
  const f = normalizarEvento({ evento: { id: 'e', start: { date: '2026-11-20' }, end: { date: '2026-11-21' } }, calendarioId: 'cal-personal', fuentes, ahoraIso: 'x' });
  assert.equal(f.fecha, '2026-11-20');
  assert.equal(f.titulo, '(sin título)');
  assert.equal(f.detalle, null);
});

test('eventos inservibles se descartan (sin id, sin inicio o con fecha inválida)', () => {
  const base = { calendarioId: 'cal-tanku', fuentes, ahoraIso: 'x' };
  assert.equal(normalizarEvento({ ...base, evento: null }), null);
  assert.equal(normalizarEvento({ ...base, evento: { summary: 'x', start: { date: '2026-11-19' } } }), null);
  assert.equal(normalizarEvento({ ...base, evento: { id: '1', summary: 'x' } }), null);
  assert.equal(normalizarEvento({ ...base, evento: { id: '1', start: { dateTime: 'no es fecha' } } }), null);
});

test('el detalle se recorta a 200 caracteres', () => {
  const f = normalizarEvento({ evento: { id: '1', summary: 'x', description: 'a'.repeat(500), start: { date: '2026-11-19' } }, calendarioId: 'cal-tanku', fuentes, ahoraIso: 'x' });
  assert.equal(f.detalle.length, 200);
});

test('sin ninguna sincronización la agenda es «no conectada», no «sin eventos»', () => {
  assert.equal(estadoAgenda({ filas: [], fuentes: [], ahoraMs: AHORA }).estado, 'no_conectada');
  assert.equal(estadoAgenda({ filas: [], fuentes: null, ahoraMs: AHORA }).estado, 'no_conectada');
  assert.equal(estadoAgenda({ filas: [], fuentes: [fuentes[2]], ahoraMs: AHORA }).estado, 'no_conectada');
});

test('con sincronización reciente y sin eventos hoy es un día libre real, y avisa qué cuenta falta', () => {
  const e = estadoAgenda({ filas: [], fuentes, ahoraMs: AHORA });
  assert.equal(e.estado, 'sin_registros');
  assert.deepEqual(e.pendientes, ['greencode']);
  assert.deepEqual(e.sincronizadas, ['Tanku', 'Personal']);
});

test('con sincronización vieja y sin eventos NO se afirma que el día esté libre', () => {
  const viejas = fuentes.map(f => (f.ultima_sincronizacion ? { ...f, ultima_sincronizacion: hace(VIGENCIA_HORAS + 1) } : f));
  assert.equal(estadoAgenda({ filas: [], fuentes: viejas, ahoraMs: AHORA }).estado, 'desactualizada');
  assert.equal(estadoAgenda({ filas: [{ id: 1 }], fuentes: viejas, ahoraMs: AHORA }).vencida, true);
});

test('con eventos hay datos; las filas prueban que algo escribe aunque no haya registro de sincronización', () => {
  assert.equal(estadoAgenda({ filas: [{ id: 1 }], fuentes, ahoraMs: AHORA }).estado, 'datos');
  assert.equal(estadoAgenda({ filas: [{ id: 1 }], fuentes: null, ahoraMs: AHORA }).estado, 'datos');
});

test('un error de lectura nunca se convierte en vacío ni en «no conectada»', () => {
  assert.equal(estadoAgenda({ filas: [], fuentes, error: new Error('x'), ahoraMs: AHORA }).estado, 'error');
  assert.equal(estadoAgenda({ filas: null, fuentes, error: 'x', ahoraMs: AHORA }).estado, 'error');
});

test('una fuente activa con error de sincronización se reporta', () => {
  const f = fuentes.map(x => (x.calendario_id === 'cal-tanku' ? { ...x, ultimo_error: 'permiso' } : x));
  assert.deepEqual(estadoAgenda({ filas: [], fuentes: f, ahoraMs: AHORA }).conError, ['Tanku']);
});

test('la vigencia cubre el hueco más largo entre corridas (6:00, 12:00 y 17:00 → 13 h)', () => {
  assert.ok(VIGENCIA_HORAS > 13);
  assert.equal(estadoAgenda({ filas: [], fuentes: fuentes.map(f => (f.ultima_sincronizacion ? { ...f, ultima_sincronizacion: hace(13) } : f)), ahoraMs: AHORA }).estado, 'sin_registros');
});

test('hace cuánto: minutos, horas y días', () => {
  assert.equal(haceCuanto(hace(0), AHORA), 'hace un momento');
  assert.equal(haceCuanto(new Date(AHORA - 35 * 60000).toISOString(), AHORA), 'hace 35 min');
  assert.equal(haceCuanto(hace(3), AHORA), 'hace 3 h');
  assert.equal(haceCuanto(hace(48), AHORA), 'hace 2 días');
});

test('eventos de hoy: ordenados por hora y filtrados por frente sin mutar la lista', () => {
  const filas = [
    { id: 2, inicio: '2026-11-19T20:00:00Z', frente_id: 'personal' },
    { id: 1, inicio: '2026-11-19T14:00:00Z', frente_id: 'tanku' },
    { id: 3, inicio: '2026-11-19T16:00:00Z', frente_id: null },
  ];
  assert.deepEqual(eventosDeHoy(filas).map(e => e.id), [1, 3, 2]);
  assert.deepEqual(eventosDeHoy(filas, 'tanku').map(e => e.id), [1]);
  assert.deepEqual(filas.map(e => e.id), [2, 1, 3]);
});

test('se descartan los eventos cancelados y los que el propio usuario rechazó; no los rechazados por otros', () => {
  assert.equal(descartarEvento({ id: 'a', status: 'cancelled' }), true);
  assert.equal(descartarEvento(null), true);
  assert.equal(descartarEvento({ id: 'b', status: 'confirmed', attendees: [{ self: true, responseStatus: 'declined' }] }), true);
  assert.equal(descartarEvento({ id: 'c', status: 'confirmed', attendees: [{ responseStatus: 'declined' }, { self: true, responseStatus: 'accepted' }] }), false);
  assert.equal(descartarEvento({ id: 'd', status: 'confirmed' }), false);
});

test('evento de todo el día: 00:00 de Bogotá y duración exacta en días', () => {
  assert.equal(esTodoElDia({ inicio: '2026-11-20T00:00:00-05:00', fin: '2026-11-21T00:00:00-05:00' }), true);
  assert.equal(esTodoElDia({ inicio: '2026-11-20T00:00:00-05:00', fin: '2026-11-20T01:00:00-05:00' }), false);
  assert.equal(esTodoElDia({ inicio: '2026-11-20T09:00:00-05:00', fin: '2026-11-21T09:00:00-05:00' }), false);
  assert.equal(esTodoElDia({ inicio: '2026-11-20T00:00:00-05:00', fin: null }), false);
});

test('solo la tabla inexistente se tolera; cualquier otro error de las fuentes sigue siendo error', () => {
  assert.equal(tablaFuentesInexistente({ code: 'PGRST205' }), true);
  assert.equal(tablaFuentesInexistente({ code: '42P01' }), true);
  assert.equal(tablaFuentesInexistente({ code: '42501', message: 'permission denied' }), false);
  assert.equal(tablaFuentesInexistente(null), false);
});

test('la migración no contiene identificadores de calendario ni correos (el repositorio es público)', () => {
  for (const f of ['agenda_aplicar.sql', 'agenda_reversion.sql', 'agenda_verificacion_solo_lectura.sql']) {
    const s = readFileSync(new URL(`../../docs/sql/agenda-v1/${f}`, import.meta.url), 'utf8');
    assert.ok(!/[\w.+-]+@[\w-]+\.[\w.-]+/.test(s), `${f} contiene un correo`);
    assert.ok(!s.includes('group.calendar.google.com'), `${f} contiene un id de calendario`);
  }
});
