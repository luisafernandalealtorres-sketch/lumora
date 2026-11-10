// Contrato de la capa de datos de hábitos y objetivos con el SQL v1.11 (firmas reales) y reglas de escritura.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { crearServicioHabitos } from '../lib/data/habitos.js';
import { crearIdentidadDispositivo } from '../lib/data/rpc.js';

const sql = readFileSync(new URL('../../docs/sql/v1.11/etapa3_aplicar.sql', import.meta.url), 'utf8');
function firma(nombre) {
  const m = new RegExp(`create or replace function public\\.${nombre}\\(([^)]*)\\)`, 'i').exec(sql);
  assert.ok(m, `no existe ${nombre}`);
  return m[1].split(',').map(p => p.trim()).filter(Boolean).map(p => ({ nombre: p.split(/\s+/)[0], obligatorio: !/\bdefault\b/i.test(p) }));
}
const memoria = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const UUID = '22222222-2222-2222-2222-222222222222';
const grabador = () => { const llamadas = []; return { llamadas, rpc: async (n, a) => { llamadas.push({ n, a }); return { data: { id: 'x' }, error: null }; } }; };

const CASOS = [
  ['crear', { nombre: 'Leer', modo: 'manual', frecuencia: 'diaria', objetivoS: 3600 }, 'habito_crear', true],
  ['crear', { nombre: 'Correr', modo: 'temporizador', frecuencia: 'dias', dias: [0, 2, 4], objetivoS: 2700, desde: '2026-11-09' }, 'habito_crear', true],
  ['registrarManual', { habitoId: UUID, fecha: '2026-11-09', segundos: 1800 }, 'habito_registrar_manual', true],
  ['programar', { habitoId: UUID, frecuencia: 'diaria', objetivoS: 1800, desde: '2026-11-10' }, 'habito_programar', false],
  ['archivar', { habitoId: UUID }, 'habito_archivar', false],
];

for (const [metodo, args, rpc, conOp] of CASOS) {
  test(`${metodo} llama a ${rpc} con parámetros del SQL v1.11`, async () => {
    const c = grabador();
    const s = crearServicioHabitos(c, { identidad: crearIdentidadDispositivo({ almacen: memoria() }) });
    await s[metodo](args);
    assert.equal(c.llamadas[0].n, rpc);
    const enviados = Object.keys(c.llamadas[0].a);
    const sig = firma(rpc);
    for (const e of enviados) assert.ok(sig.some(p => p.nombre === e), `${e} no es parámetro de ${rpc}`);
    for (const p of sig.filter(x => x.obligatorio)) assert.ok(enviados.includes(p.nombre), `falta ${p.nombre}`);
    assert.equal('p_op_id' in c.llamadas[0].a, conOp);
  });
}

test('días de la semana se envían como arreglo y vacío cuando la frecuencia es diaria', async () => {
  const c = grabador();
  const s = crearServicioHabitos(c, { identidad: crearIdentidadDispositivo({ almacen: memoria() }) });
  await s.crear({ nombre: 'A', modo: 'manual', frecuencia: 'diaria', dias: [1, 2], objetivoS: 60 });
  await s.crear({ nombre: 'B', modo: 'manual', frecuencia: 'dias', dias: [1, 2], objetivoS: 60 });
  assert.deepEqual(c.llamadas.map(l => l.a.p_dias), [[], [1, 2]]);
});

test('el cliente solo escribe en objetivos_atencion y en la columna nombre de habitos_config; nada en las demás tablas nuevas ni en las heredadas', () => {
  const codigo = readFileSync(new URL('../lib/data/habitos.js', import.meta.url), 'utf8');
  const escrituras = [...codigo.matchAll(/from\('(\w+)'\)[^;]*?\.(insert|update|delete|upsert)\(/gs)].map(m => `${m[1]}.${m[2]}`);
  assert.deepEqual([...new Set(escrituras)].sort(), ['habitos_config.update', 'objetivos_atencion.delete', 'objetivos_atencion.upsert']);
  for (const t of ['habitos', 'habito_registros', 'habito_tiempo', 'habito_tiempo_historial', 'habitos_config_versiones']) {
    assert.ok(!new RegExp(`from\\('${t}'\\)[^;]*?\\.(insert|update|delete|upsert)\\(`, 's').test(codigo), `escritura en ${t}`);
  }
});

test('renombrar solo envía la columna permitida (nombre)', async () => {
  const llamadas = [];
  const cliente = { from: () => { const b = { update(v) { llamadas.push(v); return b; }, eq() { return b; }, select() { return b; }, single: async () => ({ data: {}, error: null }) }; return b; } };
  await crearServicioHabitos(cliente, { identidad: crearIdentidadDispositivo({ almacen: memoria() }) }).renombrar({ habitoId: UUID, nombre: '  Leer  ' });
  assert.deepEqual(llamadas, [{ nombre: 'Leer' }]);
});
