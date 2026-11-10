// Acciones rápidas de Home: escrituras REALES en las tablas existentes, con las mismas columnas que usan los módulos heredados.
// No toca esquema ni RLS (el usuario se asigna por defecto en la base con auth.uid()). Recibe el cliente de Supabase por parámetro.
import { CATEGORIAS } from '../format.js';

const texto = v => String(v ?? '').trim();
const entero = v => Math.round(Number(String(v ?? '').replace(/[^\d]/g, '')));
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Validaciones puras: devuelven { ok, error } con un mensaje claro, o { ok: true, valor } normalizado. */
export function validarPendiente({ texto: t, frente, fechaLimite }) {
  const x = texto(t);
  if (!x) return { ok: false, error: 'Escribe el pendiente.' };
  if (!frente) return { ok: false, error: 'Elige un frente.' };
  if (fechaLimite && !FECHA.test(fechaLimite)) return { ok: false, error: 'La fecha límite no es válida.' };
  return { ok: true, valor: { texto: x, frente, fecha_limite: fechaLimite || null } };
}

export function validarGasto({ fecha, lugar, categoria, valor, frente }) {
  const l = texto(lugar); const v = entero(valor);
  if (!l || !v) return { ok: false, error: 'Escribe el lugar y el valor.' };
  if (!FECHA.test(fecha ?? '')) return { ok: false, error: 'La fecha no es válida.' };
  if (!CATEGORIAS.includes(categoria)) return { ok: false, error: 'Elige una categoría.' };
  if (!frente) return { ok: false, error: 'Elige un frente.' };
  return { ok: true, valor: { fecha, lugar: l, categoria, valor_cop: v, frente } };
}

export function validarNota({ titulo, contenido, frente, etiquetas = [] }) {
  const t = texto(titulo);
  if (!t) return { ok: false, error: 'Ponle un título a la nota.' };
  if (!frente) return { ok: false, error: 'Elige un frente.' };
  const tags = [...new Set(etiquetas.map(e => texto(e).toLowerCase().replace(/^#/, '')).filter(Boolean))];
  return { ok: true, valor: { titulo: t, contenido: texto(contenido) || null, etiquetas: tags, frente } };
}

export function validarIdea({ texto: t, frente }) {
  const x = texto(t);
  if (!x) return { ok: false, error: 'Escribe la idea.' };
  if (!frente) return { ok: false, error: 'Elige un frente.' };
  const titulo = x.length > 70 ? `${x.slice(0, 67).trimEnd()}…` : x;
  return { ok: true, valor: { titulo, contenido: x.length > 70 ? x : null, etiquetas: ['idea'], frente } };
}

async function una(consulta) {
  const r = await consulta;
  if (r.error) throw r.error;
  return r.data;
}

export const crearPendiente = (supabase, v) => una(supabase.from('pendientes').insert({ texto: v.texto, frente: v.frente, fecha_limite: v.fecha_limite, meta_id: null }).select().single());

/** Marca o desmarca un pendiente igual que el módulo heredado: `hecho` y `hecho_en` (marca de tiempo al completar). */
export const alternarPendiente = (supabase, item, ahora = () => new Date().toISOString()) =>
  una(supabase.from('pendientes').update({ hecho: !item.hecho, hecho_en: !item.hecho ? ahora() : null }).eq('id', item.id).select().single());

export const registrarGasto = (supabase, v) => una(supabase.from('gastos').insert({ fecha: v.fecha, lugar: v.lugar, categoria: v.categoria, valor_cop: v.valor_cop, frente: v.frente }).select().single());

export const crearNota = (supabase, v, ahora = () => new Date().toISOString()) =>
  una(supabase.from('notas').insert({ titulo: v.titulo, contenido: v.contenido, etiquetas: v.etiquetas, frente: v.frente, actualizado_en: ahora() }).select().single());
