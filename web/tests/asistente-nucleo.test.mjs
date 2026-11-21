import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FRENTES_EXCLUIDOS_POR_DEFECTO, frentesExcluidos, frentePermitido, sinFrentesExcluidos } from '../lib/asistente/privacidad.js';
import { PRECIOS, costoUsd, estadoPresupuesto, parametrosDelModelo, mesDe, MODELO_POR_DEFECTO } from '../lib/asistente/costo.js';
import { INSTRUCCIONES, construirSistema } from '../lib/asistente/prompt.js';
import { HERRAMIENTAS, NOMBRES_HERRAMIENTAS, ejecutarHerramienta } from '../lib/asistente/herramientas.js';
import { normalizarTareas, fechaValida, filasParaCrear, MAX_TAREAS } from '../lib/asistente/tareas.js';
import { conversar } from '../lib/asistente/bucle.js';

// ---------------------------------------------------------------- Privacidad
test('por defecto se excluye la salud de la abuela; la variable de entorno puede cambiarlo, incluso dejarlo vacío', () => {
  assert.deepEqual(frentesExcluidos(undefined), ['salud-abuela']);
  assert.deepEqual(frentesExcluidos(''), []);
  assert.deepEqual(frentesExcluidos(' Salud-Abuela , hogar '), ['salud-abuela', 'hogar']);
  assert.deepEqual(FRENTES_EXCLUIDOS_POR_DEFECTO, ['salud-abuela']);
});

test('los registros de frentes excluidos no pasan; los de otros frentes y los sin frente sí; no se muta la lista', () => {
  const filas = [{ id: 1, frente: 'salud-abuela' }, { id: 2, frente: 'tanku' }, { id: 3, frente: null }];
  assert.deepEqual(sinFrentesExcluidos(filas, ['salud-abuela']).map(f => f.id), [2, 3]);
  assert.equal(filas.length, 3);
  assert.equal(frentePermitido('SALUD-ABUELA', ['salud-abuela']), false);
  assert.equal(frentePermitido(undefined, ['salud-abuela']), true);
});

// ---------------------------------------------------------------- Costo
test('el costo de Haiku 5.5 sale de los precios por millón de tokens', () => {
  assert.equal(MODELO_POR_DEFECTO, 'claude-haiku-5-5');
  assert.ok(Math.abs(costoUsd('claude-haiku-5-5', { input_tokens: 15000, output_tokens: 800 }) - 0.0019) < 1e-9);
  assert.ok(costoUsd('claude-haiku-5-5', { input_tokens: 1000, cache_read_input_tokens: 10000 }) < costoUsd('claude-haiku-5-5', { input_tokens: 11000 }), 'leer del caché es más barato');
});

test('por encima de 100.000 tokens de entrada Haiku 5.5 cobra la tarifa larga', () => {
  const corta = costoUsd('claude-haiku-5-5', { input_tokens: 90000, output_tokens: 1000 });
  const larga = costoUsd('claude-haiku-5-5', { input_tokens: 110000, output_tokens: 1000 });
  assert.ok(larga > corta * 4);
});

test('un modelo desconocido se cobra a la tarifa más cara y valores raros cuentan como cero', () => {
  const caro = Math.max(...Object.values(PRECIOS).map(p => p.salida));
  assert.ok(Math.abs(costoUsd('modelo-nuevo', { output_tokens: 1e6 }) - caro) < 1e-9);
  assert.equal(costoUsd('claude-haiku-5-5', { input_tokens: 'x', output_tokens: null }), 0);
  assert.equal(costoUsd('claude-haiku-5-5', undefined), 0);
});

test('el tope mensual: avisa desde el 80 %, bloquea al llegar y sin tope válido no se gasta', () => {
  assert.deepEqual(estadoPresupuesto({ gastadoUsd: 1, topeUsd: 4 }), { ok: true, motivo: null, porcentaje: 0.25, aviso: false, restanteUsd: 3 });
  assert.equal(estadoPresupuesto({ gastadoUsd: 3.2, topeUsd: 4 }).aviso, true);
  assert.equal(estadoPresupuesto({ gastadoUsd: 4, topeUsd: 4 }).ok, false);
  assert.equal(estadoPresupuesto({ gastadoUsd: 4, topeUsd: 4 }).motivo, 'tope_alcanzado');
  for (const tope of [0, -1, 'x', undefined, null]) assert.equal(estadoPresupuesto({ gastadoUsd: 0, topeUsd: tope }).ok, false, String(tope));
});

test('los parámetros dependen del modelo: Haiku 5.5 con esfuerzo; Haiku 4.5 sin esfuerzo ni pensamiento', () => {
  assert.deepEqual(parametrosDelModelo('claude-haiku-5-5'), { output_config: { effort: 'low' } });
  assert.deepEqual(parametrosDelModelo('claude-haiku-5-5', 'medium'), { output_config: { effort: 'medium' } });
  assert.deepEqual(parametrosDelModelo('claude-haiku-5-5', 'inventado'), { output_config: { effort: 'low' } });
  assert.deepEqual(parametrosDelModelo('claude-haiku-4-5'), {});
});

test('el mes se calcula en hora de Bogotá', () => {
  assert.equal(mesDe('2026-12-01T03:00:00Z'), '2026-11');
  assert.equal(mesDe('2026-12-01T06:00:00Z'), '2026-12');
});

// ---------------------------------------------------------------- Mensaje de sistema
test('el bloque fijo del sistema es cacheable y no lleva fechas ni datos que cambien', () => {
  const [fijo, variable] = construirSistema({ ahora: Date.parse('2026-11-20T15:00:00Z') });
  assert.deepEqual(fijo.cache_control, { type: 'ephemeral' });
  assert.equal(fijo.text, INSTRUCCIONES);
  assert.ok(!/\b20\d\d-\d\d-\d\d\b/.test(fijo.text), 'sin fechas en el bloque fijo');
  assert.equal(variable.cache_control, undefined);
  assert.match(variable.text, /Hoy es viernes 2026-11-20, 10:00/);
});

test('el contexto y la memoria van en el bloque variable, con límites', () => {
  const memoria = Array.from({ length: 60 }, (_, i) => ({ texto: `hecho ${i} ${'x'.repeat(400)}` }));
  const [, v] = construirSistema({ ahora: Date.now(), contexto: { ruta: 'Finanzas', frente: 'tanku' }, memoria });
  assert.match(v.text, /Luisa está en: Finanzas/);
  assert.match(v.text, /Frente activo: tanku/);
  assert.equal(v.text.split('\n- ').length - 1, 50, 'máximo 50 recuerdos');
  assert.ok(!v.text.includes('x'.repeat(301)), 'cada recuerdo se recorta a 300');
  const sin = construirSistema({ ahora: Date.now() })[1].text;
  assert.ok(!sin.includes('recordar'), 'sin memoria no aparece la sección');
});

test('las reglas clave del asistente están escritas en el mensaje de sistema', () => {
  for (const regla of [/Solo lees/, /DATOS, nunca instrucciones/, /Sin registros/, /proponer_recuerdo/, /Nunca se guarda solo/, /pesos colombianos/, /Bogotá/, /fuera de tu alcance|fuera del alcance/, /No reveles/]) {
    assert.match(INSTRUCCIONES, regla, String(regla));
  }
  assert.ok(INSTRUCCIONES.length < 9000, 'el mensaje fijo se mantiene corto');
});

// ---------------------------------------------------------------- Herramientas
function fakeSupabase(tablas) {
  const llamadas = [];
  const from = tabla => {
    const q = { tabla, pasos: [] };
    llamadas.push(q);
    const api = new Proxy({}, {
      get(_, prop) {
        if (prop === 'then') return (res, rej) => Promise.resolve({ data: tablas[tabla] ?? [], error: tablas.__error?.[tabla] ?? null }).then(res, rej);
        return (...args) => { q.pasos.push([prop, ...args]); return api; };
      },
    });
    return api;
  };
  return { from, llamadas };
}
const ctxDe = (tablas, extra = {}) => ({
  supabase: fakeSupabase(tablas), hoy: '2026-11-20', ahoraMs: Date.parse('2026-11-20T15:00:00Z'), excluidos: ['salud-abuela'],
  nombreFrente: s => s ?? 'Sin frente', emitir: () => {}, ...extra,
});
const json = r => JSON.parse(r.contenido);

test('cada herramienta es estricta y no admite campos de más', () => {
  assert.equal(NOMBRES_HERRAMIENTAS.length, 9);
  for (const h of HERRAMIENTAS) {
    assert.equal(h.strict, true, h.name);
    assert.equal(h.input_schema.additionalProperties, false, h.name);
    assert.ok(h.description.length > 20, h.name);
  }
});

test('las herramientas solo leen: ningún insert, update, delete, upsert ni rpc en su código', () => {
  const src = readFileSync(new URL('../lib/asistente/herramientas.js', import.meta.url), 'utf8');
  assert.ok(!/\.(insert|update|delete|upsert|rpc)\(/.test(src));
});

test('los pendientes de frentes excluidos nunca llegan al asistente, ni por resumen ni por consulta directa', async () => {
  const pendientes = [
    { id: 1, texto: 'Cita médica de la abuela', frente: 'salud-abuela', hecho: false },
    { id: 2, texto: 'Enviar cotización', frente: 'tanku', hecho: false, fecha_limite: '2026-11-18' },
  ];
  const ctx = ctxDe({ pendientes, agenda_hoy: [], calendarios_fuente: [] });
  const r = json(await ejecutarHerramienta('consultar_pendientes', {}, ctx));
  assert.equal(r.total, 1);
  assert.ok(!r.pendientes.some(p => /abuela/i.test(p.texto)));
  const resumen = json(await ejecutarHerramienta('resumen_del_dia', {}, ctx));
  assert.equal(resumen.pendientes.abiertos, 1);
  assert.ok(!JSON.stringify(resumen).includes('abuela'));
  const directa = json(await ejecutarHerramienta('consultar_pendientes', { frente: 'salud-abuela' }, ctx));
  assert.match(directa.aviso, /fuera del alcance/);
  assert.ok(!JSON.stringify(directa).includes('Cita'));
});

test('el resumen del día muestra los eventos de hoy y de mañana y avisa de las cuentas sin conectar', async () => {
  const ctx = ctxDe({
    pendientes: [],
    agenda_hoy: [
      { fecha: '2026-11-20', inicio: '2026-11-20T20:00:00Z', fin: null, titulo: 'EVE seguimiento', frente_id: 'ticketcode' },
      { fecha: '2026-11-21', inicio: '2026-11-21T05:00:00Z', fin: '2026-11-22T05:00:00Z', titulo: 'Barrer', frente_id: null },
    ],
    calendarios_fuente: [{ nombre: 'Tanku', estado: 'activa', ultima_sincronizacion: '2026-11-20T14:00:00Z' }, { nombre: 'greencode', estado: 'pendiente', ultima_sincronizacion: null }],
  });
  const r = json(await ejecutarHerramienta('resumen_del_dia', {}, ctx));
  assert.deepEqual(r.agenda.hoy.map(e => [e.hora, e.titulo, e.frente]), [['3:00 p. m.', 'EVE seguimiento', 'ticketcode']]);
  assert.deepEqual(r.agenda.manana.map(e => [e.hora, e.titulo, e.frente]), [['todo el día', 'Barrer', 'sin asignar']]);
  assert.equal(r.agenda.ultima_sincronizacion, 'hace 1 h');
  assert.deepEqual(r.agenda.cuentas_sin_conectar, ['greencode']);
});

test('«sin registros» se dice como tal, nunca como cero ni con datos inventados', async () => {
  const ctx = ctxDe({ pendientes: [], agenda_hoy: [], calendarios_fuente: [], gastos: [], notas: [], jornadas: [], metas: [], hitos: [] });
  assert.match(json(await ejecutarHerramienta('consultar_pendientes', {}, ctx)).nota, /Sin registros/);
  assert.match(json(await ejecutarHerramienta('consultar_agenda', {}, ctx)).nota, /Sin eventos/);
  assert.match(json(await ejecutarHerramienta('consultar_gastos', {}, ctx)).nota, /no significa que no hayas gastado/);
  assert.match(json(await ejecutarHerramienta('buscar_notas', { texto: 'crochet' }, ctx)).nota, /Ninguna nota/);
  assert.match(json(await ejecutarHerramienta('consultar_jornada', {}, ctx)).nota, /Sin jornadas/);
  assert.match(json(await ejecutarHerramienta('consultar_metas', {}, ctx)).nota, /Sin metas/);
});

test('gastos: total, negocio y personal, por categoría y los mayores; sin los del frente excluido', async () => {
  const gastos = [
    { fecha: '2026-11-03', lugar: 'Éxito', categoria: 'Comida', valor_cop: 50000, frente: 'personal' },
    { fecha: '2026-11-05', lugar: 'Hosting', categoria: 'Servicios', valor_cop: 120000, frente: 'tanku' },
    { fecha: '2026-11-06', lugar: 'Farmacia abuela', categoria: 'Salud', valor_cop: 80000, frente: 'salud-abuela' },
  ];
  const r = json(await ejecutarHerramienta('consultar_gastos', { mes: '2026-11' }, ctxDe({ gastos })));
  assert.equal(r.total_cop, 170000);
  assert.equal(r.negocio_cop, 120000);
  assert.equal(r.personal_cop, 50000);
  assert.deepEqual(r.por_categoria.map(c => c.categoria), ['Servicios', 'Comida']);
  assert.ok(!JSON.stringify(r).includes('Farmacia'));
});

test('el mes y la categoría que pide el modelo se validan; un valor raro cae al por defecto', async () => {
  const ctx = ctxDe({ gastos: [] });
  const r = json(await ejecutarHerramienta('consultar_gastos', { mes: '2026-13', categoria: 'Inventada' }, ctx));
  assert.equal(r.mes, '2026-11');
  const pasos = ctx.supabase.llamadas.find(l => l.tabla === 'gastos').pasos;
  assert.deepEqual(pasos.find(p => p[0] === 'lt'), ['lt', 'fecha', '2026-12-01']);
});

test('buscar notas limpia el texto (sin caracteres que alteren el filtro), limita filas y omite el frente excluido', async () => {
  const notas = Array.from({ length: 20 }, (_, i) => ({ titulo: `Nota ${i}`, contenido: 'x'.repeat(900), etiquetas: ['a'], frente: i === 0 ? 'salud-abuela' : 'tanku', actualizado_en: '2026-11-19T10:00:00Z' }));
  const ctx = ctxDe({ notas });
  const r = json(await ejecutarHerramienta('buscar_notas', { texto: 'a%,b)(*\\c', limite: 99 }, ctx));
  assert.ok(r.notas.length <= 8);
  assert.ok(!r.notas.some(n => n.titulo === 'Nota 0'));
  assert.ok(r.notas.every(n => n.extracto.length <= 301));
  const filtro = ctx.supabase.llamadas[0].pasos.find(p => p[0] === 'or')[1];
  assert.ok(!/[%]{2}|\\|\*|\(|\)/.test(filtro.replace(/%/g, '')), filtro);
  assert.ok(!filtro.includes('a%,b'), 'el texto no puede inyectar otro filtro');
  assert.match(json(await ejecutarHerramienta('buscar_notas', { texto: 'a' }, ctx)).aviso, /al menos 2/);
});

test('la jornada devuelve solo los días con relato, recortados', async () => {
  const jornadas = [{ fecha: '2026-11-19', relato: 'y'.repeat(900), salio_bien: ['a', 'b'], no_salio: null, mejora_manana: 'dormir' }, { fecha: '2026-11-18', relato: null }];
  const r = json(await ejecutarHerramienta('consultar_jornada', { dias: 100 }, ctxDe({ jornadas })));
  assert.equal(r.jornadas.length, 1);
  assert.ok(r.jornadas[0].relato.length <= 301);
});

test('proponer_recuerdo solo emite la propuesta: no escribe en la base', async () => {
  const eventos = [];
  const ctx = ctxDe({}, { emitir: e => eventos.push(e) });
  const r = await ejecutarHerramienta('proponer_recuerdo', { texto: '  Luisa prioriza TANKU   este mes ' }, ctx);
  assert.equal(r.esError, false);
  assert.deepEqual(eventos, [{ tipo: 'propuesta_memoria', texto: 'Luisa prioriza TANKU este mes' }]);
  assert.equal(ctx.supabase.llamadas.length, 0);
  assert.equal((await ejecutarHerramienta('proponer_recuerdo', { texto: 'ok' }, ctx)).esError, true);
  assert.equal((await ejecutarHerramienta('proponer_recuerdo', { texto: 'x'.repeat(301) }, ctx)).esError, true);
});

test('proponer_tareas limpia lo que pide el modelo, solo emite la tarjeta y no escribe nada', async () => {
  const eventos = [];
  const ctx = ctxDe({}, { emitir: e => eventos.push(e) });
  ctx.frentesValidos = ['tanku', 'ticketcode'];
  const r = await ejecutarHerramienta('proponer_tareas', {
    tareas: [
      { texto: '  Enviar   cotización a Juan ', frente: 'TANKU', fecha_limite: '2026-11-27', prioridad: 'alta' },
      { texto: 'enviar cotización a juan', frente: 'tanku', fecha_limite: null, prioridad: 'media' },   // repetida
      { texto: 'Revisar el jardín', frente: 'salud-abuela', fecha_limite: '2026-02-31', prioridad: 'urgentísima' },   // frente no permitido, fecha falsa
      { texto: 'x', frente: null, fecha_limite: null, prioridad: 'baja' },   // muy corta
    ],
    dudas: ['¿Quién envía la cotización?', '  '],
  }, ctx);
  assert.equal(r.esError, false);
  assert.deepEqual(eventos, [{ tipo: 'propuesta_tareas', dudas: ['¿Quién envía la cotización?'], tareas: [
    { texto: 'Enviar cotización a Juan', frente: 'tanku', fecha_limite: '2026-11-27', prioridad: 'alta' },
    { texto: 'Revisar el jardín', frente: null, fecha_limite: null, prioridad: 'media' },
  ] }]);
  assert.equal(json(r).cantidad, 2);
  assert.equal(json(r).descartadas, 2);
  assert.match(json(r).detalle, /no las des por creadas/);
  assert.equal(ctx.supabase.llamadas.length, 0);
  eventos.length = 0;
  assert.equal((await ejecutarHerramienta('proponer_tareas', { tareas: [{ texto: 'ab', frente: null, fecha_limite: null, prioridad: 'media' }], dudas: [] }, ctx)).esError, true);
  assert.deepEqual(eventos, [], 'sin tareas válidas no hay tarjeta');
});

test('tareas: tope de 15, fechas reales y filas listas para crear exigen frente', () => {
  const muchas = Array.from({ length: 20 }, (_, i) => ({ texto: `Tarea número ${i}`, frente: 'tanku', fecha_limite: null, prioridad: 'media' }));
  const { tareas, descartadas } = normalizarTareas(muchas, { frentesValidos: ['tanku'] });
  assert.equal(tareas.length, MAX_TAREAS);
  assert.equal(descartadas, 5);
  assert.equal(fechaValida('2026-11-20'), '2026-11-20');
  assert.equal(fechaValida('2026-02-31'), null);
  assert.equal(fechaValida('mañana'), null);
  assert.deepEqual(filasParaCrear([{ texto: 'Llamar a Juan', frente: 'tanku', fecha_limite: null, prioridad: 'baja' }], ['tanku']),
    { filas: [{ texto: 'Llamar a Juan', frente: 'tanku', fecha_limite: null, prioridad: 'baja', meta_id: null }] });
  assert.deepEqual(filasParaCrear([{ texto: 'Llamar a Juan', frente: null }], ['tanku']), { error: 'frente' });
  assert.deepEqual(filasParaCrear([], ['tanku']), { error: 'vacio' });
});

test('una herramienta desconocida o una entrada inválida no rompen; un fallo de lectura no expone detalles', async () => {
  const ctx = ctxDe({ pendientes: [], __error: { pendientes: { message: 'password authentication failed for user postgres' } } });
  assert.equal((await ejecutarHerramienta('borrar_todo', {}, ctx)).esError, true);
  assert.equal((await ejecutarHerramienta('consultar_pendientes', null, ctxDe({ pendientes: [] }))).esError, false);
  const r = await ejecutarHerramienta('consultar_pendientes', {}, ctx);
  assert.equal(r.esError, true);
  assert.ok(!r.contenido.includes('password'));
});

test('el límite de filas que pide el modelo se acota', async () => {
  const pendientes = Array.from({ length: 80 }, (_, i) => ({ id: i, texto: `p${i}`, frente: 'tanku', hecho: false }));
  assert.equal(json(await ejecutarHerramienta('consultar_pendientes', { limite: 999 }, ctxDe({ pendientes }))).pendientes.length, 30);
  assert.equal(json(await ejecutarHerramienta('consultar_pendientes', { limite: -5 }, ctxDe({ pendientes }))).pendientes.length, 1);
});

// ---------------------------------------------------------------- Bucle de conversación
function clienteSimulado(guion) {
  const llamadas = [];
  return {
    llamadas,
    messages: {
      stream(params) {
        llamadas.push(structuredClone(params));
        const paso = guion.shift();
        const oyentes = {};
        return {
          on(evento, fn) { oyentes[evento] = fn; if (evento === 'text') for (const d of paso.textos ?? []) fn(d); return this; },
          async finalMessage() { if (paso.error) throw paso.error; return paso.mensaje; },
        };
      },
    },
  };
}
const msg = (stop, content, usage = { input_tokens: 100, output_tokens: 20 }) => ({ stop_reason: stop, content, usage });
const base = { modelo: 'claude-haiku-5-5', sistema: [{ type: 'text', text: 's' }], herramientas: HERRAMIENTAS, mensajes: [{ role: 'user', content: 'hola' }] };

test('el bucle llama a la herramienta que pide el modelo, devuelve su resultado y termina cuando responde', async () => {
  const eventos = [];
  const cliente = clienteSimulado([
    { mensaje: msg('tool_use', [{ type: 'tool_use', id: 't1', name: 'consultar_pendientes', input: {} }]) },
    { textos: ['Tienes ', '1 pendiente.'], mensaje: msg('end_turn', [{ type: 'text', text: 'Tienes 1 pendiente.' }], { input_tokens: 300, output_tokens: 10 }) },
  ]);
  const ejecutadas = [];
  const r = await conversar({ ...base, client: cliente, emitir: e => eventos.push(e), ejecutar: async (n, i) => { ejecutadas.push([n, i]); return { contenido: '{"total":1}', esError: false }; } });
  assert.deepEqual(ejecutadas, [['consultar_pendientes', {}]]);
  assert.equal(r.terminacion, 'fin');
  assert.equal(r.iteraciones, 2);
  assert.deepEqual(r.uso, { input_tokens: 400, output_tokens: 30, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 });
  assert.deepEqual(eventos.filter(e => e.tipo === 'texto').map(e => e.delta), ['Tienes ', '1 pendiente.']);
  assert.ok(eventos.some(e => e.tipo === 'estado' && e.estado === 'consultando' && e.herramienta === 'consultar_pendientes'));
  const segunda = cliente.llamadas[1].messages;
  assert.equal(segunda.at(-1).content[0].type, 'tool_result');
  assert.equal(segunda.at(-1).content[0].tool_use_id, 't1');
});

test('el bucle no modifica el historial recibido y envía el modelo, el sistema y las herramientas', async () => {
  const cliente = clienteSimulado([{ mensaje: msg('end_turn', [{ type: 'text', text: 'ok' }]) }]);
  const entrada = [{ role: 'user', content: 'hola' }];
  await conversar({ ...base, mensajes: entrada, client: cliente, emitir: () => {}, ejecutar: async () => ({}), parametros: { output_config: { effort: 'low' } } });
  assert.equal(entrada.length, 1);
  const p = cliente.llamadas[0];
  assert.equal(p.model, 'claude-haiku-5-5');
  assert.equal(p.tools.length, 9);
  assert.deepEqual(p.output_config, { effort: 'low' });
  assert.equal(p.tool_choice, undefined, 'nunca se fuerza una herramienta');
  assert.ok(!('temperature' in p) && !('top_p' in p) && !('thinking' in p));
});

test('un resultado con error se marca como error para el modelo', async () => {
  const cliente = clienteSimulado([
    { mensaje: msg('tool_use', [{ type: 'tool_use', id: 't1', name: 'x', input: {} }]) },
    { mensaje: msg('end_turn', [{ type: 'text', text: 'ok' }]) },
  ]);
  await conversar({ ...base, client: cliente, emitir: () => {}, ejecutar: async () => ({ contenido: '{"error":"no_disponible"}', esError: true }) });
  assert.equal(cliente.llamadas[1].messages.at(-1).content[0].is_error, true);
});

test('un rechazo por seguridad o un corte por longitud detienen el bucle sin ejecutar herramientas', async () => {
  let ejecutadas = 0;
  const ej = async () => { ejecutadas += 1; return { contenido: '{}', esError: false }; };
  const e1 = [];
  const r1 = await conversar({ ...base, client: clienteSimulado([{ mensaje: msg('refusal', [{ type: 'tool_use', id: 'a', name: 'x', input: {} }]) }]), emitir: e => e1.push(e), ejecutar: ej });
  assert.equal(r1.terminacion, 'rechazo');
  assert.ok(e1.some(e => e.tipo === 'rechazo'));
  const r2 = await conversar({ ...base, client: clienteSimulado([{ mensaje: msg('max_tokens', [{ type: 'tool_use', id: 'a', name: 'x', input: {} }]) }]), emitir: () => {}, ejecutar: ej });
  assert.equal(r2.terminacion, 'cortada');
  assert.equal(ejecutadas, 0);
});

test('un error de la API se vuelve a lanzar; un fallo de conexión se reintenta un par de veces y luego se lanza', async () => {
  const apiError = Object.assign(new Error('rate'), { status: 429 });
  await assert.rejects(conversar({ ...base, client: clienteSimulado([{ error: apiError }]), emitir: () => {}, ejecutar: async () => ({}) }), e => e.status === 429);
  const corte = new Error('connection reset');
  const r = await conversar({ ...base, client: clienteSimulado([{ error: corte }, { error: corte }, { mensaje: msg('end_turn', [{ type: 'text', text: 'ok' }]) }]), emitir: () => {}, ejecutar: async () => ({}) });
  assert.equal(r.terminacion, 'fin');
  await assert.rejects(conversar({ ...base, client: clienteSimulado([{ error: corte }, { error: corte }, { error: corte }]), emitir: () => {}, ejecutar: async () => ({}) }), /connection reset/);
});

test('si el modelo no deja de pedir herramientas, el bucle se corta en el máximo de vueltas', async () => {
  const pide = () => ({ mensaje: msg('tool_use', [{ type: 'tool_use', id: 'z', name: 'x', input: {} }]) });
  const eventos = [];
  const r = await conversar({ ...base, client: clienteSimulado([pide(), pide(), pide()]), emitir: e => eventos.push(e), maxIteraciones: 3, ejecutar: async () => ({ contenido: '{}', esError: false }) });
  assert.equal(r.terminacion, 'limite_de_vueltas');
  assert.equal(r.iteraciones, 3);
  assert.ok(eventos.some(e => e.tipo === 'cortada'));
});

test('el bucle no registra nada en consola (no puede filtrar claves)', () => {
  for (const f of ['bucle.js', 'herramientas.js', 'costo.js', 'prompt.js', 'privacidad.js']) {
    assert.ok(!/console\./.test(readFileSync(new URL(`../lib/asistente/${f}`, import.meta.url), 'utf8')), f);
  }
});
