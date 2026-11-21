// Tareas que Lu propone a partir de notas de reunión. Lógica pura y compartida: la usa la herramienta (en el servidor) para
// limpiar lo que pide el modelo, y la pantalla para validar lo que Luisa edita antes de crear los pendientes.
// Nada de aquí escribe en la base: solo normaliza y valida.

export const MAX_TAREAS = 15;
export const MAX_TEXTO_TAREA = 200;
export const MIN_TEXTO_TAREA = 3;
export const PRIORIDADES = ['alta', 'media', 'baja'];

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Fecha AAAA-MM-DD real (rechaza 2026-02-31) o null. */
export function fechaValida(valor) {
  if (typeof valor !== 'string' || !FECHA.test(valor)) return null;
  const d = new Date(`${valor}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== valor ? null : valor;
}

/**
 * Una tarea limpia o null si no sirve.
 * @param {object} t  { texto, frente, fecha_limite, prioridad }
 * @param {{ frentesValidos?: string[] }} [opciones]  Slugs que se pueden asignar; otro valor queda en null (sin asignar)
 */
export function normalizarTarea(t, { frentesValidos = [] } = {}) {
  const texto = String(t?.texto ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXTO_TAREA);
  if (texto.length < MIN_TEXTO_TAREA) return null;
  const frente = String(t?.frente ?? '').trim().toLowerCase();
  return {
    texto,
    frente: frentesValidos.includes(frente) ? frente : null,
    fecha_limite: fechaValida(t?.fecha_limite),
    prioridad: PRIORIDADES.includes(t?.prioridad) ? t.prioridad : 'media',
  };
}

/** Lista limpia: sin vacías, sin repetidas (mismo texto) y con tope. Devuelve { tareas, descartadas }. */
export function normalizarTareas(lista, opciones) {
  const vistas = new Set();
  const tareas = [];
  let descartadas = 0;
  for (const crudo of Array.isArray(lista) ? lista : []) {
    const t = normalizarTarea(crudo, opciones);
    const clave = t?.texto.toLowerCase();
    if (!t || vistas.has(clave) || tareas.length >= MAX_TAREAS) { descartadas++; continue; }
    vistas.add(clave);
    tareas.push(t);
  }
  return { tareas, descartadas };
}

/** Dudas del modelo como frases cortas (máximo 5). */
export function normalizarDudas(dudas) {
  return (Array.isArray(dudas) ? dudas : []).map(d => String(d ?? '').replace(/\s+/g, ' ').trim().slice(0, 200)).filter(Boolean).slice(0, 5);
}

/**
 * Filas listas para insertar en `pendientes` a partir de lo que Luisa dejó marcado en la tarjeta.
 * Devuelve { filas } o { error } si alguna no tiene frente (el pendiente exige uno).
 */
export function filasParaCrear(tareas, frentesValidos) {
  const filas = [];
  for (const crudo of tareas ?? []) {
    const t = normalizarTarea(crudo, { frentesValidos });
    if (!t) return { error: 'texto' };
    if (!t.frente) return { error: 'frente' };
    filas.push({ texto: t.texto, frente: t.frente, fecha_limite: t.fecha_limite, prioridad: t.prioridad, meta_id: null });
  }
  return filas.length ? { filas } : { error: 'vacio' };
}
