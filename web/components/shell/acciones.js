// Acciones del shell que YA están disponibles. Un elemento de navegación con `accion`
// (p. ej. el asistente) solo se muestra si su acción está aquí; así no hay botones muertos.
export const ACCIONES_DISPONIBLES = new Set([]);

export function visibleEnShell(elemento) {
  return !elemento.accion || ACCIONES_DISPONIBLES.has(elemento.accion);
}
