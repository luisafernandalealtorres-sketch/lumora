import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ESTADOS_ASISTENTE, IDS_ESTADOS, ESTADO_INICIAL, estadoAsistente, puedeEnviar, FUTURO_ASISTENTE, leerEventos, MENSAJES_ERROR, mensajeDeError, estadoDeError, textoConsulta, textoPresupuesto, partirNegritas, bloquesDeTexto } from '../lib/domain/asistente.js';

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
  assert.ok(FUTURO_ASISTENTE.length >= 2);
  for (const t of FUTURO_ASISTENTE) assert.equal(typeof t, 'string');
});

test('leerEventos junta trozos, deja el resto incompleto y descarta líneas rotas', () => {
  let r = leerEventos('{"tipo":"texto","delta":"Ho');
  assert.deepEqual(r, { eventos: [], resto: '{"tipo":"texto","delta":"Ho' });
  r = leerEventos(`${r.resto}la"}\nbasura\n{"sin":"tipo"}\n{"tipo":"fin"}\n{"tipo":"te`);
  assert.deepEqual(r.eventos, [{ tipo: 'texto', delta: 'Hola' }, { tipo: 'fin' }]);
  assert.equal(r.resto, '{"tipo":"te');
});

test('cada código de error tiene mensaje propio, uno desconocido no revela nada, y sin clave es "no conectado"', () => {
  for (const c of Object.keys(MENSAJES_ERROR)) assert.ok(mensajeDeError(c).length > 10, c);
  assert.equal(mensajeDeError('sk-ant-algo'), MENSAJES_ERROR.interno);
  assert.equal(estadoDeError('sin_configurar'), 'no-conectado');
  assert.equal(estadoDeError('limite'), 'error');
});

test('el formato de la respuesta: negritas, listas y párrafos, sin HTML', () => {
  assert.deepEqual(partirNegritas('a **b** c'), [{ texto: 'a ', negrita: false }, { texto: 'b', negrita: true }, { texto: ' c', negrita: false }]);
  assert.deepEqual(partirNegritas('sin cerrar **x'), [{ texto: 'sin cerrar **x', negrita: false }]);
  assert.deepEqual(partirNegritas('vacío **** fin'), [{ texto: 'vacío **** fin', negrita: false }]);
  const b = bloquesDeTexto('Hoy tienes:\n\n- **9:00** Reunión\n- Paseo\n\n1. Uno\n2. Dos\n## Título\nFin');
  assert.deepEqual(b.map(x => [x.tipo, x.items.length]), [['p', 1], ['ul', 2], ['ol', 2], ['p', 1]]);
  assert.equal(b[1].items[0][0].negrita, true);
  const peligroso = bloquesDeTexto('<img src=x onerror=alert(1)>');
  assert.equal(peligroso[0].items[0][0].texto, '<img src=x onerror=alert(1)>', 'queda como texto; React lo escapa');
  assert.deepEqual(bloquesDeTexto(''), []);
});

test('el texto de consulta y de presupuesto son honestos y cortos', () => {
  assert.equal(textoConsulta('consultar_gastos'), 'Mirando tus gastos…');
  assert.equal(textoConsulta('otra'), 'Mirando tus datos…');
  assert.equal(textoPresupuesto({ aviso: false, porcentaje: 0.3 }), '');
  assert.equal(textoPresupuesto({ aviso: true, porcentaje: 0.85 }), 'Llevas el 85 % del tope del mes.');
});
