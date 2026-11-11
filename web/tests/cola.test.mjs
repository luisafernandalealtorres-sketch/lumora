// Cola sin conexión (etapa 4, cliente): orden, idempotencia, conservación de rechazos y aislamiento por usuario.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearCola, almacenEnMemoria, almacenPorUsuario, enviadorRpc, esErrorReintentable } from '../lib/cola/cola.js';
import { crearServicioHabitos } from '../lib/data/habitos.js';
import { crearIdentidadDispositivo } from '../lib/data/rpc.js';

const memoria = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const H = '22222222-2222-2222-2222-222222222222';
const op = (n, extra = {}) => ({ opId: `op-${n}`, dispositivoId: 'd1', seq: n, tipo: 'habito_registrar_manual', rpc: 'habito_registrar_manual', args: { p_habito_id: H, p_fecha: '2026-11-1' + n, p_segundos: n * 60 }, ...extra });
const redCaida = () => Object.assign(new TypeError('Failed to fetch'));

test('se envían en orden de seq aunque se hayan guardado desordenadas', async () => {
  const enviados = [];
  const c = crearCola({ almacen: almacenEnMemoria(), enviar: async o => { enviados.push(o.seq); } });
  await c.encolar(op(3)); await c.encolar(op(1)); await c.encolar(op(2));
  const r = await c.enviarPendientes();
  assert.deepEqual(enviados, [1, 2, 3]);
  assert.equal(r.enviadas, 3); assert.equal(r.pendientes, 0);
});

test('sin conexión no se envía nada y todo se conserva', async () => {
  let llamadas = 0;
  const c = crearCola({ almacen: almacenEnMemoria(), enviar: async () => { llamadas++; }, enLinea: () => false });
  await c.encolar(op(1));
  const r = await c.enviarPendientes();
  assert.equal(llamadas, 0); assert.equal(r.detenida, 'sin_conexion'); assert.equal(r.pendientes, 1);
});

test('un fallo de red detiene el envío y conserva todo, incluida la que falló', async () => {
  let n = 0;
  const c = crearCola({ almacen: almacenEnMemoria(), enviar: async () => { if (++n === 2) throw redCaida(); } });
  await c.encolar(op(1)); await c.encolar(op(2)); await c.encolar(op(3));
  const r = await c.enviarPendientes();
  assert.equal(r.enviadas, 1); assert.equal(r.detenida, 'reintentable'); assert.equal(r.pendientes, 2);
  assert.deepEqual((await c.pendientes()).map(o => o.seq), [2, 3]);
});

test('un rechazo del servidor se conserva con su motivo y no frena las siguientes', async () => {
  const c = crearCola({ almacen: almacenEnMemoria(), enviar: async o => { if (o.seq === 2) throw Object.assign(new Error('sin_ocurrencia'), { code: 'P0001' }); } });
  await c.encolar(op(1)); await c.encolar(op(2)); await c.encolar(op(3));
  const r = await c.enviarPendientes();
  assert.equal(r.enviadas, 2); assert.equal(r.rechazadas, 1);
  const rech = await c.rechazadas();
  assert.equal(rech.length, 1); assert.equal(rech[0].motivo, 'sin_ocurrencia'); assert.equal(rech[0].estado, 'rechazada');
  assert.equal((await c.pendientes()).length, 0);
  await c.descartarRechazada('op-2');           // solo la decisión explícita la quita
  assert.equal((await c.rechazadas()).length, 0);
});

test('un reintento no duplica: la misma op_id, dispositivo y seq viajan siempre', async () => {
  const llamadas = [];
  const supabase = { rpc: async (n, a) => { llamadas.push({ n, a }); return llamadas.length === 1 ? { data: null, error: { message: 'Failed to fetch' } } : { data: { ok: 1 }, error: null }; } };
  const c = crearCola({ almacen: almacenEnMemoria(), enviar: enviadorRpc(supabase) });
  await c.encolar(op(1));
  await c.enviarPendientes(); await c.enviarPendientes();
  assert.equal(llamadas.length, 2);
  assert.deepEqual(llamadas[0].a, llamadas[1].a);
  assert.equal(llamadas[1].a.p_op_id, 'op-1'); assert.equal(llamadas[1].a.p_seq, 1); assert.equal(llamadas[1].a.p_dispositivo_id, 'd1');
  assert.equal((await c.pendientes()).length, 0);
});

test('dos envíos simultáneos no reenvían dos veces', async () => {
  let n = 0;
  const c = crearCola({ almacen: almacenEnMemoria(), enviar: async () => { n++; await new Promise(r => setTimeout(r, 5)); } });
  await c.encolar(op(1));
  await Promise.all([c.enviarPendientes(), c.enviarPendientes()]);
  assert.equal(n, 1);
});

test('la sesión caducada es reintentable; un código de la base es rechazo', () => {
  assert.equal(esErrorReintentable({ status: 401, message: 'x' }), true);
  assert.equal(esErrorReintentable({ message: 'JWT expired' }), true);
  assert.equal(esErrorReintentable(new TypeError('Failed to fetch')), true);
  assert.equal(esErrorReintentable({ code: '42501', message: 'permission denied' }), false);
  assert.equal(esErrorReintentable({ code: 'P0001', message: 'fecha_no_permitida' }), false);
  assert.equal(esErrorReintentable(null), false);
});

test('aislamiento por usuario: cada usuario abre su propia base', async () => {
  const abiertas = [];
  const fabrica = id => { abiertas.push(id); return almacenEnMemoria(); };
  const a = almacenPorUsuario(async () => 'user-A', fabrica);
  await a.guardar({ op_id: 'x', seq: 1 });
  const b = almacenPorUsuario(async () => 'user-B', fabrica);
  assert.equal((await b.todas()).length, 0);
  assert.deepEqual(abiertas, ['user-A', 'user-B']);
});

test('sin IndexedDB el almacén falla de forma visible, no en silencio', async () => {
  const a = almacenPorUsuario(async () => 'u', () => null);
  await assert.rejects(() => a.guardar({ op_id: 'x', seq: 1 }), /sin conexión/);
});

test('registrarManual sin conexión se encola y devuelve { encolada: true } sin llamar al servidor', async () => {
  let rpcs = 0;
  const supabase = { rpc: async () => { rpcs++; return { data: {}, error: null }; } };
  const cola = crearCola({ almacen: almacenEnMemoria(), enviar: enviadorRpc(supabase), enLinea: () => false });
  const s = crearServicioHabitos(supabase, { identidad: crearIdentidadDispositivo({ almacen: memoria() }), cola, enLinea: () => false });
  const r = await s.registrarManual({ habitoId: H, fecha: '2026-11-11', segundos: 600 });
  assert.deepEqual(r, { encolada: true }); assert.equal(rpcs, 0);
  const p = await s.pendientesCola();
  assert.equal(p.length, 1); assert.equal(p[0].args.p_segundos, 600);
});

test('registrarManual con la red caída a mitad de camino se encola con la MISMA op_id que se intentó', async () => {
  const vistas = [];
  const supabase = { rpc: async (n, a) => { vistas.push(a.p_op_id); return { data: null, error: { message: 'Failed to fetch' } }; } };
  const cola = crearCola({ almacen: almacenEnMemoria(), enviar: enviadorRpc(supabase) });
  const s = crearServicioHabitos(supabase, { identidad: crearIdentidadDispositivo({ almacen: memoria() }), cola, enLinea: () => true });
  const r = await s.registrarManual({ habitoId: H, fecha: '2026-11-11', segundos: 600 });
  assert.deepEqual(r, { encolada: true });
  assert.equal((await s.pendientesCola())[0].op_id, vistas[0]);
});

test('registrarManual: un rechazo del servidor se lanza (no se encola) y sin cola todo sigue igual', async () => {
  const supabase = { rpc: async () => ({ data: null, error: { code: 'P0001', message: 'sin_ocurrencia' } }) };
  const cola = crearCola({ almacen: almacenEnMemoria(), enviar: enviadorRpc(supabase) });
  const s = crearServicioHabitos(supabase, { identidad: crearIdentidadDispositivo({ almacen: memoria() }), cola });
  await assert.rejects(() => s.registrarManual({ habitoId: H, fecha: '2026-11-11', segundos: 1 }), e => e.message === 'sin_ocurrencia');
  assert.equal((await s.pendientesCola()).length, 0);
  const s2 = crearServicioHabitos(supabase, { identidad: crearIdentidadDispositivo({ almacen: memoria() }) });
  await assert.rejects(() => s2.registrarManual({ habitoId: H, fecha: '2026-11-11', segundos: 1 }));
});
