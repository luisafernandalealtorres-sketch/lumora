// Estados de datos de Home. Cinco estados DISTINTOS (aprobado el 10 nov 2026); nunca se mezclan ni se disfrazan de cero.
//
//  datos            hay información para mostrar
//  sin_datos        el indicador no se puede calcular (faltan datos de base, p. ej. un avance sin pendientes)
//  sin_registros    la fuente está conectada y se leyó bien, pero no hay registros en el período
//  no_conectada     la fuente no tiene quién la alimente: un vacío no significa nada
//  error_lectura    la lectura falló: no se sabe qué hay (nunca se convierte en vacío)
//  fase3_no_activada la base de datos aún no tiene las tablas de la Fase 3
export const ESTADOS_HOME = ['datos', 'sin_datos', 'sin_registros', 'no_conectada', 'error_lectura', 'fase3_no_activada'];

export const TEXTO_ESTADO = {
  sin_datos: { titulo: 'Sin datos', detalle: 'Todavía no hay información suficiente para calcularlo.', tono: 'neutro', icono: 'info' },
  sin_registros: { titulo: 'Sin registros', detalle: 'La fuente funciona y todavía no tiene registros en este período.', tono: 'neutro', icono: 'info' },
  no_conectada: { titulo: 'Fuente no conectada', detalle: 'Nada alimenta esta fuente en la aplicación: un vacío no significa que no haya nada.', tono: 'advertencia', icono: 'alert' },
  error_lectura: { titulo: 'Error de lectura', detalle: 'No se pudo leer esta fuente. No significa que esté vacía.', tono: 'peligro', icono: 'alert' },
  fase3_no_activada: { titulo: 'Fase 3 aún no activada', corto: 'Se activa con la migración v1.11.', detalle: 'La base de datos todavía no tiene las tablas de la Fase 3 (requiere aplicar la migración v1.11 con tu autorización).', tono: 'advertencia', icono: 'alert' },
};

/** Resultado de una consulta de Supabase → { ok, data, error }. Un error nunca devuelve datos. */
export function leerFuente(respuesta) {
  if (!respuesta) return { ok: false, data: null, error: { message: 'sin respuesta' } };
  if (respuesta.error) return { ok: false, data: null, error: respuesta.error };
  return { ok: true, data: respuesta.data ?? null, error: null };
}

/** Estado de una lista leída: error_lectura, sin_registros o datos. */
export function estadoDeLista(fuente) {
  if (!fuente.ok) return 'error_lectura';
  return Array.isArray(fuente.data) && fuente.data.length > 0 ? 'datos' : 'sin_registros';
}

/** Explicación general de la Fase 3 (se muestra UNA vez; cada módulo conserva solo su estado corto). */
export const EXPLICACION_FASE3 = 'Focus, Life Pulse y la atención por frente usan las tablas de la Fase 3, que todavía no existen en tu base de datos. Se activan al aplicar la migración v1.11, que requiere tu autorización. Mientras tanto cada módulo lo indica y no muestra valores.';
