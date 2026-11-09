// Lógica de las barras de progreso. Pura, sin interfaz, con pruebas en tests/progreso.test.mjs.
//
// Regla central: un valor ausente o inválido es "sin datos", NUNCA 0 %.
// Mostrar 0 % cuando faltan datos sería inventar un resultado.

/**
 * @param {unknown} valor Fracción de 0 a 1, o null/undefined si no hay datos.
 * @returns {{ estado: 'ok' | 'sin-datos', fraccion: number | null, porcentaje: number | null }}
 */
export function normalizarProgreso(valor) {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    return { estado: 'sin-datos', fraccion: null, porcentaje: null };
  }
  const fraccion = Math.min(1, Math.max(0, valor));
  return { estado: 'ok', fraccion, porcentaje: Math.round(fraccion * 100) };
}

/** Texto para lectores de pantalla y para mostrar junto a la barra. */
export function textoProgreso(valor) {
  const p = normalizarProgreso(valor);
  return p.estado === 'ok' ? `${p.porcentaje} %` : 'Sin datos';
}
