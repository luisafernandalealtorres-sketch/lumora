// Privacidad del asistente: qué frentes NO se le muestran a la IA. Lógica pura.
//
// Lo que una herramienta devuelve viaja a Anthropic para que el modelo pueda responder. Los datos de la salud de la abuela
// son de otra persona, así que por defecto quedan fuera. Se puede cambiar con la variable ASISTENTE_FRENTES_EXCLUIDOS
// (lista de slugs separados por coma; vacía = no excluir ninguno).

export const FRENTES_EXCLUIDOS_POR_DEFECTO = ['salud-abuela'];

/** Lista de slugs excluidos. `valor` es el contenido de la variable de entorno (undefined = usar la lista por defecto). */
export function frentesExcluidos(valor) {
  if (valor === undefined || valor === null) return [...FRENTES_EXCLUIDOS_POR_DEFECTO];
  return String(valor).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

/** ¿Se puede mostrar al asistente algo de este frente? Un registro sin frente siempre se puede mostrar. */
export function frentePermitido(slug, excluidos) {
  if (!slug) return true;
  return !(excluidos ?? []).includes(String(slug).toLowerCase());
}

/** Quita las filas de frentes excluidos. No modifica el arreglo recibido. */
export function sinFrentesExcluidos(filas, excluidos, campo = 'frente') {
  return (filas ?? []).filter(f => frentePermitido(f?.[campo], excluidos));
}
