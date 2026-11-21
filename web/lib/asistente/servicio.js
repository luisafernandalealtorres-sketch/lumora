// Servicio del asistente: une la seguridad, el tope de gasto, la memoria, el mensaje de sistema, las herramientas y el bucle.
// Todo lo externo se INYECTA (supabase con la sesión de Luisa, cliente de Anthropic, reloj, emisor de eventos), así que las
// pruebas lo ejercitan sin red ni gasto. Nunca registra ni devuelve claves ni tokens.
import { conversar } from './bucle.js';
import { HERRAMIENTAS, ejecutarHerramienta } from './herramientas.js';
import { construirSistema } from './prompt.js';
import { frentesExcluidos } from './privacidad.js';
import { costoUsd, estadoPresupuesto, parametrosDelModelo, MODELO_POR_DEFECTO } from './costo.js';

export const LIMITE_HISTORIAL = 20;      // mensajes que se envían como contexto de la conversación
export const MAX_CARACTERES = 4000;      // por mensaje

/** Valida el historial que manda el navegador: solo texto, roles user/assistant, el último del usuario. */
export function validarMensajes(entrada) {
  if (!Array.isArray(entrada) || entrada.length === 0) return { ok: false, codigo: 'solicitud' };
  const limpios = [];
  for (const m of entrada.slice(-LIMITE_HISTORIAL)) {
    if (!m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string') return { ok: false, codigo: 'solicitud' };
    const content = m.content.trim().slice(0, MAX_CARACTERES);
    if (content) limpios.push({ role: m.role, content });
  }
  while (limpios.length && limpios[0].role !== 'user') limpios.shift();
  if (!limpios.length || limpios.at(-1).role !== 'user') return { ok: false, codigo: 'solicitud' };
  return { ok: true, mensajes: limpios };
}

/** Código corto y seguro para el navegador a partir de un error de la API (nunca el mensaje original). */
export function codigoDeError(e) {
  const s = e?.status;
  if (s === 401 || s === 403) return 'credenciales';
  if (s === 429) return 'limite';
  if (s === 400 || s === 404 || s === 413) return 'solicitud';
  if (typeof s === 'number' && s >= 500) return 'servicio';
  return 'conexion';
}

const hoyBogota = ahora => new Date(ahora).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

/**
 * @param {object} p
 * @param {object} p.supabase   Cliente con la sesión del usuario (la seguridad por filas aplica)
 * @param {object|null} p.cliente  Cliente de Anthropic; null si no hay clave configurada
 * @param {object} p.entorno    { modelo, topeUsd, esfuerzo, frentesExcluidos }
 * @param {Array}  p.mensajes   Historial validado
 * @param {object} p.contexto   { ruta, frente }
 * @param {number} p.ahora
 * @param {Function} p.emitir
 * @returns {Promise<{ ok: boolean, codigo?: string, costoUsd?: number }>}
 */
export async function atender({ supabase, cliente, entorno = {}, mensajes, contexto = {}, ahora, emitir }) {
  if (!cliente) return { ok: false, codigo: 'sin_configurar' };
  const modelo = entorno.modelo || MODELO_POR_DEFECTO;

  // 1) Tope de gasto: sin poder medir el gasto, no se llama a la API.
  const { data: gastado, error: errGasto } = await supabase.rpc('asistente_gasto_mes');
  if (errGasto || gastado === null || gastado === undefined) return { ok: false, codigo: 'sin_presupuesto' };
  const presupuesto = estadoPresupuesto({ gastadoUsd: gastado, topeUsd: entorno.topeUsd });
  if (!presupuesto.ok) return { ok: false, codigo: presupuesto.motivo };

  // 2) Memoria aprobada y nombres de frentes (si la lectura falla, se sigue sin ellos).
  const [mem, fr] = await Promise.all([
    supabase.from('asistente_memoria').select('texto').order('creado_en', { ascending: true }).limit(50),
    supabase.from('frentes').select('slug,nombre'),
  ]);
  const nombres = new Map((fr.data ?? []).map(f => [f.slug, f.nombre]));
  const ctx = {
    supabase, hoy: hoyBogota(ahora), ahoraMs: ahora, excluidos: frentesExcluidos(entorno.frentesExcluidos),
    nombreFrente: slug => (slug ? nombres.get(slug) ?? slug : 'Sin frente'), emitir,
  };

  // 3) Conversar. El uso se registra siempre, aun si la conversación falla a mitad.
  let uso = null, fallo = null;
  try {
    const r = await conversar({
      client: cliente, modelo, mensajes, herramientas: HERRAMIENTAS, emitir,
      sistema: construirSistema({ memoria: mem.data ?? [], contexto, ahora }),
      parametros: parametrosDelModelo(modelo, entorno.esfuerzo),
      ejecutar: (nombre, entrada) => ejecutarHerramienta(nombre, entrada, ctx),
    });
    uso = r.uso;
  } catch (e) {
    uso = e?.uso ?? null;
    fallo = e;
  }

  let costo = 0;
  if (uso) {
    costo = costoUsd(modelo, uso);
    const { error } = await supabase.from('asistente_uso').insert({
      modelo, entrada: uso.input_tokens, salida: uso.output_tokens, cache_lectura: uso.cache_read_input_tokens,
      cache_escritura: uso.cache_creation_input_tokens, costo_usd: Number(costo.toFixed(6)),
    });
    if (error) emitir({ tipo: 'aviso', codigo: 'uso_no_registrado' });
  }
  if (fallo) return { ok: false, codigo: codigoDeError(fallo), costoUsd: costo };

  const despues = estadoPresupuesto({ gastadoUsd: Number(gastado) + costo, topeUsd: entorno.topeUsd });
  emitir({ tipo: 'fin', costoUsd: Number(costo.toFixed(6)), presupuesto: { porcentaje: despues.porcentaje, aviso: despues.aviso, restanteUsd: Number(despues.restanteUsd.toFixed(4)) } });
  return { ok: true, costoUsd: costo };
}
