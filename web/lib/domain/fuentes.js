// Fuentes de datos de Home y su estado honesto (P10). Lógica pura.
//
// Una consulta vacía NO significa «no hay eventos» si nadie escribe en esa tabla: la tabla existe, pero la fuente
// nunca se conectó. Mostrar «Sin eventos» sería afirmar algo que no se verificó. Este módulo distingue:
//   'datos'        hay filas (prueba de que algo escribe en la fuente)
//   'sin_registros' la fuente SÍ está conectada y hoy no trajo nada (un día libre real)
//   'no_conectada' la fuente no tiene escritor: el vacío no significa nada
//   'error'        la lectura falló (nunca se convierte en vacío)
//
// La bandera `conectada` es una afirmación verificada del estado del proyecto (AUDITORIA-3.0 H7, revisada el 10 nov 2026):
// ninguna tarea programada ni función de la aplicación escribe en estas tablas (las tareas `tablero-mi-dia` y
// `recordatorio-jornada` solo editan mi-dia/tablero.html y jornada/*.md). Cuando se decida quién las alimenta,
// se cambia aquí `conectada` a true; no antes.

export const FUENTES_HOME = {
  agenda: {
    id: 'agenda', nombre: 'Agenda de hoy', tabla: 'agenda_hoy', conectada: false,
    motivo: 'Nada escribe en la agenda de la aplicación: la agenda de Google Calendar solo llega al tablero estático «mi-dia/tablero.html».',
    vacio: 'Sin eventos hoy.',
  },
  correos: {
    id: 'correos', nombre: 'Correos para revisar', tabla: 'correos_hoy', conectada: false,
    motivo: 'Nada escribe los correos en la aplicación: solo llegan al tablero estático «mi-dia/tablero.html».',
    vacio: 'Sin correos por revisar.',
  },
  resumen: {
    id: 'resumen', nombre: 'Resumen del día', tabla: 'resumen_dia', conectada: false,
    motivo: 'Ninguna tarea escribe el resumen en la aplicación: la tarea de las 6:00 a. m. solo actualiza «mi-dia/tablero.html».',
    vacio: 'Aún no hay resumen de hoy.',
  },
};

export const TEXTO_NO_CONECTADA = 'Fuente no conectada';

/**
 * Estado de una fuente a partir de lo que devolvió su consulta.
 * @param {object} p
 * @param {object} p.fuente  Una entrada de FUENTES_HOME.
 * @param {Array|object|null} p.filas  Resultado de la consulta (arreglo, fila única o null).
 * @param {any} [p.error]    Error de la consulta, si hubo.
 */
export function estadoFuente({ fuente, filas, error = null }) {
  if (error) return { estado: 'error', fuente };
  const hay = Array.isArray(filas) ? filas.length > 0 : filas !== null && filas !== undefined;
  if (hay) return { estado: 'datos', fuente };
  return { estado: fuente.conectada ? 'sin_registros' : 'no_conectada', fuente };
}

/** Mensaje para mostrar cuando no hay datos: el vacío real solo se afirma si la fuente está conectada. */
export function mensajeVacio(estado) {
  if (estado.estado === 'no_conectada') return { titulo: TEXTO_NO_CONECTADA, detalle: estado.fuente.motivo };
  if (estado.estado === 'sin_registros') return { titulo: estado.fuente.vacio, detalle: null };
  return null;
}
