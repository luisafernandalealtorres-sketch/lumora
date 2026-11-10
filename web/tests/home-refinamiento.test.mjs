import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { TEXTO_ESTADO, EXPLICACION_FASE3 } from '../lib/domain/estadosHome.js';
import { mapaFrentes, vistaMapa } from '../lib/domain/mapaFrentes.js';
import { REGLAS_VIGILADAS, generarAlertas } from '../lib/domain/alertas.js';
import { balancePeriodo, objetivosPorSemana } from '../lib/domain/atencion.js';

const HOY = '2026-11-13';           // viernes: la semana empieza el 2026-11-09
const P = (o = {}) => ({ id: Math.random().toString(36).slice(2), texto: 'T', frente: 'tanku', hecho: false, fecha_limite: null, creado_en: '2026-11-01T12:00:00Z', hecho_en: null, meta_id: null, ...o });
const fuente = f => readFileSync(new URL(f, import.meta.url), 'utf8');
const home = readdirSync(new URL('../components/home/', import.meta.url)).filter(f => f.endsWith('.js'));

// ---- 1. Estados de la Fase 3 compactos, con explicación general una sola vez
test('la Fase 3 tiene un texto corto y una explicación general; el texto largo no se repite por módulo', () => {
  assert.ok(TEXTO_ESTADO.fase3_no_activada.corto.length < 45);
  assert.ok(EXPLICACION_FASE3.includes('migración v1.11') && EXPLICACION_FASE3.includes('autorización'));
  let usosExplicacion = 0;
  for (const f of home) {
    const src = fuente(`../components/home/${f}`);
    usosExplicacion += (src.match(/EXPLICACION_FASE3/g) ?? []).length;
    for (const m of src.matchAll(/<BloqueEstado[^>]*fase3_no_activada[^>]*>/g)) assert.match(m[0], /corto|detalle=/, `${f}: ${m[0]}`);
  }
  assert.equal(usosExplicacion, 2, 'se importa y se usa en un solo componente (NotaFase3)');
  assert.match(fuente('../components/home/HomeApp.js'), /f3\.estado === 'fase3_no_activada' && <NotaFase3/);
  assert.match(fuente('../components/home/HomeCentro.js'), /<BloqueEstado estado="fase3_no_activada" corto \/>/);
});

// ---- 2. Mapa de los seis frentes: comparación con la misma escala
test('vista del mapa: actividad con la misma escala, pendientes en segmentos y atención según la Fase 3', () => {
  const pend = [
    P({ frente: 'tanku', hecho: true, hecho_en: '2026-11-10T15:00:00Z' }), P({ frente: 'tanku', hecho: true, hecho_en: '2026-11-11T15:00:00Z' }),
    P({ frente: 'tanku', fecha_limite: '2026-11-01' }), P({ frente: 'tanku' }), P({ frente: 'salud', hecho: true, hecho_en: '2026-11-12T15:00:00Z' }),
  ];
  const sin = vistaMapa(mapaFrentes({ hoy: HOY, pendientes: pend, notas: [], metas: [], hitos: [], gastos: [] }));
  const tanku = sin.filas.find(f => f.id === 'tanku'); const salud = sin.filas.find(f => f.id === 'salud');
  assert.equal(sin.maxActividad, 2);
  assert.deepEqual([tanku.actividad.ancho, salud.actividad.ancho], [1, 0.5]);
  assert.deepEqual(tanku.pendientes.segmentos.map(s => [s.clave, s.valor]), [['completados', 2], ['abiertos', 1], ['vencidos', 1]]);
  assert.equal(tanku.pendientes.segmentos.reduce((s, x) => s + x.proporcion, 0), 1);
  assert.equal(tanku.atencion.estado, 'no_disponible');           // Fase 3 sin activar
  assert.equal(sin.hayDatos, true);

  const objetivos = [{ semana_inicio: '2026-11-09', frente_id: 'tanku', puntos: 14 }];
  const sesiones = [{ id: 's', frente_id: 'tanku', estado: 'completada', puntos: 1, finalizado_en: '2026-11-12T20:00:00Z' }];
  const balance = balancePeriodo({ desde: '2026-11-09', hasta: '2026-11-15', hoy: HOY, objetivos: objetivosPorSemana(objetivos), sesiones });
  const con = vistaMapa(mapaFrentes({ hoy: HOY, pendientes: pend, notas: [], metas: [], hitos: [], gastos: [], sesiones, balance }));
  assert.equal(con.filas.find(f => f.id === 'tanku').atencion.estado, 'objetivo');
  assert.equal(con.filas.find(f => f.id === 'salud').atencion.estado, 'sin_objetivo');
});

test('vista del mapa sin ningún dato: seis frentes y ningún porcentaje inventado', () => {
  const v = vistaMapa(mapaFrentes({ hoy: HOY, pendientes: [], notas: [], metas: [], hitos: [], gastos: [] }));
  assert.equal(v.hayDatos, false);
  assert.deepEqual(v.filas.map(f => f.id), ['tanku', 'ticketcode', 'personal', 'salud', 'familia', 'otros']);
  assert.ok(v.filas.every(f => f.actividad.ancho === null && f.pendientes.segmentos.length === 0 && f.sinNingunDato));
});

test('en el mapa la Fase 3 sin activar no repite el texto largo en cada fila: guion con explicación accesible y un solo aviso corto', () => {
  const src = fuente('../components/home/Bloques.js');
  assert.ok(src.includes("'—'") && src.includes("aria-label={f.atencion.estado === 'sin_objetivo' ? undefined : 'Fase 3 aún no activada'}"));
  assert.equal((src.match(/<BloqueEstado estado="fase3_no_activada"/g) ?? []).length, 1);
});

test('el mapa es la pieza central: borde de énfasis, comparación en tres columnas, motivo visible y versión móvil', () => {
  const css = fuente('../components/home/Home.module.css');
  assert.match(css, /\.mapa \{ border: 2px solid var\(--ds-primary\)/);
  assert.match(css, /\.cabeceraMapa, \.filaMapa \{ display: grid; grid-template-columns:/);
  assert.match(css, /@media \(max-width: 767px\) \{\s*\.cabeceraMapa \{ display: none; \}/);
  const src = fuente('../components/home/Bloques.js');
  for (const s of ['Actividad de la semana', 'Atención frente al objetivo', 'Pendientes', '<b>Motivo:</b>', 'estilos.segmentada', 'estilos.apilada']) assert.ok(src.includes(s), s);
});

// ---- 3. Próximas acciones y Hoy sin superficies vacías
test('sin alertas se muestran las reglas que se vigilan (contenido útil, no un vacío); con una fuente fallida sigue siendo error de lectura', () => {
  assert.ok(REGLAS_VIGILADAS.length >= 6 && REGLAS_VIGILADAS.every(r => r.id && r.texto));
  assert.equal(generarAlertas({ hoy: HOY, pendientes: [] }).estado, 'sin_registros');
  assert.equal(generarAlertas({ hoy: HOY, pendientes: [], errores: ['gastos'] }).estado, 'error_lectura');
  const src = fuente('../components/home/Bloques.js');
  assert.ok(src.includes('REGLAS_VIGILADAS') && src.includes('Nada requiere tu atención ahora'));
});

test('Hoy sin pendientes ofrece alta rápida y no muestra plegables vacíos; con pendientes conserva el componente heredado', () => {
  const src = fuente('../components/home/HoyPrioridades.js');
  assert.ok(src.includes('function AltaRapida') && src.includes('Escribe tu primer pendiente'));
  assert.match(src, /!errorPendientes && !sinPendientes && \(\s*<details/);
  assert.ok(src.includes('<Pendientes '));
  assert.ok(src.includes('Actividad reciente:</b> sin registros todavía'));
  assert.match(fuente('../components/home/Home.module.css'), /\.rejilla > \* \{ min-width: 0; align-self: start; \}/);
});

// ---- 4. Focus: jerarquía con sesión activa
test('con una sesión activa el temporizador es el protagonista: reloj grande, sesión, avance y controles', () => {
  const src = fuente('../components/home/HomeCentro.js');
  for (const s of ['estilos.relojGrande', 'estilos.focusActivo', 'estilos.sesion', 'Avance hacia la meta', '<Controles />', 'role="timer"']) assert.ok(src.includes(s), s);
  const css = fuente('../components/home/Home.module.css');
  assert.match(css, /\.relojGrande \{[^}]*font-size: clamp\(4rem, 14vw, 7rem\)/);
  assert.match(css, /\.focusActivo \{ background: var\(--ds-primary-soft\)/);
  // en reposo sigue siendo el formulario compacto
  assert.ok(src.includes('Iniciar Focus de'));
});

test('los componentes de Home no usan colores escritos a mano', () => {
  for (const f of home) assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(fuente(`../components/home/${f}`)), f);
});
