import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  instantanea, leer, segundosParaMeta, formatoReloj, duracionLegible, contarCiclos, descansoSugerido,
  puntosDeSesiones, resumenSesiones, traducirError, preferenciasEfectivas, mensajeCierreFocus, PREFERENCIAS_INICIALES,
} from '../lib/domain/temporizador.js';

const T0 = Date.parse('2026-11-09T15:00:00Z');
const ID = '11111111-1111-1111-1111-111111111111';
const sesion = (o = {}) => ({ id: ID, estado: 'en_curso', acumulado_s: 0, tramo_inicio: new Date(T0).toISOString(), duracion_objetivo_s: 1800, modalidad: 'productivity', frente_id: 'tanku', actividad: 'Informe', version: 1, ...o });
const activo = (o = {}) => ({ tipo: 'focus', ref_id: ID, estado: 'corriendo', ...o });

test('sin temporizador activo no hay instantánea (ausencia, no cero)', () => {
  assert.equal(instantanea({ activo: null }), null);
  assert.equal(instantanea(undefined), null);
  assert.equal(leer(null, T0), null);
});

test('si existe el bloqueo pero falta su registro se marca incompleto, no se oculta', () => {
  const i = instantanea({ activo: activo(), focus: null });
  assert.deepEqual({ incompleto: i.incompleto, tipo: i.tipo, id: i.id }, { incompleto: true, tipo: 'focus', id: ID });
  assert.equal(leer(i, T0), null);
});

test('Focus corriendo: el tiempo sale de las marcas de tiempo, no de un intervalo', () => {
  const i = instantanea({ activo: activo(), focus: sesion() });
  assert.equal(leer(i, T0).transcurridoS, 0);
  assert.equal(leer(i, T0 + 90_000).transcurridoS, 90);
  assert.equal(leer(i, T0 + 90_000).restanteS, 1710);
  assert.equal(leer(i, T0 + 1_799_999).meta, false);
  assert.equal(leer(i, T0 + 1_800_000).meta, true);
  assert.equal(leer(i, T0 + 1_860_000).excedidoS, 60);
});

test('recargar o abrir en otro dispositivo da el mismo resultado (depende solo de los datos y de ahora)', () => {
  const a = leer(instantanea({ activo: activo(), focus: sesion() }), T0 + 300_000);
  const b = leer(instantanea({ activo: activo(), focus: sesion() }), T0 + 300_000);
  assert.deepEqual(a, b);
});

test('pausado conserva lo acumulado y no avanza con el reloj', () => {
  const i = instantanea({ activo: activo({ estado: 'pausado' }), focus: sesion({ estado: 'pausada', tramo_inicio: null, acumulado_s: 600 }) });
  assert.equal(i.pausado, true);
  assert.equal(leer(i, T0).transcurridoS, 600);
  assert.equal(leer(i, T0 + 99 * 60_000).transcurridoS, 600);
  assert.equal(segundosParaMeta(i, T0), null);
});

test('reanudado suma el tramo nuevo al acumulado', () => {
  const i = instantanea({ activo: activo(), focus: sesion({ acumulado_s: 600 }) });
  assert.equal(leer(i, T0 + 120_000).transcurridoS, 720);
  assert.equal(segundosParaMeta(i, T0 + 120_000), 1080);
});

test('reloj local atrasado: nunca produce tiempo negativo', () => {
  const i = instantanea({ activo: activo(), focus: sesion() });
  assert.equal(leer(i, T0 - 60_000).transcurridoS, 0);
});

test('descanso usa su propia duración y etiqueta', () => {
  const d = { id: ID, tipo: 'corto', estado: 'en_curso', acumulado_s: 0, tramo_inicio: new Date(T0).toISOString(), duracion_objetivo_s: 300 };
  const i = instantanea({ activo: { tipo: 'descanso', ref_id: ID, estado: 'corriendo' }, descanso: d });
  assert.equal(i.titulo, 'Descanso corto');
  assert.equal(leer(i, T0 + 60_000).restanteS, 240);
});

test('hábito: cuenta hacia arriba, suma segmentos cerrados y no inventa objetivo', () => {
  const h = { id: ID, habito_id: 'h1', estado: 'en_curso', tramo_inicio: new Date(T0).toISOString() };
  const segs = [{ segundos: 120 }, { segundos: 30 }];
  const i = instantanea({ activo: { tipo: 'habito', ref_id: ID, estado: 'corriendo' }, habito: h, habitoConfig: { nombre: 'Leer' }, objetivoHabitoS: 2700, segmentosHabito: segs });
  assert.equal(i.cuentaAtras, false);
  assert.equal(leer(i, T0 + 60_000).transcurridoS, 210);
  assert.equal(leer(i, T0 + 60_000).restanteS, 2490);
  const sinObjetivo = instantanea({ activo: { tipo: 'habito', ref_id: ID, estado: 'corriendo' }, habito: h, segmentosHabito: [] });
  const l = leer(sinObjetivo, T0 + 60_000);
  assert.equal(l.restanteS, null);
  assert.equal(l.progreso, null);
  assert.equal(l.meta, false);
});

test('formatoReloj: mm:ss, h:mm:ss y valores inválidos son «--:--», nunca 00:00', () => {
  assert.equal(formatoReloj(0), '00:00');
  assert.equal(formatoReloj(65), '01:05');
  assert.equal(formatoReloj(3725), '1:02:05');
  for (const v of [null, undefined, NaN, -1, 'x']) assert.equal(formatoReloj(v), '--:--');
});

test('duracionLegible', () => {
  assert.equal(duracionLegible(45), '45 s');
  assert.equal(duracionLegible(1500), '25 min');
  assert.equal(duracionLegible(3900), '1 h 05 min');
  assert.equal(duracionLegible(null), null);
});

// ---- ciclos y descansos
const fin = (min) => new Date(T0 + min * 60_000).toISOString();
const ses = (id, estado, min) => ({ id, estado, finalizado_en: fin(min), puntos: estado === 'completada' ? 1 : 0 });

test('contador de ciclos: solo completadas posteriores al último descanso largo completado u omitido', () => {
  const sesiones = [ses('a', 'completada', 1), ses('b', 'parcial', 2), ses('c', 'cancelada', 3), ses('d', 'completada', 4), ses('e', 'completada', 10)];
  assert.equal(contarCiclos(sesiones, []), 3);
  assert.equal(contarCiclos(sesiones, [{ tipo: 'corto', estado: 'completado', finalizado_en: fin(5) }]), 3, 'el corto no reinicia');
  assert.equal(contarCiclos(sesiones, [{ tipo: 'largo', estado: 'omitido', finalizado_en: fin(5) }]), 1, 'omitir el largo reinicia');
  assert.equal(contarCiclos(sesiones, [{ tipo: 'largo', estado: 'completado', finalizado_en: fin(5) }]), 1);
  assert.equal(contarCiclos(sesiones, [{ tipo: 'largo', estado: 'en_curso', finalizado_en: null }]), 3, 'un largo en curso no reinicia');
  assert.equal(contarCiclos([], []), 0);
});

test('descanso sugerido: corto tras un ciclo, largo (solo el largo) tras cuatro (T-12)', () => {
  const uno = descansoSugerido({ sesiones: [ses('a', 'completada', 1)], descansos: [] });
  assert.deepEqual({ t: uno.tipo, d: uno.duracionS, c: uno.ciclos, o: uno.sesionOrigenId }, { t: 'corto', d: 300, c: 1, o: 'a' });
  const cuatro = descansoSugerido({ sesiones: [1, 2, 3, 4].map(n => ses('s' + n, 'completada', n)), descansos: [] });
  assert.deepEqual({ t: cuatro.tipo, d: cuatro.duracionS, c: cuatro.ciclos }, { t: 'largo', d: 1200, c: 4 });
});

test('descanso sugerido: respeta preferencias, no sugiere tras parcial/cancelada y no repite si ya se decidió', () => {
  const prefs = { ciclos_para_largo: 2, descanso_largo_min: 15, descanso_corto_min: 3 };
  const dos = descansoSugerido({ sesiones: [ses('a', 'completada', 1), ses('b', 'completada', 2)], descansos: [], prefs });
  assert.deepEqual({ t: dos.tipo, d: dos.duracionS }, { t: 'largo', d: 900 });
  assert.equal(descansoSugerido({ sesiones: [ses('a', 'completada', 1), ses('b', 'parcial', 2)], descansos: [] }), null);
  assert.equal(descansoSugerido({ sesiones: [ses('a', 'completada', 1), ses('b', 'cancelada', 2)], descansos: [] }), null);
  assert.equal(descansoSugerido({ sesiones: [ses('a', 'completada', 1)], descansos: [{ sesion_origen_id: 'a', tipo: 'corto', estado: 'omitido', finalizado_en: fin(2) }] }), null);
  assert.equal(descansoSugerido({ sesiones: [ses('a', 'completada', 1)], descansos: [{ sesion_origen_id: null, tipo: 'corto', estado: 'en_curso', iniciado_en: fin(2), finalizado_en: null }] }), null);
  assert.equal(descansoSugerido({ sesiones: [], descansos: [] }), null);
});

test('puntos: una sesión completada = 1 punto; parcial y cancelada = 0', () => {
  const l = [ses('a', 'completada', 1), ses('b', 'parcial', 2), ses('c', 'cancelada', 3), ses('d', 'completada', 4)];
  assert.equal(puntosDeSesiones(l), 2);
  assert.deepEqual(resumenSesiones(l), { total: 4, completadas: 2, parciales: 1, canceladas: 1, puntos: 2, efectivoS: 0 });
  assert.equal(puntosDeSesiones([]), 0);
});

test('preferencias: sin fila = valores iniciales aprobados (30/5/20/4, avisos y sonido activados)', () => {
  const p = preferenciasEfectivas(null);
  assert.deepEqual({ ...p }, { ...PREFERENCIAS_INICIALES, personalizadas: false });
  assert.deepEqual([p.focus_min, p.descanso_corto_min, p.descanso_largo_min, p.ciclos_para_largo, p.avisos, p.sonido], [30, 5, 20, 4, true, true]);
  assert.equal(preferenciasEfectivas({ focus_min: 45 }).focus_min, 45);
});

// ---- errores
test('errores del SQL se traducen; un error nunca es "sin datos"', () => {
  assert.equal(traducirError(null), null);
  const ocupado = traducirError({ message: 'temporizador_ocupado', details: `focus:${ID}:pausado`, code: 'P0001' });
  assert.equal(ocupado.codigo, 'temporizador_ocupado');
  assert.deepEqual(ocupado.ocupado, { tipo: 'focus', id: ID, estado: 'pausado' });
  assert.equal(traducirError({ message: 'transicion_invalida' }).codigo, 'transicion_invalida');
  assert.equal(traducirError({ message: 'permission denied for table x', code: '42501' }).codigo, 'sin_permiso');
  assert.equal(traducirError({ message: 'no_autenticado', code: '28000' }).codigo, 'no_autenticado');
  assert.equal(traducirError({ message: 'TypeError: Failed to fetch' }).codigo, 'red');
  assert.equal(traducirError({ message: 'algo raro' }).codigo, 'desconocido');
});

test('función o tabla inexistente (migración aún no aplicada) se distingue y se explica', () => {
  assert.equal(traducirError({ code: 'PGRST202', message: 'Could not find the function public.focus_iniciar in the schema cache' }).codigo, 'fase3_no_disponible');
  assert.equal(traducirError({ code: 'PGRST205', message: "Could not find the table 'public.temporizador_activo' in the schema cache" }).codigo, 'fase3_no_disponible');
  assert.equal(traducirError({ code: '42P01', message: 'relation "public.temporizador_activo" does not exist' }).codigo, 'fase3_no_disponible');
});

test('columna inexistente (etapa 1 sin aplicar, p. ej. pendientes.prioridad) también es «Fase 3 no disponible», no un error genérico', () => {
  assert.equal(traducirError({ code: '42703', message: 'column pendientes.prioridad does not exist' }).codigo, 'fase3_no_disponible');
  assert.equal(traducirError({ message: 'column hitos.hecho_en does not exist' }).codigo, 'fase3_no_disponible');
});

test('mensaje de cierre según lo que decidió el servidor', () => {
  assert.match(mensajeCierreFocus({ estado: 'completada', tiempo_efectivo_s: 1800 }), /\+1 punto/);
  assert.match(mensajeCierreFocus({ estado: 'parcial', tiempo_efectivo_s: 600 }), /parcial.*no genera punto/);
  assert.match(mensajeCierreFocus({ estado: 'cancelada', tiempo_efectivo_s: 60 }), /sin puntos/);
  assert.equal(mensajeCierreFocus(null), null);
});
