// Estados del asistente. Puro.
// En la Fase 2 el asistente NO está conectado: en el shell solo se alcanza
// 'no-conectado'. Los demás estados existen para el laboratorio y para cuando se conecte.

export const ESTADOS_ASISTENTE = {
  'no-conectado': { etiqueta: 'No conectado', descripcion: 'La conexión con la IA llegará en otra fase.', permiteEnviar: false, tono: 'neutral' },
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

/** Lo que el asistente hará cuando se conecte. Marcado como pendiente en la interfaz. */
export const FUTURO_ASISTENTE = [
  'Chat con el contexto de la pantalla donde estás',
  'Memoria de tus frentes y decisiones',
  'Análisis sobre tus metas, gastos y hábitos',
  'Automatizaciones con tu aprobación previa',
];
