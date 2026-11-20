// Agenda de Home: eventos de Google Calendar sincronizados por la tarea programada. Lógica pura.
//
// Los eventos llegan a `agenda_hoy` con su calendario de origen. Cada calendario pertenece a un frente de diseño
// (tabla `calendarios_fuente`). Este módulo decide el estado HONESTO de la agenda:
//   'datos'          hay eventos de hoy
//   'sin_registros'  la sincronización es reciente y hoy no hay eventos (un día libre real; si falta alguna cuenta, se avisa)
//   'desactualizada' la última sincronización es vieja: NO se afirma que el día esté libre
//   'no_conectada'   ninguna fuente se ha sincronizado nunca
//   'error'          la lectura falló (nunca se convierte en vacío)

export const VIGENCIA_HORAS = 14; // la tarea corre a las 6:00, 12:00 y 17:00: el hueco más largo es de 13 h
export const FRENTES_VALIDOS = ['tanku', 'ticketcode', 'personal', 'salud', 'familia', 'otros'];
const TZ_OFFSET_BOGOTA = '-05:00'; // Colombia no tiene horario de verano

/** Frente de un calendario según la tabla de fuentes; null si no está o no tiene frente (queda «sin asignar»). */
export function frenteDeCalendario(fuentes, calendarioId) {
  const f = (fuentes ?? []).find(x => x.calendario_id === calendarioId);
  return f && FRENTES_VALIDOS.includes(f.frente_id) ? f.frente_id : null;
}

const fechaBogota = iso => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

/**
 * Convierte un evento de Google Calendar en una fila de `agenda_hoy`. Devuelve null si el evento no se puede usar.
 * Guarda solo título, hora y un detalle corto; nunca invitados ni enlaces de reunión.
 * @param {object} p
 * @param {object} p.evento  Evento de Calendar: { id, summary, description, start: {dateTime|date}, end: {dateTime|date} }
 * @param {string} p.calendarioId
 * @param {Array}  p.fuentes  Filas de calendarios_fuente
 * @param {string} p.ahoraIso
 */
export function normalizarEvento({ evento, calendarioId, fuentes, ahoraIso }) {
  if (!evento || !evento.id || !evento.start) return null;
  const inicio = evento.start.dateTime ?? (evento.start.date ? `${evento.start.date}T00:00:00${TZ_OFFSET_BOGOTA}` : null);
  if (!inicio || Number.isNaN(new Date(inicio).getTime())) return null;
  const fin = evento.end?.dateTime ?? (evento.end?.date ? `${evento.end.date}T00:00:00${TZ_OFFSET_BOGOTA}` : null);
  const detalle = (evento.description ?? '').replace(/\s+/g, ' ').trim().slice(0, 200) || null;
  return {
    fecha: fechaBogota(inicio),
    inicio,
    fin: fin && !Number.isNaN(new Date(fin).getTime()) ? fin : null,
    titulo: (evento.summary ?? '').trim() || '(sin título)',
    detalle,
    calendario_id: calendarioId,
    frente_id: frenteDeCalendario(fuentes, calendarioId),
    origen_id: String(evento.id),
    sincronizado_en: ahoraIso,
  };
}

/** «hace 5 min», «hace 2 h», «hace 1 día». */
export function haceCuanto(desdeIso, ahoraMs) {
  const min = Math.max(0, Math.round((ahoraMs - new Date(desdeIso).getTime()) / 60000));
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
}

/**
 * Estado de la agenda de hoy.
 * @param {object} p
 * @param {Array|null} p.filas     Eventos de hoy (null si la lectura falló)
 * @param {Array|null} p.fuentes   Filas de calendarios_fuente (null si no se pudo leer o la tabla aún no existe)
 * @param {any} [p.error]          Error de lectura de los eventos
 * @param {number} p.ahoraMs
 */
export function estadoAgenda({ filas, fuentes, error = null, ahoraMs, vigenciaH = VIGENCIA_HORAS }) {
  if (error) return { estado: 'error', ultima: null, pendientes: [], conError: [], sincronizadas: [] };
  const hay = Array.isArray(filas) && filas.length > 0;
  const lista = Array.isArray(fuentes) ? fuentes : [];
  const activas = lista.filter(f => f.estado === 'activa');
  const sincronizadas = activas.filter(f => f.ultima_sincronizacion);
  const pendientes = lista.filter(f => f.estado === 'pendiente').map(f => f.nombre);
  const conError = activas.filter(f => f.ultimo_error).map(f => f.nombre);
  const ultima = sincronizadas.reduce((m, f) => (!m || f.ultima_sincronizacion > m ? f.ultima_sincronizacion : m), null);
  const base = { ultima, pendientes, conError, sincronizadas: sincronizadas.map(f => f.nombre) };
  // Las filas prueban que algo escribe; sin ninguna sincronización registrada, el vacío no significa nada.
  if (!ultima) return { ...base, estado: hay ? 'datos' : 'no_conectada' };
  const vencida = ahoraMs - new Date(ultima).getTime() > vigenciaH * 3600000;
  if (hay) return { ...base, estado: 'datos', vencida };
  return { ...base, estado: vencida ? 'desactualizada' : 'sin_registros', vencida };
}

/**
 * ¿Hay que descartar este evento de Google Calendar? Sí si está cancelado o si el propio usuario lo rechazó.
 * No mira a los demás invitados.
 */
export function descartarEvento(evento) {
  if (!evento || evento.status === 'cancelled') return true;
  return (evento.attendees ?? []).some(a => a?.self === true && a?.responseStatus === 'declined');
}

/** ¿Es un evento de todo el día? Empieza a las 00:00 de Bogotá y dura un número exacto de días. */
export function esTodoElDia(e) {
  if (!e?.inicio || !e?.fin) return false;
  const ini = new Date(e.inicio).getTime();
  const dur = new Date(e.fin).getTime() - ini;
  const horaBogota = new Date(ini).toLocaleTimeString('en-GB', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: false });
  return horaBogota === '00:00' && dur > 0 && dur % 86400000 === 0;
}

/**
 * ¿El error de lectura de `calendarios_fuente` significa solo que la tabla todavía no existe (migración sin aplicar)?
 * En ese caso la agenda se muestra como «no conectada», no como error. Cualquier otro error sigue siendo error.
 */
export function tablaFuentesInexistente(error) {
  const c = String(error?.code ?? '');
  return c === '42P01' || c === 'PGRST205';
}

/** Eventos de hoy ordenados por hora y limitados al frente activo (null = todos). */
export function eventosDeHoy(filas, frenteId = null) {
  return [...(filas ?? [])]
    .filter(e => !frenteId || e.frente_id === frenteId)
    .sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime());
}
