// Bucle de conversación del asistente: llama al modelo con transmisión (streaming), ejecuta las herramientas de lectura que pida
// y vuelve a llamar hasta que responda. El cliente de Anthropic se INYECTA (en las pruebas es uno simulado, sin gastar nada).
// Solo lectura: ninguna herramienta escribe. Nunca registra ni devuelve tokens ni claves.

const MAX_REINTENTOS_JSON = 2;

const sumarUso = (a, u) => ({
  input_tokens: a.input_tokens + (u?.input_tokens ?? 0),
  output_tokens: a.output_tokens + (u?.output_tokens ?? 0),
  cache_creation_input_tokens: a.cache_creation_input_tokens + (u?.cache_creation_input_tokens ?? 0),
  cache_read_input_tokens: a.cache_read_input_tokens + (u?.cache_read_input_tokens ?? 0),
});

/** Un error de la API trae `status` numérico: se vuelve a lanzar (no se reintenta). Otro tipo de fallo es de conexión o de lectura. */
const esErrorDeApi = e => typeof e?.status === 'number';

/**
 * @param {object} p
 * @param {object} p.client        Cliente de Anthropic (o uno simulado con `messages.stream`)
 * @param {string} p.modelo
 * @param {Array}  p.sistema       Bloques de `system`
 * @param {Array}  p.mensajes      Historial en formato de la API (se copia; no se modifica)
 * @param {Array}  p.herramientas  Definiciones de herramientas
 * @param {Function} p.ejecutar    async (nombre, entrada) => { contenido, esError }
 * @param {Function} p.emitir      (evento) => void   eventos: estado, texto, rechazo, cortada
 * @param {object} [p.parametros]  Parámetros extra de la petición (por ejemplo output_config)
 * @returns {Promise<{ uso: object, iteraciones: number, mensajes: Array, terminacion: string }>}
 */
export async function conversar({ client, modelo, sistema, mensajes, herramientas, ejecutar, emitir, parametros = {}, maxIteraciones = 6, maxTokens = 2000 }) {
  const historial = [...mensajes];
  let uso = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };
  let reintentos = 0;
  emitir({ tipo: 'estado', estado: 'pensando' });

  for (let i = 0; i < maxIteraciones; i++) {
    const flujo = client.messages.stream({ model: modelo, max_tokens: maxTokens, system: sistema, tools: herramientas, messages: historial, ...parametros });
    flujo.on('text', delta => emitir({ tipo: 'texto', delta }));
    let mensaje;
    try {
      mensaje = await flujo.finalMessage();
      reintentos = 0;
    } catch (e) {
      if (esErrorDeApi(e) || reintentos++ >= MAX_REINTENTOS_JSON) { try { e.uso = uso; } catch { /* error inmutable */ } throw e; }
      continue;   // entrada de herramienta ilegible o conexión cortada: se repite el turno
    }
    uso = sumarUso(uso, mensaje.usage);

    if (mensaje.stop_reason === 'refusal') { emitir({ tipo: 'rechazo' }); return { uso, iteraciones: i + 1, mensajes: historial, terminacion: 'rechazo' }; }
    const usos = (mensaje.content ?? []).filter(b => b.type === 'tool_use');
    if (mensaje.stop_reason === 'max_tokens') { emitir({ tipo: 'cortada' }); return { uso, iteraciones: i + 1, mensajes: historial, terminacion: 'cortada' }; }
    if (mensaje.stop_reason !== 'tool_use' || usos.length === 0) return { uso, iteraciones: i + 1, mensajes: historial, terminacion: 'fin' };

    historial.push({ role: 'assistant', content: mensaje.content });
    const resultados = [];
    for (const u of usos) {
      emitir({ tipo: 'estado', estado: 'consultando', herramienta: u.name });
      const r = await ejecutar(u.name, u.input);
      resultados.push({ type: 'tool_result', tool_use_id: u.id, content: r.contenido, ...(r.esError ? { is_error: true } : {}) });
    }
    historial.push({ role: 'user', content: resultados });
    emitir({ tipo: 'estado', estado: 'pensando' });
  }
  emitir({ tipo: 'cortada' });
  return { uso, iteraciones: maxIteraciones, mensajes: historial, terminacion: 'limite_de_vueltas' };
}
