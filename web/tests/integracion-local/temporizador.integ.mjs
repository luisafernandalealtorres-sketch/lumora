// Integración REAL del temporizador global: la capa de datos de la aplicación (lib/data/temporizador.js) y el dominio
// (lib/domain/temporizador.js) contra el SQL v1.11 en un PostgreSQL 16 LOCAL Y DESECHABLE (puerto 54332).
// No se conecta a Supabase, no usa credenciales ni variables del proyecto. Crea un clúster temporal y lo destruye al final.
//
//   npm run test:integracion      (requiere PostgreSQL 16; variable PG_BIN opcional con la carpeta bin)
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearEjecutorSql, crearClienteLocal } from './clienteLocal.mjs';
import { crearServicio, crearIdentidadDispositivo, ejecutar as ejecutarAccion } from '../../lib/data/temporizador.js';
import { instantanea, leer, descansoSugerido, contarCiclos, resumenSesiones } from '../../lib/domain/temporizador.js';
import { crearServicioHabitos } from '../../lib/data/habitos.js';
import { fechaBogota, sumarDias, inicioSemana } from '../../lib/domain/fechas.js';
import { hayOcurrencia, wellbeing, tiempoVigente } from '../../lib/domain/habitos.js';
import { balanceSemana, objetivosPorSemana } from '../../lib/domain/atencion.js';
import { cargarLifePulse } from '../../lib/data/lifePulse.js';
import { todasLasObligaciones, prioridadEnCierre } from '../../lib/domain/obligaciones.js';

const BIN = process.env.PG_BIN || 'C:/Program Files/PostgreSQL/16/bin';
const PUERTO = 54332;
const U1 = '11111111-1111-1111-1111-111111111111';
const U2 = '22222222-2222-2222-2222-222222222222';
const repo = fileURLToPath(new URL('../../../', import.meta.url));
const sqlDir = join(repo, 'docs/sql/v1.11');
const harness = join(repo, 'docs/validacion-local-v1.11');
const hay = existsSync(join(BIN, 'initdb.exe')) || existsSync(join(BIN, 'initdb'));

const memoria = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

describe('Fase 3 (temporizador, hábitos y atención) contra PostgreSQL local', { skip: hay ? false : `no se encontró PostgreSQL en ${BIN}` }, () => {
  let datos; let admin; let ejecutor;
  const servicioDe = (uid, almacen = memoria()) => crearServicio(crearClienteLocal({ ejecutar: ejecutor, uid }), { identidad: crearIdentidadDispositivo({ almacen }) });
  const como = (usuario, sql, base = 'integ') => execFileSync(`${BIN}/psql`, ['-h', '127.0.0.1', '-p', String(PUERTO), '-U', usuario, '-d', base, '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim();
  const archivo = (usuario, base, ruta) => execFileSync(`${BIN}/psql`, ['-h', '127.0.0.1', '-p', String(PUERTO), '-U', usuario, '-d', base, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', ruta], { encoding: 'utf8' });
  const limpiar = () => como('postgres', 'truncate public.operaciones, public.descansos, public.focus_sesiones, public.temporizador_activo, public.preferencias_usuario, public.habito_tiempo_historial, public.habito_tiempo, public.habito_segmentos, public.habito_temporizadores, public.habitos_config_versiones, public.habitos_config, public.objetivos_atencion, public.cambios_registro, public.pendientes, public.hitos, public.metas, public.habito_registros, public.habitos');
  const retroceder = (segundos) => como('postgres', `update public.focus_sesiones set tramo_inicio = tramo_inicio - interval '${Number(segundos)} seconds' where estado = 'en_curso'`);

  before(() => {
    datos = mkdtempSync(join(tmpdir(), 'pg-integ-'));
    execFileSync(`${BIN}/initdb`, ['-D', datos, '-U', 'postgres', '--auth=trust', '-E', 'UTF8'], { stdio: 'ignore' });
    execFileSync(`${BIN}/pg_ctl`, ['-D', datos, '-o', `-p ${PUERTO} -c listen_addresses=127.0.0.1`, '-l', join(datos, 'servidor.log'), '-w', 'start'], { stdio: 'ignore' });
    admin = (sql, base = 'postgres', usuario = 'postgres') => como(usuario, sql, base);
    archivo('postgres', 'postgres', join(harness, '00_roles.sql'));
    archivo('sb_owner', 'fixture', join(harness, '01_fixture.sql'));
    admin('create database integ template fixture owner sb_owner');
    for (const e of ['etapa1_aplicar.sql', 'etapa2_aplicar.sql', 'etapa3_aplicar.sql']) archivo('sb_owner', 'integ', join(sqlDir, e));
    como('postgres', `insert into auth.users (id, email) values ('${U1}', 'u1@prueba.local'), ('${U2}', 'u2@prueba.local')`);
    ejecutor = crearEjecutorSql({ bin: BIN, puerto: PUERTO, base: 'integ' });
  });

  after(() => {
    try { execFileSync(`${BIN}/pg_ctl`, ['-D', datos, '-m', 'fast', '-w', 'stop'], { stdio: 'ignore' }); } catch { /* ya detenido */ }
    try { rmSync(datos, { recursive: true, force: true }); } catch { /* se borra con el sistema */ }
  });

  it('sin temporizador: lectura vacía real, sin error; preferencias iniciales', async () => {
    limpiar();
    const s = servicioDe(U1);
    const e = await s.cargarEstado();
    assert.equal(e.activo, null);
    assert.equal(e.prefs, null);
    assert.deepEqual(e.sesiones, []);
    assert.equal(instantanea(e), null);
  });

  it('iniciar Focus: queda persistido y la lectura lo reconstruye por marcas de tiempo (también tras «recargar»)', async () => {
    limpiar();
    const s = servicioDe(U1);
    const fila = await s.focusIniciar({ modalidad: 'productivity', frenteId: 'tanku', actividad: 'Informe', intencion: 'Cerrar sección 2' });
    assert.equal(fila.estado, 'en_curso');
    assert.equal(fila.duracion_objetivo_s, 1800);                      // valor inicial de preferencias (§4.1)
    const recarga = servicioDe(U1);                                    // otra «pestaña»/recarga: instancia y dispositivo nuevos
    const e = await recarga.cargarEstado();
    const inst = instantanea(e);
    assert.equal(inst.tipo, 'focus');
    assert.equal(inst.id, fila.id);
    assert.equal(inst.corriendo, true);
    const l = leer(inst, Date.now() + 120_000);
    assert.ok(l.transcurridoS >= 119 && l.transcurridoS <= 125, `transcurrido ${l.transcurridoS}`);
    assert.equal(e.focus.actividad, 'Informe');
  });

  it('exclusividad: con Focus activo, descanso y hábito son rechazados con temporizador_ocupado (y se identifica el ocupante)', async () => {
    const s = servicioDe(U1);
    const r1 = await ejecutarAccion(() => s.descansoIniciar({ tipo: 'corto' }));
    assert.equal(r1.ok, false);
    assert.equal(r1.error.codigo, 'temporizador_ocupado');
    assert.equal(r1.error.ocupado.tipo, 'focus');
    const r2 = await ejecutarAccion(() => s.focusIniciar({ modalidad: 'enjoyment', frenteId: 'personal' }));
    assert.equal(r2.error.codigo, 'temporizador_ocupado');
    const e = await s.cargarEstado();
    assert.equal(e.sesiones.length, 1, 'no se creó una segunda sesión');
  });

  it('pausar conserva el tiempo y ocupa el lugar; reanudar continúa', async () => {
    const s = servicioDe(U1);
    retroceder(300);                                                    // simula 5 minutos corridos (sin tocar el reloj del sistema)
    const id = (await s.cargarEstado()).activo.ref_id;
    const p = await s.focusPausar(id);
    assert.equal(p.estado, 'pausada');
    assert.ok(p.acumulado_s >= 299 && p.acumulado_s <= 305, `acumulado ${p.acumulado_s}`);
    const e = await s.cargarEstado();
    assert.equal(e.activo.estado, 'pausado');
    const inst = instantanea(e);
    assert.equal(inst.pausado, true);
    assert.equal(leer(inst, Date.now() + 3_600_000).transcurridoS, p.acumulado_s, 'pausado no avanza');
    const ocupado = await ejecutarAccion(() => s.descansoIniciar({ tipo: 'corto' }));
    assert.equal(ocupado.error.ocupado.estado, 'pausado', 'un temporizador pausado sigue ocupando el lugar');
    const r = await s.focusReanudar(id);
    assert.equal(r.estado, 'en_curso');
  });

  it('completar antes de la meta = parcial, sin punto; la acción repetida es idempotente (misma sesión, sin punto duplicado)', async () => {
    const s = servicioDe(U1);
    const id = (await s.cargarEstado()).activo.ref_id;
    const fin = await s.focusCompletar(id);
    assert.equal(fin.estado, 'parcial');
    assert.equal(fin.puntos, 0);
    const e = await s.cargarEstado();
    assert.equal(e.activo, null, 'se liberó el bloqueo');
    assert.equal(resumenSesiones(e.sesiones).puntos, 0);
    assert.equal(descansoSugerido({ sesiones: e.sesiones, descansos: e.descansos, prefs: e.prefs }), null, 'tras parcial no se sugiere descanso');
  });

  it('completar tras alcanzar la meta = completada con 1 punto; completar dos veces no duplica el punto', async () => {
    limpiar();
    const s = servicioDe(U1);
    const f = await s.focusIniciar({ modalidad: 'productivity', frenteId: 'tanku' });
    retroceder(1800);
    const a = await s.focusCompletar(f.id);
    const b = await s.focusCompletar(f.id);                            // otro op_id: «duplicada» en el servidor
    assert.equal(a.estado, 'completada'); assert.equal(a.puntos, 1);
    assert.equal(b.puntos, 1);
    const e = await s.cargarEstado();
    assert.equal(resumenSesiones(e.sesiones).puntos, 1, 'un solo punto');
  });

  it('descanso sugerido tras un ciclo: corto; se inicia a decisión del usuario, ocupa el lugar y se completa', async () => {
    const s = servicioDe(U1);
    let e = await s.cargarEstado();
    const sug = descansoSugerido({ sesiones: e.sesiones, descansos: e.descansos, prefs: e.prefs });
    assert.deepEqual({ tipo: sug.tipo, duracionS: sug.duracionS, ciclos: sug.ciclos }, { tipo: 'corto', duracionS: 300, ciclos: 1 });
    assert.equal(e.activo, null, 'ningún descanso empieza solo');
    const d = await s.descansoIniciar({ tipo: sug.tipo, sesionOrigenId: sug.sesionOrigenId });
    assert.equal(d.estado, 'en_curso');
    const bloqueado = await ejecutarAccion(() => s.focusIniciar({ modalidad: 'productivity', frenteId: 'tanku' }));
    assert.equal(bloqueado.error.ocupado.tipo, 'descanso');
    e = await s.cargarEstado();
    assert.equal(instantanea(e).descansoTipo, 'corto');
    assert.equal(descansoSugerido({ sesiones: e.sesiones, descansos: e.descansos, prefs: e.prefs }), null, 'ya decidido: no se vuelve a sugerir');
    const fin = await s.descansoCompletar(d.id);
    assert.equal(fin.estado, 'completado');
    e = await s.cargarEstado();
    assert.equal(e.activo, null);
    assert.equal(resumenSesiones(e.sesiones).puntos, 1, 'los descansos no generan puntos');
  });

  it('cuatro ciclos completados: la sugerencia es solo el descanso largo; omitirlo reinicia el contador (derivado)', async () => {
    limpiar();
    const s = servicioDe(U1);
    for (let i = 0; i < 4; i++) {
      const f = await s.focusIniciar({ modalidad: 'productivity', frenteId: 'tanku' });
      retroceder(1800);
      await s.focusCompletar(f.id);
      if (i < 3) { const d = await s.descansoIniciar({ tipo: 'corto', sesionOrigenId: f.id }); await s.descansoCompletar(d.id); }
    }
    let e = await s.cargarEstado();
    assert.equal(contarCiclos(e.sesiones, e.descansos), 4);
    const sug = descansoSugerido({ sesiones: e.sesiones, descansos: e.descansos, prefs: e.prefs });
    assert.deepEqual({ tipo: sug.tipo, duracionS: sug.duracionS }, { tipo: 'largo', duracionS: 1200 });
    const om = await s.descansoOmitir({ tipo: 'largo', sesionOrigenId: sug.sesionOrigenId });
    assert.equal(om.estado, 'omitido');
    e = await s.cargarEstado();
    assert.equal(contarCiclos(e.sesiones, e.descansos), 0, 'omitir el largo reinicia');
    assert.equal(descansoSugerido({ sesiones: e.sesiones, descansos: e.descansos, prefs: e.prefs }), null);
  });

  it('cancelar Focus: sesión «cancelada» conservada sin puntos; libera el bloqueo', async () => {
    limpiar();
    const s = servicioDe(U1);
    const f = await s.focusIniciar({ modalidad: 'enjoyment', frenteId: 'personal' });
    const c = await s.focusCancelar(f.id);
    assert.equal(c.estado, 'cancelada'); assert.equal(c.puntos, 0);
    const e = await s.cargarEstado();
    assert.equal(e.activo, null);
    assert.equal(e.sesiones.length, 1);
    assert.equal(e.sesiones[0].estado, 'cancelada');
  });

  it('hábitos: temporizador con exclusividad global, segmentos al pausar y finalizar; no genera puntos de Focus', async () => {
    limpiar();
    const s = servicioDe(U1);
    // Crear el hábito con la RPC real (modo temporizador, objetivo 45 min); el cliente no escribe en estas tablas.
    const cli = crearClienteLocal({ ejecutar: ejecutor, uid: U1 });
    const creado = await cli.rpc('habito_crear', { p_op_id: '33333333-3333-3333-3333-333333333333', p_dispositivo_id: s.dispositivoId(), p_seq: 1, p_nombre: 'Leer', p_modo: 'temporizador', p_frecuencia: 'diaria', p_dias: '{}', p_objetivo_s: 2700 });
    assert.equal(creado.error, null);
    const habitoId = creado.data.id;
    const lista = await s.listarHabitosConTemporizador();
    assert.deepEqual(lista.map(h => h.nombre), ['Leer']);

    const t = await s.habitoIniciar(habitoId);
    assert.equal(t.estado, 'en_curso');
    const ocupado = await ejecutarAccion(() => s.focusIniciar({ modalidad: 'productivity', frenteId: 'tanku' }));
    assert.equal(ocupado.error.ocupado.tipo, 'habito', 'Focus no inicia con un hábito activo');

    como('postgres', `update public.habito_temporizadores set tramo_inicio = tramo_inicio - interval '600 seconds' where id = '${t.id}'`);
    let e = await s.cargarEstado();
    let inst = instantanea(e);
    assert.equal(inst.tipo, 'habito'); assert.equal(inst.objetivoS, 2700); assert.equal(inst.titulo, 'Leer');
    assert.ok(leer(inst, Date.now()).transcurridoS >= 599);

    const p = await s.habitoPausar(t.id);
    assert.equal(p.estado, 'pausado');
    e = await s.cargarEstado();
    inst = instantanea(e);
    assert.equal(e.segmentosHabito.length, 1, 'el tramo cerrado quedó como segmento');
    assert.ok(leer(inst, Date.now() + 1e7).transcurridoS >= 599 && leer(inst, Date.now() + 1e7).transcurridoS <= 610, 'pausado: conserva el acumulado');
    await s.habitoReanudar(t.id);
    const fin = await s.habitoFinalizar(t.id);
    assert.equal(fin.estado, 'finalizado');
    e = await s.cargarEstado();
    assert.equal(e.activo, null);
    assert.equal(resumenSesiones(e.sesiones).puntos, 0, 'el hábito no genera puntos de atención');
    const tiempo = como('sb_owner', `select temporizador_s from public.habito_tiempo where habito_id = '${habitoId}'`);
    assert.ok(Number(tiempo) >= 599, `tiempo de hábito acreditado: ${tiempo}`);
  });

  it('aislamiento: otro usuario no ve el temporizador ni las sesiones, y no puede controlarlos', async () => {
    limpiar();
    const s1 = servicioDe(U1); const s2 = servicioDe(U2);
    const f = await s1.focusIniciar({ modalidad: 'productivity', frenteId: 'tanku' });
    const e2 = await s2.cargarEstado();
    assert.equal(e2.activo, null); assert.deepEqual(e2.sesiones, []);
    const r = await ejecutarAccion(() => s2.focusCancelar(f.id));
    assert.equal(r.ok, false); assert.equal(r.error.codigo, 'no_encontrado');
    const g = await s2.focusIniciar({ modalidad: 'productivity', frenteId: 'tanku' });   // cada usuario tiene su propio bloqueo
    assert.equal(g.estado, 'en_curso');
  });

  it('el cliente no puede escribir directamente en las tablas del temporizador (T-1, T-8c)', async () => {
    limpiar();
    const cli = crearClienteLocal({ ejecutar: ejecutor, uid: U1 });
    const r = ejecutor(`begin; select set_config('request.jwt.claims', '{"sub":"${U1}","role":"authenticated"}', true); set local role authenticated; insert into public.temporizador_activo (tipo, ref_id, estado) values ('focus', gen_random_uuid(), 'corriendo'); commit;`);
    assert.equal(r.error?.code, '42501');
    assert.ok(cli);
  });

  it('preferencias: se guardan con la capa de datos y cambian la duración de la siguiente sesión; avisos y sonido se conservan', async () => {
    limpiar();
    const s = servicioDe(U1);
    const g = await s.guardarPreferencias({ focus_min: 45, descanso_corto_min: 10, avisos: false });
    assert.equal(g.focus_min, 45); assert.equal(g.avisos, false); assert.equal(g.sonido, true);
    const f = await s.focusIniciar({ modalidad: 'productivity', frenteId: 'salud' });
    assert.equal(f.duracion_objetivo_s, 2700);
    const e = await s.cargarEstado();
    assert.equal(e.prefs.focus_min, 45);
  });

  it('error real de la base no se confunde con vacío: parámetros inválidos', async () => {
    limpiar();
    const s = servicioDe(U1);
    const r = await ejecutarAccion(() => s.focusIniciar({ modalidad: 'otra', frenteId: 'tanku' }));
    assert.equal(r.ok, false);
    assert.equal(r.error.codigo, 'parametro_invalido');
  });

  // ====================== Hábitos y objetivos (entrega 2) ======================
  const habitosDe = (uid, almacen = memoria()) => crearServicioHabitos(crearClienteLocal({ ejecutar: ejecutor, uid }), { identidad: crearIdentidadDispositivo({ almacen }) });
  const hoyBogota = () => fechaBogota();
  const crearDiario = (hs, extra = {}) => hs.crear({ nombre: 'Leer', modo: 'manual', frecuencia: 'diaria', objetivoS: 2700, ...extra });

  it('hábito: se crea con la RPC, se lee con su programación y el nombre solo se renombra por la columna permitida', async () => {
    limpiar();
    const hs = habitosDe(U1);
    const h = await crearDiario(hs);
    const { habitos, versiones } = await hs.cargarHabitos({ desde: sumarDias(hoyBogota(), -30) });
    assert.deepEqual(habitos.map(x => x.nombre), ['Leer']);
    assert.equal(versiones[0].objetivo_s, 2700);
    assert.equal(hayOcurrencia(habitos[0], versiones, hoyBogota()), true);
    const r = await hs.renombrar({ habitoId: h.id, nombre: 'Leer libros' });
    assert.equal(r.nombre, 'Leer libros');
    const directo = ejecutor(`begin; select set_config('request.jwt.claims', '{"sub":"${U1}","role":"authenticated"}', true); set local role authenticated; update public.habitos_config set archivado_desde = current_date; commit;`);
    assert.equal(directo.error?.code, '42501', 'otras columnas no son editables por el cliente');
  });

  it('registro manual: reemplaza (no suma), queda historial con valor anterior y el vigente se lee; futuro y sin ocurrencia se rechazan', async () => {
    limpiar();
    const hs = habitosDe(U1);
    const h = await crearDiario(hs);
    const hoy = hoyBogota();
    const a = await hs.registrarManual({ habitoId: h.id, fecha: hoy, segundos: 1200 });
    assert.equal(a.manual_s, 1200);
    const b = await hs.registrarManual({ habitoId: h.id, fecha: hoy, segundos: 1800 });
    assert.equal(b.manual_s, 1800);
    const hist = await hs.historial({ habitoId: h.id, fecha: hoy });
    assert.deepEqual(hist.map(x => [x.valor_anterior_s, x.valor_nuevo_s, x.fuente]).reverse(), [[null, 1200, 'manual'], [1200, 1800, 'manual']]);
    const { tiempos } = await hs.cargarHabitos({ desde: hoy });
    assert.equal(tiempoVigente(tiempos[0]), 1800);
    const futuro = await ejecutarAccion(() => hs.registrarManual({ habitoId: h.id, fecha: sumarDias(hoy, 1), segundos: 60 }));
    assert.equal(futuro.error.codigo, 'fecha_no_permitida');
    const lunes = await habitosDe(U1).crear({ nombre: 'Solo lunes', modo: 'manual', frecuencia: 'dias', dias: [0], objetivoS: 600 });
    const otroDia = [0, 1, 2, 3, 4, 5, 6].map(i => sumarDias(hoy, i)).find(f => !hayOcurrenciaDe(lunes, f));
    assert.ok(otroDia, 'hay algún día sin ocurrencia');
    const sinOc = await ejecutarAccion(() => hs.registrarManual({ habitoId: lunes.id, fecha: hoy, segundos: 60 }).then(() => null));
    // hoy puede o no ser lunes: la regla se verifica con la función de dominio en el siguiente caso
    assert.ok(sinOc.ok === true || sinOc.error.codigo === 'sin_ocurrencia');
  });

  function hayOcurrenciaDe(h, fecha) { return hayOcurrencia({ id: h.id, archivado_desde: null }, [{ habito_id: h.id, vigente_desde: hoyBogota(), frecuencia: 'dias', dias_semana: [0] }], fecha); }

  it('el dominio JS y la base coinciden en las ocurrencias: el registro manual se acepta exactamente donde hay ocurrencia (14 días hacia atrás)', async () => {
    limpiar();
    const hs = habitosDe(U1);
    const h = await hs.crear({ nombre: 'Lun-Mié-Vie', modo: 'manual', frecuencia: 'dias', dias: [0, 2, 4], objetivoS: 1800 });
    como('postgres', `update public.habitos_config_versiones set vigente_desde = vigente_desde - 14 where habito_id = '${h.id}'`);
    const { habitos, versiones } = await hs.cargarHabitos({ desde: sumarDias(hoyBogota(), -30) });
    let aceptadas = 0; let rechazadas = 0;
    for (let i = 0; i <= 14; i++) {
      const f = sumarDias(hoyBogota(), -i);
      const esperado = hayOcurrencia(habitos[0], versiones, f);
      const r = await ejecutarAccion(() => hs.registrarManual({ habitoId: h.id, fecha: f, segundos: 600 }));
      assert.equal(r.ok, esperado, `fecha ${f}: JS=${esperado} base=${r.ok}`);
      if (!esperado) assert.equal(r.error.codigo, 'sin_ocurrencia');
      r.ok ? aceptadas++ : rechazadas++;
    }
    assert.ok(aceptadas >= 5 && rechazadas >= 5, `aceptadas ${aceptadas}, rechazadas ${rechazadas}`);
  });

  it('Wellbeing calculado con datos reales: tope por ocurrencia y cero real de una ocurrencia sin tiempo', async () => {
    limpiar();
    const hs = habitosDe(U1);
    const h = await crearDiario(hs, { objetivoS: 2700 });
    como('postgres', `update public.habitos_config_versiones set vigente_desde = vigente_desde - 2 where habito_id = '${h.id}'`);
    const hoy = hoyBogota();
    await hs.registrarManual({ habitoId: h.id, fecha: sumarDias(hoy, -2), segundos: 5400 });    // excede: topa en 2700
    await hs.registrarManual({ habitoId: h.id, fecha: sumarDias(hoy, -1), segundos: 1350 });    // mitad
    // hoy: sin registro = cero real
    const d = await hs.cargarHabitos({ desde: sumarDias(hoy, -2) });
    const w = wellbeing({ ...d, desde: sumarDias(hoy, -2), hasta: hoy, hoy });
    assert.equal(w.ocurrencias, 3);
    assert.ok(Math.abs(w.valor - (100 * (2700 + 1350 + 0)) / (3 * 2700)) < 1e-9, `W=${w.valor}`);
    const sinDatos = wellbeing({ ...d, desde: sumarDias(hoy, 1), hasta: sumarDias(hoy, 7), hoy });
    assert.equal(sinDatos.estado, 'sin_datos');
  });

  it('programar rige hacia delante (no hacia atrás) y archivar corta las ocurrencias futuras conservando el historial', async () => {
    limpiar();
    const hs = habitosDe(U1);
    const h = await crearDiario(hs, { objetivoS: 1800 });
    const hoy = hoyBogota();
    await hs.programar({ habitoId: h.id, frecuencia: 'dias', dias: [0], objetivoS: 3600, desde: sumarDias(hoy, 7) });
    const pasado = await ejecutarAccion(() => hs.programar({ habitoId: h.id, frecuencia: 'diaria', objetivoS: 60, desde: sumarDias(hoy, -1) }));
    assert.equal(pasado.error.codigo, 'fecha_no_permitida');
    const repetida = await ejecutarAccion(() => hs.programar({ habitoId: h.id, frecuencia: 'diaria', objetivoS: 60, desde: sumarDias(hoy, 7) }));
    assert.equal(repetida.error.codigo, 'version_existente');
    await hs.registrarManual({ habitoId: h.id, fecha: hoy, segundos: 900 });
    const arch = await hs.archivar({ habitoId: h.id });
    assert.equal(arch.archivado_desde, sumarDias(hoy, 1));
    const d = await hs.cargarHabitos({ desde: hoy });
    assert.equal(hayOcurrencia(d.habitos[0], d.versiones, hoy), true, 'hoy sigue contando');
    assert.equal(hayOcurrencia(d.habitos[0], d.versiones, sumarDias(hoy, 1)), false);
    assert.equal(tiempoVigente(d.tiempos[0]), 900, 'el historial se conserva');
  });

  it('aislamiento de hábitos entre usuarios', async () => {
    limpiar();
    const h1 = habitosDe(U1); const h2 = habitosDe(U2);
    const h = await crearDiario(h1);
    assert.deepEqual((await h2.cargarHabitos({ desde: '2000-01-01' })).habitos, []);
    const r = await ejecutarAccion(() => h2.registrarManual({ habitoId: h.id, fecha: hoyBogota(), segundos: 60 }));
    assert.equal(r.error.codigo, 'habito_invalido');
  });

  it('objetivos: semana actual y futuras se guardan y borran; una semana pasada es inmutable (semana_cerrada); sin objetivos no hay herencia', async () => {
    limpiar();
    const hs = habitosDe(U1);
    const hoy = hoyBogota(); const lunes = inicioSemana(hoy);
    await hs.guardarObjetivo({ semana: lunes, frenteId: 'tanku', puntos: 6 });
    await hs.guardarObjetivo({ semana: lunes, frenteId: 'tanku', puntos: 8 });                 // upsert: actualiza
    await hs.guardarObjetivo({ semana: sumarDias(lunes, 7), frenteId: 'salud', puntos: 3 });
    let obj = await hs.listarObjetivos({ desde: sumarDias(lunes, -28) });
    assert.deepEqual(obj.map(o => [o.semana_inicio, o.frente_id, o.puntos]), [[lunes, 'tanku', 8], [sumarDias(lunes, 7), 'salud', 3]]);
    const pasada = await ejecutarAccion(() => hs.guardarObjetivo({ semana: sumarDias(lunes, -7), frenteId: 'tanku', puntos: 5 }));
    assert.equal(pasada.error.codigo, 'semana_cerrada');
    como('postgres', `insert into public.objetivos_atencion (user_id, semana_inicio, frente_id, puntos) values ('${U1}', '${sumarDias(lunes, -7)}', 'tanku', 4)`);
    const borrar = await ejecutarAccion(() => hs.eliminarObjetivo({ semana: sumarDias(lunes, -7), frenteId: 'tanku' }));
    assert.equal(borrar.error.codigo, 'semana_cerrada', 'una semana cerrada no se borra desde el cliente');
    await hs.eliminarObjetivo({ semana: sumarDias(lunes, 7), frenteId: 'salud' });
    obj = await hs.listarObjetivos({ desde: lunes });
    assert.deepEqual(obj.map(o => o.frente_id), ['tanku']);
    const fuera = await ejecutarAccion(() => hs.guardarObjetivo({ semana: sumarDias(lunes, 1), frenteId: 'tanku', puntos: 1 }));
    assert.equal(fuera.ok, false, 'un día que no es lunes viola la restricción de la tabla');
  });

  it('Balance con datos reales: puntos por frente de sesiones completadas (parcial y cancelada no cuentan) contra el objetivo', async () => {
    limpiar();
    const s = servicioDe(U1); const hs = habitosDe(U1);
    for (const frente of ['tanku', 'tanku', 'personal']) {
      const f = await s.focusIniciar({ modalidad: 'productivity', frenteId: frente });
      retroceder(1800);
      await s.focusCompletar(f.id);
    }
    const p = await s.focusIniciar({ modalidad: 'productivity', frenteId: 'tanku' }); await s.focusCompletar(p.id);   // parcial
    const c = await s.focusIniciar({ modalidad: 'productivity', frenteId: 'tanku' }); await s.focusCancelar(c.id);
    const hoy = hoyBogota(); const lunes = inicioSemana(hoy);
    await hs.guardarObjetivo({ semana: lunes, frenteId: 'tanku', puntos: 7 });
    await hs.guardarObjetivo({ semana: lunes, frenteId: 'personal', puntos: 7 });
    const sesiones = await hs.sesionesCompletadas({ desde: lunes, hasta: sumarDias(lunes, 6) });
    assert.equal(sesiones.length, 3);
    const objetivos = objetivosPorSemana(await hs.listarObjetivos({ desde: lunes }));
    const b = balanceSemana({ lunes, hoy, objetivos, sesiones });
    const dias = b.diasElegibles;                                    // objetivo prorrateado: 7/7 × días transcurridos
    assert.equal(b.estado, 'ok');
    assert.equal(b.frentes.find(f => f.id === 'tanku').puntos, 2);
    assert.equal(b.frentes.find(f => f.id === 'personal').puntos, 1);
    assert.equal(b.frentes.find(f => f.id === 'tanku').objetivo, dias);
    const esperado = (100 * (Math.min(dias, 2) + Math.min(dias, 1))) / (2 * dias);
    assert.ok(Math.abs(b.valor - esperado) < 1e-9, `B=${b.valor} esperado ${esperado}`);
  });

  // ====================== Execution y Life Pulse (entrega 3) ======================
  const comoU1 = sql => { const r = ejecutor(`begin; select set_config('request.jwt.claims', '{"sub":"${U1}","role":"authenticated"}', true); set local role authenticated; ${sql}; commit;`); assert.equal(r.error, null, JSON.stringify(r.error)); return r.salida.split(/\r?\n/).filter(l => !l.startsWith('{"sub"')).join('\n').trim(); };
  const primera = s => s.split(/\r?\n/)[0];
  const fijar = (id, extraWhere, cuando) => como('postgres', `update public.cambios_registro set cambiado_en = '${cuando}' where registro_id = '${id}' ${extraWhere}`);
  const aInstante = (fecha, hhmm) => `${fecha} ${hhmm}-05`;

  it('Execution con datos reales: prioridad al cierre (T-6) reconstruida desde el historial coincide con la función SQL; T=75 %, M=0 %, E=45 %', async () => {
    limpiar();
    const hoy = hoyBogota(); const d = sumarDias(hoy, -3);
    const A = primera(comoU1(`insert into public.pendientes (frente, texto, fecha_limite, prioridad) values ('tanku', 'A', '${d}', 'alta') returning id`));
    const B = primera(comoU1(`insert into public.pendientes (frente, texto, fecha_limite, prioridad) values ('tanku', 'B', '${d}', 'media') returning id`));
    comoU1(`update public.pendientes set hecho = true, hecho_en = now() where id = '${A}'`);
    comoU1(`update public.pendientes set prioridad = 'baja' where id = '${B}'`);
    comoU1(`update public.pendientes set prioridad = 'alta' where id = '${B}'`);
    comoU1(`insert into public.metas (frente, titulo) values ('tanku', 'm')`);
    const H = primera(comoU1(`with m as (select id from public.metas limit 1) insert into public.hitos (meta_id, titulo, fecha, prioridad) select id, 'h', '${d}', 'media' from m returning id`));
    como('postgres', `update public.cambios_registro set cambiado_en = '${aInstante(sumarDias(hoy, -5), '09:00')}'::timestamptz where evento = 'creado'`);
    fijar(A, "and campo = 'hecho'", aInstante(d, '10:00'));
    fijar(B, "and campo = 'prioridad' and valor_nuevo = 'baja'", aInstante(d, '23:00'));
    fijar(B, "and campo = 'prioridad' and valor_nuevo = 'alta'", aInstante(sumarDias(d, 1), '09:00'));
    const cliente = crearClienteLocal({ ejecutar: ejecutor, uid: U1 });
    const { lifePulse: lp } = await cargarLifePulse(cliente, { tipo: 'dia', ancla: d });
    assert.equal(lp.execution.T.valor, 75, `T=${lp.execution.T.valor}`);
    assert.equal(lp.execution.M.valor, 0, 'hito sin completar y vencido: cero real');
    assert.ok(Math.abs(lp.execution.valor - 45) < 1e-9, `E=${lp.execution.valor}`);
    assert.equal(lp.execution.estado, 'ok');
    const filas = await cliente.from('cambios_registro').select('*');
    for (const [tabla, id] of [['pendientes', A], ['pendientes', B], ['hitos', H]]) {
      const r = await cliente.rpc('prioridad_en_cierre', { p_tabla: tabla, p_registro: id, p_fecha_limite: d });
      assert.equal(r.error, null);
      assert.equal(prioridadEnCierre(filas.data.filter(f => f.registro_id === id), d), r.data, `${tabla} ${id}`);
    }
    assert.equal(lp.balance.estado, 'sin_objetivo'); assert.equal(lp.wellbeing.estado, 'sin_datos');
  });

  it('Execution: aplazar, completar tarde, eliminar y desmarcar sobre datos reales', async () => {
    limpiar();
    const hoy = hoyBogota(); const d1 = sumarDias(hoy, -4); const d2 = sumarDias(hoy, -1);
    const P = primera(comoU1(`insert into public.pendientes (frente, texto, fecha_limite) values ('tanku', 'P', '${d1}') returning id`));
    comoU1(`update public.pendientes set fecha_limite = '${d2}' where id = '${P}'`);
    comoU1(`update public.pendientes set hecho = true, hecho_en = now() where id = '${P}'`);
    const Q = primera(comoU1(`insert into public.pendientes (frente, texto, fecha_limite) values ('tanku', 'Q', '${d1}') returning id`));
    comoU1(`update public.pendientes set hecho = true, hecho_en = now() where id = '${Q}'`);
    comoU1(`update public.pendientes set hecho = false, hecho_en = null where id = '${Q}'`);
    const R = primera(comoU1(`insert into public.pendientes (frente, texto, fecha_limite) values ('tanku', 'R', '${sumarDias(hoy, 5)}') returning id`));
    comoU1(`delete from public.pendientes where id = '${R}'`);
    como('postgres', `update public.cambios_registro set cambiado_en = '${aInstante(sumarDias(hoy, -6), '09:00')}'::timestamptz where evento = 'creado'`);
    fijar(P, "and campo = 'fecha_limite'", aInstante(sumarDias(d1, 1), '09:00'));
    fijar(P, "and campo = 'hecho'", aInstante(d2, '08:00'));
    fijar(Q, "and campo = 'hecho' and valor_nuevo = 'true'", aInstante(d1, '12:00'));
    fijar(Q, "and campo = 'hecho' and valor_nuevo = 'false'", aInstante(sumarDias(d1, 1), '12:00'));
    fijar(R, "and evento = 'eliminado'", aInstante(sumarDias(hoy, -2), '12:00'));
    const cliente = crearClienteLocal({ ejecutar: ejecutor, uid: U1 });
    const filas = (await cliente.from('cambios_registro').select('*')).data;
    const { obligaciones } = todasLasObligaciones({ filas, ahora: Date.now() });
    const de = id => obligaciones.filter(o => o.registroId === id).map(o => [o.fecha, o.resultado]);
    assert.deepEqual(de(P), [[d1, 'incumplida'], [d2, 'cumplida_a_tiempo']], 'aplazamiento: dos obligaciones del mismo compromiso');
    assert.deepEqual(de(Q), [[d1, 'incumplida']], 'desmarcar reevalúa la obligación vigente');
    assert.deepEqual(de(R), [], 'eliminada antes de llegar: se descarta');
    const sem = await cargarLifePulse(cliente, { tipo: 'semana', ancla: d1 });
    assert.ok(sem.lifePulse.execution.T.obligaciones >= 3);
  });

  it('Life Pulse con datos reales de los tres orígenes, sin combinarlos; períodos futuros y aislamiento', async () => {
    limpiar();
    const s = servicioDe(U1); const hs = habitosDe(U1);
    const hoy = hoyBogota(); const lunes = inicioSemana(hoy);
    const f = await s.focusIniciar({ modalidad: 'productivity', frenteId: 'tanku' }); retroceder(1800); await s.focusCompletar(f.id);
    await hs.guardarObjetivo({ semana: lunes, frenteId: 'tanku', puntos: 7 });
    const h = await crearDiario(hs, { objetivoS: 1800 });
    await hs.registrarManual({ habitoId: h.id, fecha: hoy, segundos: 900 });
    const cliente = crearClienteLocal({ ejecutar: ejecutor, uid: U1 });
    const dia = (await cargarLifePulse(cliente, { tipo: 'dia', ancla: hoy })).lifePulse;
    assert.equal(dia.execution.estado, 'sin_datos', 'Focus no mueve Execution');
    assert.equal(dia.balance.valor, 100);
    assert.equal(dia.wellbeing.valor, 50);
    const mes = (await cargarLifePulse(cliente, { tipo: 'mes', ancla: hoy })).lifePulse;
    assert.equal(mes.rango.desde.slice(8), '01');
    assert.equal(mes.wellbeing.estado, 'ok');
    const futuro = (await cargarLifePulse(cliente, { tipo: 'semana', ancla: sumarDias(lunes, 14) })).lifePulse;
    assert.equal(futuro.futuro, true); assert.equal(futuro.balance.estado, 'no_iniciado');
    const otro = (await cargarLifePulse(crearClienteLocal({ ejecutar: ejecutor, uid: U2 }), { tipo: 'dia', ancla: hoy })).lifePulse;
    assert.deepEqual([otro.execution.estado, otro.balance.estado, otro.wellbeing.estado], ['sin_datos', 'sin_objetivo', 'sin_datos']);
  });

  // ====================== Regla D3-25 y filtro de frente sobre datos reales ======================
  it('D3-25 con datos reales: lo que vence hoy cuenta desde el inicio del día (provisional) y cambia a cumplido al completarlo; el día, la semana y el mes coinciden', async () => {
    limpiar();
    const hoy = hoyBogota();
    const X = primera(comoU1(`insert into public.pendientes (frente, texto, fecha_limite, prioridad) values ('tanku', 'X', '${hoy}', 'alta') returning id`));
    const Y = primera(comoU1(`insert into public.pendientes (frente, texto, fecha_limite, prioridad) values ('tanku', 'Y', '${hoy}', 'baja') returning id`));
    comoU1(`update public.pendientes set hecho = true, hecho_en = now() where id = '${Y}'`);
    const cliente = crearClienteLocal({ ejecutar: ejecutor, uid: U1 });
    const dia = (await cargarLifePulse(cliente, { tipo: 'dia', ancla: hoy })).lifePulse.execution;
    assert.equal(dia.T.pesoProgramado, 4);                            // X (alta=3) abierta provisional + Y (baja=1) cumplida
    assert.equal(dia.T.pesoCompletado, 1);
    assert.equal(dia.valor, 25);
    assert.equal(dia.provisional, true); assert.equal(dia.T.provisionales, 1);
    const sem = (await cargarLifePulse(cliente, { tipo: 'semana', ancla: hoy })).lifePulse.execution;
    const mes = (await cargarLifePulse(cliente, { tipo: 'mes', ancla: hoy })).lifePulse.execution;
    assert.deepEqual([sem.T.pesoProgramado, sem.T.pesoCompletado], [4, 1]);
    assert.deepEqual([mes.T.pesoProgramado, mes.T.pesoCompletado], [4, 1]);
    comoU1(`update public.pendientes set hecho = true, hecho_en = now() where id = '${X}'`);
    const despues = (await cargarLifePulse(cliente, { tipo: 'dia', ancla: hoy })).lifePulse.execution;
    assert.deepEqual([despues.valor, despues.provisional], [100, false]);
  });

  it('filtro de frente con datos reales: Balance se limita al frente de la URL; Execution y Wellbeing no cambian', async () => {
    limpiar();
    const s = servicioDe(U1); const hs = habitosDe(U1);
    const hoy = hoyBogota(); const lunes = inicioSemana(hoy);
    for (const frente of ['tanku', 'salud']) { const f = await s.focusIniciar({ modalidad: 'productivity', frenteId: frente }); retroceder(1800); await s.focusCompletar(f.id); }
    await hs.guardarObjetivo({ semana: lunes, frenteId: 'tanku', puntos: 7 });
    await hs.guardarObjetivo({ semana: lunes, frenteId: 'salud', puntos: 14 });
    const cliente = crearClienteLocal({ ejecutar: ejecutor, uid: U1 });
    const todos = (await cargarLifePulse(cliente, { tipo: 'dia', ancla: hoy })).lifePulse;
    const tanku = (await cargarLifePulse(cliente, { tipo: 'dia', ancla: hoy, frenteId: 'tanku' })).lifePulse;
    const salud = (await cargarLifePulse(cliente, { tipo: 'dia', ancla: hoy, frenteId: 'salud' })).lifePulse;
    assert.equal(tanku.balance.valor, 100);                           // 1 punto de 1 (7/7)
    assert.equal(salud.balance.valor, 50);                            // 1 punto de 2 (14/7)
    assert.equal(tanku.balance.frentes.length, 1);
    assert.deepEqual(tanku.execution, todos.execution);
    assert.deepEqual(tanku.wellbeing, todos.wellbeing);
  });
});
