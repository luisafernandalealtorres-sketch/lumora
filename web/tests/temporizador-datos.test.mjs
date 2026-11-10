// Contrato entre la capa de datos y el SQL v1.11: los nombres de parámetros de cada RPC se comparan con las firmas
// reales de docs/sql/v1.11 (así un nombre mal escrito falla aquí y no en producción). No simula persistencia: la
// persistencia real se prueba contra PostgreSQL local en tests/integracion-local (ver su README).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { crearServicio, crearIdentidadDispositivo, ejecutar } from '../lib/data/temporizador.js';

const sql = ['etapa2_aplicar.sql', 'etapa3_aplicar.sql'].map(f => readFileSync(new URL(`../../docs/sql/v1.11/${f}`, import.meta.url), 'utf8')).join('\n');

function firma(nombre) {
  const m = new RegExp(`create or replace function public\\.${nombre}\\(([^)]*)\\)`, 'i').exec(sql);
  assert.ok(m, `no existe la función ${nombre} en el SQL v1.11`);
  return m[1].split(',').map(p => p.trim()).filter(Boolean).map(p => ({ nombre: p.split(/\s+/)[0], obligatorio: !/\bdefault\b/i.test(p) }));
}

function clienteGrabador(respuesta = { data: { id: 'x' }, error: null }) {
  const llamadas = [];
  return { llamadas, rpc: async (nombre, args) => { llamadas.push({ nombre, args }); return respuesta; } };
}
const memoria = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const UUID = '22222222-2222-2222-2222-222222222222';

const CASOS = [
  ['focusIniciar', [{ modalidad: 'productivity', frenteId: 'tanku' }], 'focus_iniciar'],
  ['focusPausar', [UUID], 'focus_pausar'], ['focusReanudar', [UUID], 'focus_reanudar'],
  ['focusCompletar', [UUID], 'focus_completar'], ['focusCancelar', [UUID], 'focus_cancelar'],
  ['descansoIniciar', [{ tipo: 'corto' }], 'descanso_iniciar'], ['descansoPausar', [UUID], 'descanso_pausar'],
  ['descansoReanudar', [UUID], 'descanso_reanudar'], ['descansoCompletar', [UUID], 'descanso_completar'],
  ['descansoOmitir', [{ tipo: 'largo' }], 'descanso_omitir'], ['descansoCancelar', [UUID], 'descanso_cancelar'],
  ['habitoIniciar', [UUID], 'habito_timer_iniciar'], ['habitoPausar', [UUID], 'habito_timer_pausar'],
  ['habitoReanudar', [UUID], 'habito_timer_reanudar'], ['habitoFinalizar', [UUID], 'habito_timer_finalizar'],
  ['habitoCancelar', [UUID], 'habito_timer_cancelar'],
];

for (const [metodo, args, rpcEsperada] of CASOS) {
  test(`${metodo} llama a ${rpcEsperada} con parámetros que existen en el SQL v1.11`, async () => {
    const c = clienteGrabador();
    const s = crearServicio(c, { identidad: crearIdentidadDispositivo({ almacen: memoria() }) });
    await s[metodo](...args);
    assert.equal(c.llamadas.length, 1);
    assert.equal(c.llamadas[0].nombre, rpcEsperada);
    const enviados = Object.keys(c.llamadas[0].args);
    const sig = firma(rpcEsperada);
    for (const e of enviados) assert.ok(sig.some(p => p.nombre === e), `${e} no es parámetro de ${rpcEsperada}`);
    for (const p of sig.filter(x => x.obligatorio)) assert.ok(enviados.includes(p.nombre), `falta el parámetro obligatorio ${p.nombre}`);
    assert.match(c.llamadas[0].args.p_op_id, /^[0-9a-f-]{36}$/);
    assert.match(c.llamadas[0].args.p_dispositivo_id, /^[0-9a-f-]{36}$/);
    assert.ok(Number.isInteger(c.llamadas[0].args.p_seq) && c.llamadas[0].args.p_seq >= 0);
  });
}

test('cada operación lleva un op_id distinto y la secuencia crece', async () => {
  const c = clienteGrabador();
  const s = crearServicio(c, { identidad: crearIdentidadDispositivo({ almacen: memoria() }) });
  await s.focusPausar(UUID); await s.focusPausar(UUID);
  const [a, b] = c.llamadas.map(x => x.args);
  assert.notEqual(a.p_op_id, b.p_op_id);
  assert.ok(b.p_seq > a.p_seq);
  assert.equal(a.p_dispositivo_id, b.p_dispositivo_id);
});

test('identidad del dispositivo: estable entre cargas con almacén, secuencia nunca retrocede', () => {
  const alm = memoria();
  const reloj = 1000;
  const a = crearIdentidadDispositivo({ almacen: alm, ahora: () => reloj });
  const s1 = a.siguienteSeq(); const s2 = a.siguienteSeq();
  assert.ok(s2 > s1);
  const b = crearIdentidadDispositivo({ almacen: alm, ahora: () => 5 });   // reloj atrasado tras recargar
  assert.equal(b.dispositivoId, a.dispositivoId);
  assert.ok(b.siguienteSeq() > s2);
});

test('sin almacén: id nuevo en cada carga (la secuencia no puede chocar) y no falla', () => {
  const a = crearIdentidadDispositivo({ almacen: null }); const b = crearIdentidadDispositivo({ almacen: null });
  assert.notEqual(a.dispositivoId, b.dispositivoId);
  assert.ok(a.siguienteSeq() < a.siguienteSeq());
});

test('dos pestañas del mismo dispositivo no repiten la secuencia', () => {
  const alm = memoria();
  const a = crearIdentidadDispositivo({ almacen: alm, ahora: () => 10 });
  const b = crearIdentidadDispositivo({ almacen: alm, ahora: () => 10 });
  const vistos = new Set();
  for (let i = 0; i < 20; i++) { vistos.add(a.siguienteSeq()); vistos.add(b.siguienteSeq()); }
  assert.equal(vistos.size, 40);
});

test('un choque de secuencia (23505) se reintenta una vez con la misma op_id', async () => {
  const llamadas = [];
  const cliente = { rpc: async (n, a) => { llamadas.push(a); return llamadas.length === 1 ? { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "operaciones_user_id_dispositivo_id_seq_key"' } } : { data: { id: 'ok' }, error: null }; } };
  const s = crearServicio(cliente, { identidad: crearIdentidadDispositivo({ almacen: memoria() }) });
  const r = await s.focusPausar(UUID);
  assert.equal(r.id, 'ok');
  assert.equal(llamadas.length, 2);
  assert.equal(llamadas[0].p_op_id, llamadas[1].p_op_id);
  assert.notEqual(llamadas[0].p_seq, llamadas[1].p_seq);
});

test('ejecutar nunca lanza: devuelve el error traducido', async () => {
  const c = { rpc: async () => ({ data: null, error: { message: 'temporizador_ocupado', details: `habito:${UUID}:corriendo`, code: 'P0001' } }) };
  const s = crearServicio(c, { identidad: crearIdentidadDispositivo({ almacen: memoria() }) });
  const r = await ejecutar(() => s.focusIniciar({ modalidad: 'productivity', frenteId: 'tanku' }));
  assert.equal(r.ok, false);
  assert.equal(r.error.codigo, 'temporizador_ocupado');
  assert.equal(r.error.ocupado.tipo, 'habito');
});

test('el cliente no escribe nunca en tablas de temporizadores: solo hay RPC y lecturas', () => {
  const codigo = readFileSync(new URL('../lib/data/temporizador.js', import.meta.url), 'utf8');
  for (const t of ['temporizador_activo', 'focus_sesiones', 'descansos', 'habito_temporizadores', 'habito_segmentos', 'operaciones']) {
    assert.ok(!new RegExp(`from\\('${t}'\\)\\s*\\.(insert|update|delete|upsert)`).test(codigo), `escritura directa en ${t}`);
  }
});
