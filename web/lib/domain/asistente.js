// Estados del asistente. Puro.
// En la Fase 2 el asistente NO está conectado: en el shell solo se alcanza
// 'no-conectado'. Los demás estados existen para el laboratorio y para cuando se conecte.

export const ESTADOS_ASISTENTE = {
  'no-conectado': { etiqueta: 'No conectado', descripcion: 'Falta la clave de la IA en el servidor.', permiteEnviar: false, tono: 'neutral' },
  disponible: { etiqueta: 'Disponible', descripcion: 'Listo para ayudarte.', permiteEnviar: true, tono: 'success' },
  pensando: { etiqueta: 'Pensando', descripcion: 'Preparando una respuesta.', permiteEnviar: false, tono: 'info' },
  consultando: { etiqueta: 'Consultando información', descripcion: 'Leyendo tus datos para responder.', permiteEnviar: false, tono: 'info' },
  'esperando-aprobacion': { etiqueta: 'Esperando tu aprobación', descripcion: 'Necesita tu confirmación antes de actuar.', permiteEnviar: false, tono: 'warning' },
  ejecutando: { etiqueta: 'Ejecutando acción', descripcion: 'Aplicando el cambio aprobado.', permiteEnviar: false, tono: 'info' },
  completado: { etiqueta: 'Completado', descripcion: 'Acción terminada.', permiteEnviar: true, tono: 'success' },
  error: { etiqueta: 'Error', descripcion: 'Algo falló. Puedes reintentar.', permiteEnviar: true, tono: 'danger' },
};

export const IDS_ESTADOS = Object.keys(ESTADOS_ASISTENTE);
export const ESTADO_INICIAL = 'no-conectado';

/** Estado completo; uno desconocido se trata como error, nunca como disponible. */
export function estadoAsistente(id) {
  return ESTADOS_ASISTENTE[id] ?? ESTADOS_ASISTENTE.error;
}

export function puedeEnviar(id) {
  return !!ESTADOS_ASISTENTE[id]?.permiteEnviar;
}

/** Lo que todavía NO hace (se marca como pendiente en la interfaz). */
export const FUTURO_ASISTENTE = [
  'Crear o cambiar pendientes, gastos y eventos con tu aprobación',
  'Leer y redactar correos',
];

/** Mensajes para cada código de error del servidor (nunca se muestra el texto original). */
export const MENSAJES_ERROR = {
  sin_sesion: 'Tu sesión expiró. Vuelve a entrar.',
  sin_configurar: 'El asistente no está conectado todavía: falta la clave de la IA en el servidor.',
  sin_presupuesto: 'No pude comprobar cuánto has gastado este mes, así que no consulto a la IA.',
  sin_tope: 'El tope mensual no está configurado, así que no consulto a la IA.',
  tope_alcanzado: 'Llegaste al tope de gasto del mes. Vuelve a abrirse el mes que viene o sube el tope.',
  credenciales: 'La clave de la IA no fue aceptada. Hay que revisarla en el servidor.',
  limite: 'La IA está recibiendo muchas peticiones. Intenta en un minuto.',
  solicitud: 'No pude procesar ese mensaje. Intenta con otro.',
  servicio: 'El servicio de la IA tuvo un problema. Intenta de nuevo.',
  conexion: 'Se cortó la conexión. Intenta de nuevo.',
  interno: 'Algo falló de mi lado. Intenta de nuevo.',
};

export const mensajeDeError = codigo => MENSAJES_ERROR[codigo] ?? MENSAJES_ERROR.interno;

/** Estado de la pantalla para un código de error: sin clave = "no conectado"; el resto, "error". */
export const estadoDeError = codigo => (codigo === 'sin_configurar' ? 'no-conectado' : 'error');

/** Parte un texto recibido por trozos en líneas JSON completas. Devuelve { eventos, resto }; las líneas rotas se descartan. */
export function leerEventos(buffer) {
  const lineas = buffer.split('\n');
  const resto = lineas.pop();
  const eventos = [];
  for (const l of lineas) {
    if (!l.trim()) continue;
    try { const e = JSON.parse(l); if (e && typeof e.tipo === 'string') eventos.push(e); } catch { /* línea ilegible */ }
  }
  return { eventos, resto };
}

const NOMBRES_HERRAMIENTAS = {
  resumen_del_dia: 'tu día', consultar_pendientes: 'tus pendientes', consultar_agenda: 'tu agenda', consultar_gastos: 'tus gastos',
  consultar_metas: 'tus metas', buscar_notas: 'tus notas', consultar_jornada: 'tu jornada',
};

/** Negritas **así** dentro de una línea → [{ texto, negrita }]. Un ** sin cerrar queda como texto normal. */
export function partirNegritas(linea) {
  const partes = [];
  let resto = linea;
  for (;;) {
    const a = resto.indexOf('**');
    const b = a === -1 ? -1 : resto.indexOf('**', a + 2);
    if (a === -1 || b === -1 || b === a + 2) { if (resto) partes.push({ texto: resto, negrita: false }); break; }
    if (a > 0) partes.push({ texto: resto.slice(0, a), negrita: false });
    partes.push({ texto: resto.slice(a + 2, b), negrita: true });
    resto = resto.slice(b + 2);
  }
  return partes;
}

/**
 * Formato mínimo y seguro de la respuesta: párrafos, listas ("- " o "* " o "1. ") y negritas.
 * Devuelve bloques { tipo: 'p' | 'ul' | 'ol', items: [partes[]] }; nunca HTML (React escapa el texto).
 */
export function bloquesDeTexto(texto) {
  const bloques = [];
  let parrafo = [];
  const cerrarParrafo = () => { if (parrafo.length) { bloques.push({ tipo: 'p', items: [partirNegritas(parrafo.join(' '))] }); parrafo = []; } };
  for (const crudo of String(texto ?? '').split('\n')) {
    const linea = crudo.replace(/^#{1,6}\s+/, '').trim();
    const vineta = /^[-*•]\s+(.*)$/.exec(linea);
    const numero = /^\d+[.)]\s+(.*)$/.exec(linea);
    if (!linea) { cerrarParrafo(); continue; }
    if (vineta || numero) {
      cerrarParrafo();
      const tipo = vineta ? 'ul' : 'ol';
      const item = partirNegritas((vineta ?? numero)[1]);
      const ultimo = bloques.at(-1);
      if (ultimo?.tipo === tipo) ultimo.items.push(item); else bloques.push({ tipo, items: [item] });
    } else parrafo.push(linea);
  }
  cerrarParrafo();
  return bloques;
}

/** Texto de estado mientras consulta ("Mirando tus pendientes…"). */
export const textoConsulta = herramienta => `Mirando ${NOMBRES_HERRAMIENTAS[herramienta] ?? 'tus datos'}…`;

/** Cuánto va del tope, en texto corto; vacío si no hay aviso. */
export function textoPresupuesto(p) {
  if (!p?.aviso) return '';
  return `Llevas el ${Math.round(p.porcentaje * 100)} % del tope del mes.`;
}
