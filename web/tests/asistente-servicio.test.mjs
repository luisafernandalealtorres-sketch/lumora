import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { atender, validarMensajes, codigoDeError, LIMITE_HISTORIAL, MAX_CARACTERES } from '../lib/asistente/servicio.js';

// Base simulada: rpc, lecturas con cadena (thenable) e inserciones registradas.
function baseSimulada({ gasto = 0, errorGasto = null, memoria = [], frentes = [], tablas = {}, errorInsert = null } = {}) {
  const inserciones = [], rpcs = [], lecturas = [];
  return {
    inserciones, rpcs, lecturas,
    rpc: async nombre => { rpcs.push(nombre); return { data: errorGasto ? null : gasto, error: errorGasto }; },
    from(tabla) {
      lecturas.push(tabla);
      const datos = tabla === 'asistente_memoria' ? memoria : tabla === 'frentes' ? frentes : tablas[tabla] ?? [];
      const api = new Proxy({}, {
        get(_, prop) {
          if (prop === 'then') return (res, rej) => Promise.resolve({ data: datos, error: null }).then(res, rej);
          if (prop === 'insert') return async fila => { inserciones.push({ tabla, fila }); return { error: errorInsert }; };
          return () => api;
        },
      });
      return api;
    },
  };
}
const msg = (stop, content, usage = { input_tokens: 1000, output_tokens: 100 }) => ({ stop_reason: stop, content, usage });
function clienteDe(guion) {
  const llamadas = [];
  return {
    llamadas,
    messages: { stream(params) { llamadas.push(params); const paso = guion.shift(); return { on(ev, fn) { if (ev === 'text') for (const d of paso.textos ?? []) fn(d); return this; }, async finalMessage() { if (paso.error) throw paso.error; return paso.mensaje; } }; } },
  };
}
const entorno = { modelo: 'claude-haiku-5-5', topeUsd: 4, esfuerzo: 'low', frentesExcluidos: undefined };
const AHORA = Date.parse('2026-11-20T15:00:00Z');
const base = { mensajes: [{ role: 'user', content: '¿qué tengo hoy?' }], contexto: { ruta: 'Home', frente: '' }, ahora: AHORA, entorno };

test('el historial del navegador se valida: solo texto, roles permitidos, empieza y termina con el usuario, y se recorta', () => {
  assert.equal(validarMensajes([]).ok, false);
  assert.equal(validarMensajes(null).ok, false);
  assert.equal(validarMensajes([{ role: 'system', content: 'x' }]).ok, false);
  assert.equal(validarMensajes([{ role: 'user', content: { texto: 'x' } }]).ok, false);
  assert.equal(validarMensajes([{ role: 'user', content: 'hola' }, { role: 'assistant', content: 'ok' }]).ok, false, 'debe terminar en el usuario');
  assert.deepEqual(validarMensajes([{ role: 'assistant', content: 'a' }, { role: 'user', content: ' hola ' }]).mensajes, [{ role: 'user', content: 'hola' }]);
  const largo = Array.from({ length: 40 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'x'.repeat(MAX_CARACTERES + 50) }));
  largo.push({ role: 'user', content: 'último' });
  const r = validarMensajes(largo);
  assert.ok(r.mensajes.length <= LIMITE_HISTORIAL);
  assert.ok(r.mensajes.every(m => m.content.length <= MAX_CARACTERES));
  assert.equal(r.mensajes.at(-1).content, 'último');
});

test('sin clave de Anthropic no se hace nada: ni consulta del gasto ni de datos', async () => {
  const supabase = baseSimulada();
  const r = await atender({ ...base, supabase, cliente: null, emitir: () => {} });
  assert.deepEqual(r, { ok: false, codigo: 'sin_configurar' });
  assert.equal(supabase.rpcs.length, 0);
});

test('si no se puede medir el gasto o ya se llegó al tope, NO se llama a Claude', async () => {
  for (const [opciones, codigo] of [[{ errorGasto: { message: 'no existe' } }, 'sin_presupuesto'], [{ gasto: 4 }, 'tope_alcanzado'], [{ gasto: 99 }, 'tope_alcanzado']]) {
    const cliente = clienteDe([{ mensaje: msg('end_turn', []) }]);
    const r = await atender({ ...base, supabase: baseSimulada(opciones), cliente, emitir: () => {} });
    assert.equal(r.codigo, codigo);
    assert.equal(cliente.llamadas.length, 0);
  }
  const sinTope = await atender({ ...base, entorno: { ...entorno, topeUsd: NaN }, supabase: baseSimulada(), cliente: clienteDe([]), emitir: () => {} });
  assert.equal(sinTope.codigo, 'sin_tope');
});

test('una conversación normal responde, registra el uso con su costo y avisa del presupuesto', async () => {
  const supabase = baseSimulada({ gasto: 3.4 });
  const eventos = [];
  const cliente = clienteDe([{ textos: ['Hoy tienes 2 eventos.'], mensaje: msg('end_turn', [{ type: 'text', text: 'Hoy tienes 2 eventos.' }], { input_tokens: 15000, output_tokens: 800 }) }]);
  const r = await atender({ ...base, supabase, cliente, emitir: e => eventos.push(e) });
  assert.equal(r.ok, true);
  assert.deepEqual(supabase.inserciones.map(i => i.tabla), ['asistente_uso']);
  const fila = supabase.inserciones[0].fila;
  assert.deepEqual([fila.modelo, fila.entrada, fila.salida, fila.costo_usd], ['claude-haiku-5-5', 15000, 800, 0.0019]);
  const fin = eventos.find(e => e.tipo === 'fin');
  assert.equal(fin.costoUsd, 0.0019);
  assert.equal(fin.presupuesto.aviso, true, 'con 3,40 de 4,00 ya está sobre el 80 %');
  assert.deepEqual(eventos.filter(e => e.tipo === 'texto').map(e => e.delta), ['Hoy tienes 2 eventos.']);
});

test('la memoria aprobada y el contexto llegan al mensaje de sistema; la petición no fuerza herramientas ni lleva muestreo', async () => {
  const supabase = baseSimulada({ memoria: [{ texto: 'Luisa prioriza TANKU' }] });
  const cliente = clienteDe([{ mensaje: msg('end_turn', [{ type: 'text', text: 'ok' }]) }]);
  await atender({ ...base, supabase, cliente, contexto: { ruta: 'Finanzas', frente: 'tanku' }, emitir: () => {} });
  const p = cliente.llamadas[0];
  const sistema = p.system.map(b => b.text).join('\n');
  assert.match(sistema, /Luisa prioriza TANKU/);
  assert.match(sistema, /Luisa está en: Finanzas/);
  assert.equal(p.model, 'claude-haiku-5-5');
  assert.deepEqual(p.output_config, { effort: 'low' });
  assert.equal(p.tool_choice, undefined);
  assert.equal(p.temperature, undefined);
  assert.equal(p.tools.length, 8);
});

test('una herramienta pedida por el modelo se ejecuta con la sesión del usuario y respeta los frentes excluidos', async () => {
  const supabase = baseSimulada({ tablas: { pendientes: [{ id: 1, texto: 'Cita de la abuela', frente: 'salud-abuela', hecho: false }, { id: 2, texto: 'Cotización', frente: 'tanku', hecho: false }] } });
  const cliente = clienteDe([
    { mensaje: msg('tool_use', [{ type: 'tool_use', id: 't1', name: 'consultar_pendientes', input: {} }]) },
    { mensaje: msg('end_turn', [{ type: 'text', text: 'listo' }]) },
  ]);
  await atender({ ...base, supabase, cliente, emitir: () => {} });
  const resultado = cliente.llamadas[1].messages.at(-1).content[0].content;
  assert.match(resultado, /Cotización/);
  assert.ok(!resultado.includes('abuela'));
  const sinExcluir = clienteDe([
    { mensaje: msg('tool_use', [{ type: 'tool_use', id: 't1', name: 'consultar_pendientes', input: {} }]) },
    { mensaje: msg('end_turn', [{ type: 'text', text: 'listo' }]) },
  ]);
  await atender({ ...base, supabase, cliente: sinExcluir, entorno: { ...entorno, frentesExcluidos: '' }, emitir: () => {} });
  assert.match(sinExcluir.llamadas[1].messages.at(-1).content[0].content, /abuela/, 'si Luisa lo permite, aparece');
});

test('una propuesta de memoria llega al navegador y no se guarda nada', async () => {
  const supabase = baseSimulada();
  const eventos = [];
  const cliente = clienteDe([
    { mensaje: msg('tool_use', [{ type: 'tool_use', id: 't1', name: 'proponer_recuerdo', input: { texto: 'Luisa revisa la semana los domingos' } }]) },
    { mensaje: msg('end_turn', [{ type: 'text', text: '¿Lo guardo?' }]) },
  ]);
  await atender({ ...base, supabase, cliente, emitir: e => eventos.push(e) });
  assert.deepEqual(eventos.find(e => e.tipo === 'propuesta_memoria'), { tipo: 'propuesta_memoria', texto: 'Luisa revisa la semana los domingos' });
  assert.ok(!supabase.inserciones.some(i => i.tabla === 'asistente_memoria'), 'solo se guarda con la aprobación de Luisa, desde la pantalla');
});

test('si la API falla se devuelve un código seguro (no el mensaje) y se registra el uso acumulado', async () => {
  const supabase = baseSimulada();
  const cliente = clienteDe([
    { mensaje: msg('tool_use', [{ type: 'tool_use', id: 't1', name: 'resumen_del_dia', input: {} }], { input_tokens: 5000, output_tokens: 50 }) },
    { error: Object.assign(new Error('sk-ant-CLAVE-SECRETA invalid'), { status: 401 }) },
  ]);
  const eventos = [];
  const r = await atender({ ...base, supabase, cliente, emitir: e => eventos.push(e) });
  assert.deepEqual([r.ok, r.codigo], [false, 'credenciales']);
  assert.ok(!JSON.stringify(eventos).includes('sk-ant'));
  assert.equal(supabase.inserciones.length, 1);
  assert.equal(supabase.inserciones[0].fila.entrada, 5000);
});

test('un fallo al registrar el uso se avisa, y el costo calculado no se pierde', async () => {
  const supabase = baseSimulada({ errorInsert: { message: 'rls' } });
  const eventos = [];
  const cliente = clienteDe([{ mensaje: msg('end_turn', [{ type: 'text', text: 'ok' }]) }]);
  const r = await atender({ ...base, supabase, cliente, emitir: e => eventos.push(e) });
  assert.equal(r.ok, true);
  assert.ok(eventos.some(e => e.tipo === 'aviso' && e.codigo === 'uso_no_registrado'));
});

test('los códigos de error de la API se traducen a códigos cortos', () => {
  assert.equal(codigoDeError({ status: 401 }), 'credenciales');
  assert.equal(codigoDeError({ status: 429 }), 'limite');
  assert.equal(codigoDeError({ status: 400 }), 'solicitud');
  assert.equal(codigoDeError({ status: 529 }), 'servicio');
  assert.equal(codigoDeError(new Error('reset')), 'conexion');
});

test('la ruta exige sesión, no expone la clave ni se declara pública, y valida la entrada antes de gastar', () => {
  const ruta = readFileSync(new URL('../app/api/asistente/route.js', import.meta.url), 'utf8');
  assert.match(ruta, /auth\.getUser\(\)/);
  assert.ok(ruta.indexOf('auth.getUser()') < ruta.indexOf('validarMensajes(cuerpo'));
  assert.ok(ruta.indexOf('validarMensajes(cuerpo') < ruta.indexOf('new Anthropic('));
  assert.ok(!/NEXT_PUBLIC_.*ANTHROPIC|ANTHROPIC.*NEXT_PUBLIC_/.test(ruta));
  assert.ok(!/console\./.test(ruta));
  assert.ok(!/api\/asistente/.test(readFileSync(new URL('../middleware.js', import.meta.url), 'utf8')), 'la ruta no es pública');
  assert.match(readFileSync(new URL('../lib/asistente/servicio.js', import.meta.url), 'utf8'), /asistente_gasto_mes/);
});
