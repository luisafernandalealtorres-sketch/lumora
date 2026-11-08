// Agrupación VISUAL de frentes. Única fuente de verdad.
//
// - Los identificadores originales (`slug`) de la tabla `frentes` NO se tocan.
// - Esta agrupación solo existe en el código. Deshacerla o cambiarla es editar
//   FRENTES_DISENO; no se reescribe ningún dato en la base.
// - Un slug que no esté aquí aparece como "Sin asignar". Nunca se oculta ni se
//   reasigna automáticamente.
//
// Decisiones aprobadas el 8 nov 2026 (docs/MAPEO-FRENTES.md):
//   - Familia incluye `salud-abuela` y `jardin`. La salud de la abuela NO va en Salud.
//   - Salud es solo la salud personal (slug `salud`, más hábitos, medidas y objetivos).

/** Seis frentes de diseño, en el orden de la especificación. */
export const FRENTES_DISENO = [
  { id: 'tanku', nombre: 'TANKU', slugs: ['tanku'] },
  { id: 'ticketcode', nombre: 'TICKETCODE', slugs: ['ticketcode-eventos', 'ticketcode-eve'] },
  { id: 'personal', nombre: 'Personal', slugs: ['personal', 'hogar'] },
  { id: 'salud', nombre: 'Salud', slugs: ['salud'] },
  { id: 'familia', nombre: 'Familia', slugs: ['jardin', 'salud-abuela'] },
  { id: 'otros', nombre: 'Otros proyectos', slugs: ['hama', 'crochet'] },
];

/** Frente que recibe cualquier slug que no esté en el mapa. */
export const SIN_ASIGNAR = { id: 'sin-asignar', nombre: 'Sin asignar', slugs: [] };

/** Valor reservado para "no filtrar". */
export const TODOS = 'todos';

// Índice derivado de FRENTES_DISENO (slug -> frente de diseño). No se edita a mano.
const POR_SLUG = new Map();
for (const f of FRENTES_DISENO) for (const s of f.slugs) POR_SLUG.set(s, f);

/** Frente de diseño de un slug original. Si no está contemplado, devuelve SIN_ASIGNAR. */
export function frenteDeSlug(slug) {
  return POR_SLUG.get(slug) ?? SIN_ASIGNAR;
}

/** Nombre visible del frente de diseño de un slug. */
export function nombreFrenteDeSlug(slug) {
  return frenteDeSlug(slug).nombre;
}

/** Frente de diseño por su id ('familia', 'otros', …). */
export function frentePorId(id) {
  if (id === SIN_ASIGNAR.id) return SIN_ASIGNAR;
  return FRENTES_DISENO.find(f => f.id === id) ?? null;
}

/**
 * Slugs originales asociados a un frente de diseño.
 * Para 'sin-asignar' hay que indicar los slugs que existen en la base
 * (`todosLosSlugs`); devuelve los que el mapa no contempla.
 */
export function slugsDeFrente(id, todosLosSlugs = []) {
  if (id === SIN_ASIGNAR.id) return todosLosSlugs.filter(s => !POR_SLUG.has(s));
  const f = frentePorId(id);
  return f ? [...f.slugs] : [];
}

/**
 * Filtra registros por frente de diseño usando los slugs originales.
 * - `id` vacío o 'todos': devuelve todos los registros, sin excepción.
 * - 'sin-asignar': devuelve los registros cuyo slug no está en el mapa.
 * - Un registro sin slug (nulo) cuenta como "sin asignar", no desaparece.
 * No modifica los registros ni el arreglo recibido.
 */
export function filtrarPorFrente(registros, id, campo = 'frente') {
  if (!id || id === TODOS) return [...registros];
  if (id === SIN_ASIGNAR.id) return registros.filter(r => !POR_SLUG.has(r[campo]));
  const f = frentePorId(id);
  if (!f) return [];
  return registros.filter(r => f.slugs.includes(r[campo]));
}

/**
 * Agrupa registros por frente de diseño, en el orden de FRENTES_DISENO.
 * Si hay registros sin asignar, se agrega al final el grupo "Sin asignar".
 * Los grupos vacíos se omiten; ningún registro queda fuera.
 */
export function agruparPorFrente(registros, campo = 'frente') {
  const grupos = [...FRENTES_DISENO, SIN_ASIGNAR].map(f => ({ frente: f, registros: [] }));
  for (const r of registros) {
    const f = frenteDeSlug(r[campo]);
    grupos.find(g => g.frente.id === f.id).registros.push(r);
  }
  return grupos.filter(g => g.registros.length > 0);
}

/**
 * Agrupa los frentes originales (filas de la tabla `frentes`) por frente de diseño,
 * para armar selectores. Los slugs no contemplados van al grupo "Sin asignar".
 */
export function agruparFrentes(frentes) {
  return agruparPorFrente(frentes, 'slug').map(g => ({ frente: g.frente, frentes: g.registros }));
}

/**
 * Revisa que el mapa sea consistente con los frentes que hay en la base.
 * - sinAsignar: slugs de la base que el mapa no contempla.
 * - fantasma: slugs del mapa que no existen en la base.
 * - duplicados: slugs repetidos dentro del mapa (un slug en dos frentes).
 */
export function revisarMapa(slugsEnBase) {
  const base = new Set(slugsEnBase);
  const vistos = new Set();
  const duplicados = [];
  for (const f of FRENTES_DISENO) {
    for (const s of f.slugs) {
      if (vistos.has(s)) duplicados.push(s);
      vistos.add(s);
    }
  }
  return {
    sinAsignar: slugsEnBase.filter(s => !POR_SLUG.has(s)),
    fantasma: [...POR_SLUG.keys()].filter(s => !base.has(s)),
    duplicados,
  };
}
