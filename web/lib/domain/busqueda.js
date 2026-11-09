// Búsqueda de navegación y acciones (sin consultar datos). Pura.
// La búsqueda de contenido (notas, gastos, pendientes) queda para la Fase 5.

/** Minúsculas, sin acentos, sin signos y con espacios simples. */
export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Puntúa un candidato { nombre, claves? } contra una consulta.
 * 0 = no coincide. Mayor = mejor: nombre exacto > prefijo > palabra > contiene > clave.
 */
export function puntuar(candidato, consulta) {
  const q = normalizar(consulta);
  if (!q) return 1;
  const nombre = normalizar(candidato.nombre);
  if (nombre === q) return 100;
  if (nombre.startsWith(q)) return 80;
  if (nombre.split(' ').some(p => p.startsWith(q))) return 60;
  if (nombre.includes(q)) return 40;
  const claves = (candidato.claves ?? []).map(normalizar);
  if (claves.some(c => c === q)) return 30;
  if (claves.some(c => c.startsWith(q))) return 20;
  if (claves.some(c => c.includes(q))) return 10;
  return 0;
}

/** Filtra y ordena candidatos por puntaje (estable: conserva el orden original en empates). */
export function buscar(candidatos, consulta) {
  return candidatos
    .map((c, i) => ({ c, i, p: puntuar(c, consulta) }))
    .filter(x => x.p > 0)
    .sort((a, b) => b.p - a.p || a.i - b.i)
    .map(x => x.c);
}
