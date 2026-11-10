import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ESTADOS_HOME, TEXTO_ESTADO, leerFuente, estadoDeLista } from '../lib/domain/estadosHome.js';
import {
  resumenPendientes, prioridadesHoy, avanceMetas, resumenGastos, resumenJornada, resumenHabitosSalud, proximoVencimiento, recurrentesProximos,
} from '../lib/domain/resumen.js';
import { mapaFrentes, UMBRALES } from '../lib/domain/mapaFrentes.js';
import { generarAlertas } from '../lib/domain/alertas.js';
import { balancePeriodo, objetivosPorSemana } from '../lib/domain/atencion.js';

const HOY = '2026-11-12';           // jueves; la semana empieza el lunes 2026-11-09
const esNegocio = s => s?.startsWith('ticketcode') || s === 'tanku';
const P = (o = {}) => ({ id: Math.random().toString(36).slice(2), texto: 'T', frente: 'tanku', hecho: false, fecha_limite: null, creado_en: '2026-11-01T12:00:00Z', hecho_en: null, meta_id: null, ...o });

// ---- Estados
test('los estados son seis y distintos, cada uno con su texto', () => {
  assert.equal(new Set(ESTADOS_HOME).size, 6);
  const textos = Object.values(TEXTO_ESTADO).map(t => t.titulo);
  assert.equal(new Set(textos).size, textos.length);
  assert.deepEqual(['Sin datos', 'Sin registros', 'Fuente no conectada', 'Error de lectura', 'Fase 3 aún no activada'], [TEXTO_ESTADO.sin_datos.titulo, TEXTO_ESTADO.sin_registros.titulo, TEXTO_ESTADO.no_conectada.titulo, TEXTO_ESTADO.error_lectura.titulo, TEXTO_ESTADO.fase3_no_activada.titulo]);
});

test('un error de lectura no devuelve datos y no es «sin registros»', () => {
  const f = leerFuente({ data: [{ id: 1 }], error: { message: 'x' } });
  assert.deepEqual([f.ok, f.data], [false, null]);
  assert.equal(estadoDeLista(f), 'error_lectura');
  assert.equal(estadoDeLista(leerFuente({ data: [], error: null })), 'sin_registros');
  assert.equal(estadoDeLista(leerFuente({ data: [1], error: null })), 'datos');
});

// ---- Pendientes
test('pendientes: abiertos, completados, vencidos, vencen hoy y avance; sin pendientes el avance es null, no 0', () => {
  const r = resumenPendientes({ hoy: HOY, pendientes: [
    P({ hecho: true, hecho_en: '2026-11-12T15:00:00Z' }), P({ hecho: true, hecho_en: '2026-11-01T15:00:00Z' }),
    P({ fecha_limite: '2026-11-10' }), P({ fecha_limite: HOY }), P(),
  ] });
  assert.deepEqual([r.total, r.abiertos, r.completados, r.completadosHoy, r.completados7, r.vencidos, r.vencenHoy], [5, 3, 2, 1, 1, 1, 1]);
  assert.equal(r.avance, 0.4);
  const vacio = resumenPendientes({ hoy: HOY, pendientes: [] });
  assert.deepEqual([vacio.estado, vacio.avance, vacio.abiertos], ['sin_registros', null, 0]);
});

test('prioridades de hoy: vencidos (el más antiguo primero), vencen hoy y luego los abiertos más antiguos, con motivo y límite', () => {
  const a = P({ texto: 'A', fecha_limite: '2026-11-10' }); const b = P({ texto: 'B', fecha_limite: '2026-11-08' }); const c = P({ texto: 'C', fecha_limite: HOY });
  const d = P({ texto: 'D', creado_en: '2026-10-01T00:00:00Z' }); const e = P({ texto: 'E', creado_en: '2026-11-05T00:00:00Z' }); const f = P({ texto: 'F', hecho: true });
  const r = prioridadesHoy({ hoy: HOY, pendientes: [e, a, f, d, c, b], limite: 4 });
  assert.deepEqual(r.items.map(x => x.texto), ['B', 'A', 'C', 'D']);
  assert.deepEqual(r.items.map(x => x.urgencia), ['vencido', 'vencido', 'hoy', 'abierto']);
  assert.match(r.items[0].motivo, /Vencido hace 4 días/);
  assert.deepEqual([r.totalAbiertos, r.ocultos], [5, 1]);
});

// ---- Metas
test('avance de metas = (hitos + pendientes hechos) / (hitos + pendientes vinculados); sin elementos es null', () => {
  const metas = [{ id: 'm1', titulo: 'M1', frente: 'tanku', estado: 'activa' }, { id: 'm2', titulo: 'M2', frente: 'tanku', estado: 'activa' }, { id: 'm3', estado: 'lograda' }];
  const hitos = [{ meta_id: 'm1', hecho: true }, { meta_id: 'm1', hecho: false }];
  const pend = [P({ meta_id: 'm1', hecho: true })];
  const r = avanceMetas({ metas, hitos, pendientes: pend });
  assert.equal(r.activas, 2);
  assert.deepEqual([r.porMeta[0].hechos, r.porMeta[0].total, r.porMeta[0].faltan], [2, 3, 1]);
  assert.equal(r.porMeta[1].avance, null);
  assert.equal(r.estado, 'datos');
  assert.equal(avanceMetas({ metas: [], hitos: [], pendientes: [] }).estado, 'sin_registros');
  assert.equal(avanceMetas({ metas: [metas[1]], hitos: [], pendientes: [] }).estado, 'sin_datos');
});

// ---- Finanzas
test('gastos del mes y presupuesto: sin presupuesto, usado y disponible son null (no 0)', () => {
  const gastos = [{ fecha: '2026-11-03', valor_cop: 100000, frente: 'tanku' }, { fecha: '2026-11-04', valor_cop: 50000, frente: 'personal' }, { fecha: '2026-10-30', valor_cop: 999, frente: 'tanku' }];
  const sin = resumenGastos({ gastos, presupuestos: [], mes: '2026-11', esNegocio });
  assert.deepEqual([sin.total, sin.negocio, sin.personal, sin.usado, sin.disponible, sin.presupuesto], [150000, 100000, 50000, null, null, null]);
  const con = resumenGastos({ gastos, presupuestos: [{ monto_cop: 200000 }, { monto_cop: 100000 }], mes: '2026-11', esNegocio });
  assert.deepEqual([con.presupuesto, con.usado, con.disponible], [300000, 0.5, 150000]);
  assert.equal(resumenGastos({ gastos: [], presupuestos: [], mes: '2026-11', esNegocio }).estado, 'sin_registros');
});

// ---- Jornada y hábitos
test('jornada: racha terminando hoy o ayer, días de la semana y racha previa si se rompió', () => {
  const j = resumenJornada({ hoy: HOY, fechas: ['2026-11-11', '2026-11-10', '2026-11-09', '2026-11-05'] });
  assert.deepEqual([j.racha, j.diasSemana, j.hoyEscrita, j.ayerEscrita], [3, 3, false, true]);
  const rota = resumenJornada({ hoy: HOY, fechas: ['2026-11-10', '2026-11-09', '2026-11-08'] });
  assert.deepEqual([rota.racha, rota.rachaPrevia], [0, 3]);
  assert.equal(resumenJornada({ hoy: HOY, fechas: [] }).estado, 'sin_registros');
});

test('hábitos de Salud heredados: cumplidos hoy y mejor racha', () => {
  const habitos = [{ id: 'h1', objetivo_dia: 1, activo: true }, { id: 'h2', objetivo_dia: 30, activo: true }, { id: 'h3', activo: false }];
  const registros = [{ habito_id: 'h1', fecha: HOY, valor: 1 }, { habito_id: 'h1', fecha: '2026-11-11', valor: 1 }, { habito_id: 'h2', fecha: HOY, valor: 10 }];
  const r = resumenHabitosSalud({ habitos, registros, hoy: HOY });
  assert.deepEqual([r.total, r.hechosHoy, r.mejorRacha], [2, 1, 2]);
  assert.equal(resumenHabitosSalud({ habitos: [], registros: [], hoy: HOY }).estado, 'sin_registros');
});

test('recurrentes: próximo vencimiento y días restantes (negativo = vencido)', () => {
  assert.equal(proximoVencimiento({ dia_mes: 10, ultimo_pago: null }, HOY), '2026-11-10');
  assert.equal(proximoVencimiento({ dia_mes: 10, ultimo_pago: '2026-11-10' }, HOY), '2026-12-10');
  assert.equal(proximoVencimiento({ dia_mes: 31, ultimo_pago: '2026-02-05' }, '2026-02-10'), '2026-03-31');
  const r = recurrentesProximos({ hoy: HOY, recurrentes: [{ nombre: 'A', dia_mes: 15 }, { nombre: 'B', dia_mes: 10 }] });
  assert.deepEqual(r.map(x => [x.nombre, x.dias]), [['B', -2], ['A', 3]]);
});

// ---- Mapa de frentes
test('mapa: siempre los seis frentes en su orden y sin ningún dato muestran «sin registros» (no ceros inventados)', () => {
  const m = mapaFrentes({ hoy: HOY, pendientes: [], notas: [], metas: [], hitos: [], gastos: [], esNegocio });
  assert.deepEqual(m.filas.map(f => f.id), ['tanku', 'ticketcode', 'personal', 'salud', 'familia', 'otros']);
  assert.equal(m.concentracion.estado, 'sin_registros');
  assert.ok(m.filas.every(f => f.sinNingunDato && f.registros.sesionesFocus === null && f.atencion === null && f.requiereAtencion.length === 0));
  assert.equal(m.hayFocus, false);
});

test('mapa: actividad = conteo de registros reales (pendientes completados + notas + sesiones), sin puntajes', () => {
  const pend = [P({ frente: 'tanku', hecho: true, hecho_en: '2026-11-10T15:00:00Z' }), P({ frente: 'tanku', hecho: true, hecho_en: '2026-11-02T15:00:00Z' }), P({ frente: 'ticketcode-eve', hecho: true, hecho_en: '2026-11-11T15:00:00Z' })];
  const notas = [{ id: 1, frente: 'tanku', actualizado_en: '2026-11-09T12:00:00Z' }, { id: 2, frente: 'jardin', actualizado_en: '2026-11-12T12:00:00Z' }];
  const sesiones = [{ frente_id: 'tanku', finalizado_en: '2026-11-11T20:00:00Z' }, { frente_id: 'salud', finalizado_en: '2026-11-12T14:00:00Z' }];
  const m = mapaFrentes({ hoy: HOY, pendientes: pend, notas, metas: [], hitos: [], gastos: [], sesiones, esNegocio });
  const f = id => m.filas.find(x => x.id === id);
  assert.deepEqual(f('tanku').registros, { pendientesCompletados: 1, notas: 1, sesionesFocus: 1, total: 3 });
  assert.equal(f('ticketcode').registros.total, 1);
  assert.equal(f('familia').registros.total, 1);
  assert.equal(f('salud').registros.total, 1);
  assert.equal(m.concentracion.total, 6);
  assert.equal(m.concentracion.partes.find(p => p.id === 'tanku').proporcion, 0.5);
});

test('mapa: lo que no encaja en los seis aparece como «Sin asignar» y no desaparece', () => {
  const m = mapaFrentes({ hoy: HOY, pendientes: [P({ frente: 'desconocido' })], notas: [], metas: [], hitos: [], gastos: [], esNegocio });
  assert.equal(m.filas.at(-1).id, 'sin-asignar');
  assert.equal(m.filas.at(-1).pendientes.abiertos, 1);
});

test('requiere atención, regla 1: pendientes vencidos, con su motivo', () => {
  const m = mapaFrentes({ hoy: HOY, pendientes: [P({ frente: 'salud', fecha_limite: '2026-11-01' })], notas: [], metas: [], hitos: [], gastos: [], esNegocio });
  assert.deepEqual(m.filas.find(f => f.id === 'salud').requiereAtencion.map(r => [r.regla, r.motivo]), [[1, '1 pendiente vencido'], [2, '1 pendiente abierto y ningún registro en 7 días']]);   // cada regla con su motivo
});

test('requiere atención, regla 2: pendientes abiertos y ningún registro en 7 días (con registros recientes no se marca)', () => {
  const sin = mapaFrentes({ hoy: HOY, pendientes: [P({ frente: 'tanku' }), P({ frente: 'tanku' })], notas: [], metas: [], hitos: [], gastos: [], esNegocio });
  assert.match(sin.filas[0].requiereAtencion[0].motivo, /2 pendientes abiertos y ningún registro en 7 días/);
  const con = mapaFrentes({ hoy: HOY, pendientes: [P({ frente: 'tanku' })], notas: [{ id: 1, frente: 'tanku', actualizado_en: '2026-11-08T12:00:00Z' }], metas: [], hitos: [], gastos: [], esNegocio });
  assert.equal(con.filas[0].requiereAtencion.length, 0);
});

const VIERNES = '2026-11-13';           // 5 de 7 días de la semana (71 %: pasa el umbral del 60 %)
const balanceDe = (objetivos, sesiones) => balancePeriodo({ desde: '2026-11-09', hasta: '2026-11-15', hoy: VIERNES, objetivos: objetivosPorSemana(objetivos), sesiones });
test('requiere atención, reglas 3 y 4 (Fase 3): atención baja con la semana avanzada y Focus sin sesiones en 3 días', () => {
  const objetivos = [{ semana_inicio: '2026-11-09', frente_id: 'tanku', puntos: 14 }];
  const sesiones = [{ id: 's', frente_id: 'tanku', estado: 'completada', puntos: 1, finalizado_en: '2026-11-09T20:00:00Z' }];
  const m = mapaFrentes({ hoy: VIERNES, pendientes: [], notas: [], metas: [], hitos: [], gastos: [], sesiones, balance: balanceDe(objetivos, sesiones), esNegocio });
  const reglas = m.filas[0].requiereAtencion.map(r => r.regla);
  assert.deepEqual(reglas, [3, 4]);
  assert.match(m.filas[0].requiereAtencion[0].motivo, /Atención al 10 %/);
  const ok = [{ id: 's2', frente_id: 'tanku', estado: 'completada', puntos: 1, finalizado_en: '2026-11-13T14:00:00Z' }, ...sesiones];
  const bien = mapaFrentes({ hoy: VIERNES, pendientes: [], notas: [], metas: [], hitos: [], gastos: [], sesiones: ok, balance: balanceDe(objetivos, ok), esNegocio });
  assert.ok(!bien.filas[0].requiereAtencion.some(r => r.regla === 4));
});

test('sin Fase 3 las reglas 3 y 4 no se ejecutan ni se simulan; los umbrales son ajustables y están a la vista', () => {
  const m = mapaFrentes({ hoy: HOY, pendientes: [], notas: [], metas: [], hitos: [], gastos: [], esNegocio });
  assert.ok(m.filas.every(f => !f.requiereAtencion.some(r => r.regla >= 3)));
  assert.deepEqual(Object.keys(UMBRALES).sort(), ['atencionMinima', 'diasSinFocus', 'diasSinRegistros', 'semanaTranscurrida']);
});

// ---- Alertas y próximas acciones
test('sin datos reales no hay alertas: «sin registros» si todo se leyó bien; «error de lectura» si una fuente falló', () => {
  assert.equal(generarAlertas({ hoy: HOY, pendientes: [] }).estado, 'sin_registros');
  const e = generarAlertas({ hoy: HOY, pendientes: [], errores: ['gastos'] });
  assert.deepEqual([e.estado, e.fuentesConError], ['error_lectura', ['gastos']]);
});

test('cada alerta trae motivo, evidencia y acción; orden: vencidos, vencen hoy, atención, recurrente/presupuesto, Jornada', () => {
  const pendientes = [P({ texto: 'Cotización', fecha_limite: '2026-11-08' }), P({ fecha_limite: HOY })];
  const gastos = resumenGastos({ gastos: [{ fecha: '2026-11-03', valor_cop: 95, frente: 'tanku' }], presupuestos: [{ monto_cop: 100 }], mes: '2026-11', esNegocio });
  const recurrentes = recurrentesProximos({ hoy: HOY, recurrentes: [{ nombre: 'Internet', valor_cop: 80000, dia_mes: 10 }] });
  const jornada = resumenJornada({ hoy: HOY, fechas: ['2026-11-11'] });
  const a = generarAlertas({ hoy: HOY, hora: 20, pendientes, gastos, recurrentes, jornada });
  assert.deepEqual(a.proximas.map(x => x.id), ['vencidos', 'vencen-hoy', 'presupuesto', 'recurrente', 'jornada-hoy']);
  for (const x of a.items) { assert.ok(x.motivo && x.evidencia.length && x.accion.ruta, x.id); }
  assert.match(a.items[0].evidencia[0], /«Cotización».*2026-11-08.*hace 4 días/);
});

test('oportunidades: meta a un paso y presupuesto disponible con el mes avanzado; la Jornada solo desde las 7 p. m.', () => {
  const metas = avanceMetas({ metas: [{ id: 'm', titulo: 'MVP', frente: 'tanku', estado: 'activa' }], hitos: [{ meta_id: 'm', hecho: true }, { meta_id: 'm', hecho: false }], pendientes: [] });
  const gastos = resumenGastos({ gastos: [{ fecha: '2026-11-03', valor_cop: 10, frente: 'tanku' }], presupuestos: [{ monto_cop: 100 }], mes: '2026-11', esNegocio });
  const tarde = generarAlertas({ hoy: '2026-11-25', hora: 10, metas, gastos, jornada: resumenJornada({ hoy: '2026-11-25', fechas: [] }) });
  assert.deepEqual(tarde.items.map(x => x.id), ['meta-m', 'presupuesto-disponible']);
  assert.ok(!tarde.items.some(x => x.id === 'jornada-hoy'));
  const noche = generarAlertas({ hoy: '2026-11-25', hora: 19, jornada: resumenJornada({ hoy: '2026-11-25', fechas: [] }) });
  assert.deepEqual(noche.items.map(x => x.id), ['jornada-hoy']);
});

test('alertas del mapa de frentes: objetivo de atención en riesgo (regla 3 y 4) y recomendación por frente sin registros (regla 2)', () => {
  const objetivos = [{ semana_inicio: '2026-11-09', frente_id: 'tanku', puntos: 14 }];
  const sesiones = [];
  const mapa = mapaFrentes({ hoy: VIERNES, pendientes: [P({ frente: 'salud' })], notas: [], metas: [], hitos: [], gastos: [], sesiones, balance: balanceDe(objetivos, sesiones), esNegocio });
  const a = generarAlertas({ hoy: VIERNES, mapa });
  assert.ok(a.items.some(x => x.id === 'atencion-3-tanku' && x.rango === 3));
  assert.ok(a.items.some(x => x.id === 'atencion-4-tanku'));
  assert.ok(a.items.some(x => x.id === 'sin-registros-salud' && x.tipo === 'recomendacion'));
});
