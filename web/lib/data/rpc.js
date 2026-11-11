// Utilidades compartidas de la capa de datos: identidad del dispositivo, lecturas y llamadas RPC idempotentes.
// Cada operación lleva op_id único, dispositivo y secuencia creciente: reintentar la misma operación es idempotente en el servidor.
// La cola sin conexión vive en lib/cola/cola.js (solo registros manuales de hábitos; T-9 y la reconciliación entre dispositivos siguen pendientes).

const CLAVE_DISPOSITIVO = 'sb-dispositivo-v1';

export function uuidAleatorio() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  const b = new Uint8Array(16);
  globalThis.crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * Identidad del dispositivo: un id estable y una secuencia estrictamente creciente.
 * - Se guarda en el almacén recibido (localStorage). Si no hay almacén, el id vive solo en memoria
 *   (un id nuevo por carga de página, así la secuencia nunca puede chocar tras recargar).
 * - La secuencia es max(anterior + 1, milisegundos actuales): creciente aunque se abran varias pestañas.
 */
export function crearIdentidadDispositivo({ almacen = null, uuid = uuidAleatorio, ahora = () => Date.now() } = {}) {
  let id = null;
  let ultima = 0;
  const leer = () => {
    try { const v = almacen?.getItem(CLAVE_DISPOSITIVO); return v ? JSON.parse(v) : null; } catch { return null; }
  };
  const guardar = () => {
    try { almacen?.setItem(CLAVE_DISPOSITIVO, JSON.stringify({ id, seq: ultima })); } catch { /* sin almacenamiento */ }
  };
  const previo = leer();
  if (previo && typeof previo.id === 'string' && Number.isFinite(previo.seq)) { id = previo.id; ultima = previo.seq; }
  else { id = uuid(); guardar(); }
  return {
    get dispositivoId() { return id; },
    siguienteSeq() {
      const actual = leer();
      if (actual && actual.id === id && Number.isFinite(actual.seq) && actual.seq > ultima) ultima = actual.seq;
      ultima = Math.max(ultima + 1, ahora());
      guardar();
      return ultima;
    },
  };
}

export const unica = async (consulta) => {
  const r = await consulta;
  if (r.error) throw r.error;
  return r.data ?? null;
};


/** Devuelve rpc(nombre, args, opId?) que añade p_op_id, p_dispositivo_id y p_seq; reintenta una vez un choque de secuencia (23505) con la misma op_id. */
export function crearLlamadorRpc(supabase, ident, uuid = uuidAleatorio) {
  return async function rpc(nombre, args = {}, opId = uuid()) {
    const intentar = () => supabase.rpc(nombre, { p_op_id: opId, p_dispositivo_id: ident.dispositivoId, p_seq: ident.siguienteSeq(), ...args });
    let r = await intentar();
    if (r.error && r.error.code === '23505' && /operaciones/.test(`${r.error.message} ${r.error.details ?? ''}`)) r = await intentar();
    if (r.error) throw r.error;
    return r.data;
  };
}

/**
 * Lee TODAS las filas de una consulta en páginas (PostgREST limita cada respuesta, normalmente a 1000 filas).
 * `construir()` debe devolver una consulta NUEVA con orden estable; aquí se le añade `.range(desde, hasta)`.
 */
export async function leerPaginado(construir, tamano = 1000) {
  const todas = [];
  for (let desde = 0; ; desde += tamano) {
    const pagina = await unica(construir().range(desde, desde + tamano - 1));
    todas.push(...(pagina ?? []));
    if (!pagina || pagina.length < tamano) return todas;
  }
}
