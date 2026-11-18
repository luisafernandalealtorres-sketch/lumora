// Navegación del shell. Fuente única de grupos, elementos y rutas.
//
// - La agrupación es VISUAL: las rutas siguen siendo planas (/metas, /finanzas…).
// - Un elemento puede tener : rutas que conducen a él (/gastos abre Finanzas en la pestaña Gastos).
//   Ninguna ruta lleva el nombre de un grupo.
// - Un elemento con `accion` no es una ruta: abre un panel (el asistente).
// - `soloDesarrollo` oculta el elemento en producción (el laboratorio).

export const GRUPOS = [
  { id: 'inicio', nombre: 'Inicio' },
  { id: 'mi-vida', nombre: 'Mi vida' },
  { id: 'conocimiento', nombre: 'Conocimiento' },
  { id: 'asistente', nombre: 'Asistente IA' },
  { id: 'desarrollo', nombre: 'Desarrollo' },
];

export const ELEMENTOS = [
  { id: 'mi-dia', nombre: 'Home', ruta: '/', grupo: 'inicio', icono: 'home', claves: ['mi dia', 'inicio', 'hoy', 'tablero', 'pendientes', 'agenda'], barraMovil: true },
  { id: 'life-pulse', nombre: 'Life Pulse', ruta: '/life-pulse', grupo: 'inicio', icono: 'sparkles', claves: ['indicadores', 'execution', 'balance', 'wellbeing', 'pulso', 'ejecucion'] },
  { id: 'panel', nombre: 'Panel', ruta: '/panel', grupo: 'inicio', icono: 'chart', claves: ['metricas', 'avances', 'resumen', 'indicadores'], barraMovil: true },
  { id: 'focus', nombre: 'Focus', ruta: '/focus', grupo: 'mi-vida', icono: 'bolt', claves: ['temporizador', 'pomodoro', 'enfoque', 'descanso', 'sesion', 'concentracion'] },
  { id: 'habitos', nombre: 'Hábitos', ruta: '/habitos', grupo: 'mi-vida', icono: 'check', claves: ['habito', 'rutina', 'bienestar', 'wellbeing', 'tiempo'] },
  { id: 'atencion', nombre: 'Atención', ruta: '/atencion', grupo: 'mi-vida', icono: 'target', claves: ['balance', 'objetivos', 'puntos', 'semanal', 'frentes'] },
  { id: 'metas', nombre: 'Metas', ruta: '/metas', grupo: 'mi-vida', icono: 'target', claves: ['objetivos', 'proyectos', 'avance'], barraMovil: true },
  { id: 'finanzas', nombre: 'Finanzas', ruta: '/finanzas', grupo: 'mi-vida', icono: 'wallet', alias: ['/gastos'], claves: ['plata', 'dinero', 'gastos', 'presupuesto', 'ingresos', 'deudas', 'recurrentes', 'recibos', 'compras', 'categorias'] },
  { id: 'salud', nombre: 'Salud', ruta: '/salud', grupo: 'mi-vida', icono: 'heart', claves: ['habitos', 'medidas', 'bienestar', 'ejercicio'] },
  { id: 'jornada', nombre: 'Jornada', ruta: '/jornada', grupo: 'mi-vida', icono: 'book', claves: ['diario', 'relato', 'noche', 'reflexion'] },
  { id: 'biblioteca', nombre: 'Biblioteca', ruta: '/biblioteca', grupo: 'conocimiento', icono: 'library', claves: ['articulos', 'videos', 'libros', 'lecturas'] },
  { id: 'cerebro', nombre: 'Cerebro', ruta: '/cerebro', grupo: 'conocimiento', icono: 'layers', claves: ['notas', 'ideas', 'apuntes'] },
  { id: 'asistente', nombre: 'Asistente', accion: 'asistente', grupo: 'asistente', icono: 'sparkles', claves: ['ia', 'inteligencia', 'chat', 'ayuda'] },
  { id: 'laboratorio', nombre: 'Laboratorio', ruta: '/laboratorio', grupo: 'desarrollo', icono: 'sliders', claves: ['componentes', 'diseno', 'galeria'], soloDesarrollo: true },
];

/** Las 13 rutas de negocio (sin el laboratorio). */
export const RUTAS_NEGOCIO = ['/', '/life-pulse', '/panel', '/focus', '/habitos', '/atencion', '/metas', '/finanzas', '/gastos', '/jornada', '/salud', '/biblioteca', '/cerebro'];

/** Elementos visibles según el entorno. */
export function elementosVisibles({ desarrollo = false } = {}) {
  return ELEMENTOS.filter(e => desarrollo || !e.soloDesarrollo);
}

/** Grupos con sus elementos, sin grupos vacíos, en orden. */
export function gruposConElementos({ desarrollo = false } = {}) {
  const vis = elementosVisibles({ desarrollo });
  return GRUPOS.map(g => ({ ...g, elementos: vis.filter(e => e.grupo === g.id) })).filter(g => g.elementos.length);
}

/** Elementos de la barra inferior móvil, en orden. */
export function elementosBarraMovil() {
  return ELEMENTOS.filter(e => e.barraMovil);
}

/** Elementos que quedan en la hoja "Más" (todo lo visible que no está en la barra). */
export function elementosMas({ desarrollo = false } = {}) {
  return elementosVisibles({ desarrollo }).filter(e => !e.barraMovil);
}

function limpiar(ruta) {
  if (typeof ruta !== 'string') return '/';
  const sinQuery = ruta.split(/[?#]/)[0] || '/';
  return sinQuery.length > 1 ? sinQuery.replace(/\/+$/, '') : sinQuery;
}

/**
 * Elemento de navegación de una ruta (coincidencia exacta o por prefijo de segmento). null si no hay.
 * Con `desarrollo: false` los elementos solo de desarrollo (el laboratorio) no existen.
 */
export function itemDeRuta(ruta, { desarrollo = true } = {}) {
  const r = limpiar(ruta);
  const candidatos = ELEMENTOS.filter(e => desarrollo || !e.soloDesarrollo);
  const exacto = candidatos.find(e => e.ruta === r || e.alias?.includes(r));
  if (exacto) return exacto;
  return candidatos.filter(e => e.ruta && e.ruta !== '/' && r.startsWith(e.ruta + '/'))
    .sort((a, b) => b.ruta.length - a.ruta.length)[0] ?? null;
}

/** ¿Está activo este elemento en la ruta actual? `/` solo es activo en `/`. */
export function esActivo(elemento, ruta, opciones) {
  if (!elemento || !elemento.ruta) return false;
  const actual = itemDeRuta(ruta, opciones);
  return !!actual && actual.id === elemento.id;
}

/** Migas de pan [{nombre, ruta?}] de una ruta. Vacío si la ruta no es de la app. */
export function migas(ruta, opciones) {
  const it = itemDeRuta(ruta, opciones);
  if (!it) return [];
  const grupo = GRUPOS.find(g => g.id === it.grupo);
  const cadena = [];
  if (grupo && it.grupo !== 'inicio') cadena.push({ nombre: grupo.nombre });
  if (it.padre) {
    const p = ELEMENTOS.find(e => e.id === it.padre);
    if (p) cadena.push({ nombre: p.nombre, ruta: p.ruta });
  }
  cadena.push({ nombre: it.nombre, ruta: it.ruta });
  return cadena;
}

/** Título del documento según la ruta. */
export function tituloDeRuta(ruta, base = 'Cerebro de Lu', opciones) {
  const it = itemDeRuta(ruta, opciones);
  return it && it.id !== 'mi-dia' ? `${it.nombre} · ${base}` : base;
}

/** ¿La hoja "Más" contiene la ruta actual? (para marcar "Más" como activo). */
export function masEstaActivo(ruta, { desarrollo = false } = {}) {
  const it = itemDeRuta(ruta, { desarrollo });
  return !!it && elementosMas({ desarrollo }).some(e => e.id === it.id);
}
