// Distingue un error real de una consulta de un estado vacío.
// Sin esto, una consulta que falla devolvía data = null y la pantalla
// mostraba "sin datos", como si no hubiera nada guardado.
//
// Uso: verificar({ pendientes: respuestaPendientes, gastos: respuestaGastos })
// Si alguna respuesta trae error, lanza una excepción que muestra app/(app)/error.js.
export function verificar(respuestas) {
  for (const [nombre, r] of Object.entries(respuestas)) {
    if (r && r.error) {
      throw new Error(`No se pudo cargar "${nombre}": ${r.error.message}`);
    }
  }
}
