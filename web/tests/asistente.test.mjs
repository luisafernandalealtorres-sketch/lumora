import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ESTADOS_ASISTENTE, IDS_ESTADOS, ESTADO_INICIAL, estadoAsistente, puedeEnviar, FUTURO_ASISTENTE } from '../lib/domain/asistente.js';

test('existen los siete estados previstos más "no conectado"', () => {
  assert.deepEqual(IDS_ESTADOS, ['no-conectado', 'disponible', 'pensando', 'consultando', 'esperando-aprobacion', 'ejecutando', 'completado', 'error']);
  for (const id of IDS_ESTADOS) {
    const e = ESTADOS_ASISTENTE[id];
    assert.ok(e.etiqueta && e.descripcion, id);
    assert.equal(typeof e.permiteEnviar, 'boolean');
  }
});

test('el asistente arranca "no conectado" y no permite enviar', () => {
  assert.equal(ESTADO_INICIAL, 'no-conectado');
  assert.equal(puedeEnviar(ESTADO_INICIAL), false);
});

test('mientras trabaja o espera aprobación no se puede enviar', () => {
  for (const id of ['pensando', 'consultando', 'esperando-aprobacion', 'ejecutando']) assert.equal(puedeEnviar(id), false, id);
  for (const id of ['disponible', 'completado', 'error']) assert.equal(puedeEnviar(id), true, id);
});

test('un estado desconocido es error, nunca disponible', () => {
  assert.equal(estadoAsistente('inventado').etiqueta, 'Error');
  assert.equal(puedeEnviar('inventado'), false);
});

test('lo futuro está listado y es texto', () => {
  assert.ok(FUTURO_ASISTENTE.length >= 3);
  for (const t of FUTURO_ASISTENTE) assert.equal(typeof t, 'string');
});
