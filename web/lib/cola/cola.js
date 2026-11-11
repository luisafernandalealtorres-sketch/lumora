// Cola de operaciones sin conexión (etapa 4, parte de cliente; diseño §10 de DISENO-TECNICO-FASE-3-v1.11.1).
// Alcance deliberado:
//  - Solo se encolan los registros manuales de hábitos (D3-13). No se inician temporizadores sin conexión.
//  - Al reenviar se usan las mismas RPC idempotentes (mismo op_id, dispositivo y seq): repetir un envío no duplica nada.
//  - Se envían en orden de seq. Un fallo de red o de sesión detiene el envío y conserva todo; un rechazo del servidor
//    se CONSERVA como «rechazada» con su motivo (nada se descarta en silencio) y se sigue con la siguiente.
//  - NO implementa umbrales de reloj ni resolución de concurrencia entre dispositivos (T-9 sigue pendiente) ni
//    `operaciones_aplicar` (no hay cambios en Supabase). El orden es el de seq de cada dispositivo.

/** ¿El error es de red o de sesión (reintentable) y no un rechazo del servidor? */
export function esErrorReintentable(e) {
  if (!e) return false;
  const msg = `${e.message ?? ''}`;
  if (e.status === 401 || e.code === 'PGRST301' || /jwt expired/i.test(msg)) return true;
  if (e.code) return false;                          // el servidor respondió con un código SQL/PostgREST: es un rechazo
  return e.name === 'TypeError' || /fetch|network|load failed|offline|timeout/i.test(msg);
}

/**
 * @param {object} p
 * @param {{ todas(): Promise<object[]>, guardar(op: object): Promise<void>, borrar(opId: string): Promise<void> }} p.almacen
 * @param {(op: object) => Promise<any>} p.enviar  Reenvía una operación (misma op_id) y lanza el error de la RPC si falla.
 * @param {() => boolean} [p.enLinea]
 * @param {() => number} [p.ahora]
 */
export function crearCola({ almacen, enviar, enLinea = () => true, ahora = () => Date.now() }) {
  let enCurso = null;

  const ordenadas = async () => (await almacen.todas()).sort((a, b) => a.seq - b.seq);

  async function encolar({ opId, dispositivoId, seq, tipo, rpc, args }) {
    const op = { op_id: opId, dispositivo_id: dispositivoId, seq, tipo, rpc, args, creada_en: ahora(), estado: 'pendiente', motivo: null, intentos: 0 };
    await almacen.guardar(op);
    return op;
  }

  async function enviarPendientes() {
    if (enCurso) return enCurso;                     // un solo envío a la vez
    enCurso = (async () => {
      const r = { enviadas: 0, rechazadas: 0, pendientes: 0, detenida: null };
      if (!enLinea()) { r.detenida = 'sin_conexion'; r.pendientes = (await ordenadas()).filter(o => o.estado === 'pendiente').length; return r; }
      for (const op of await ordenadas()) {
        if (op.estado !== 'pendiente') continue;
        try {
          await enviar(op);
          await almacen.borrar(op.op_id);
          r.enviadas++;
        } catch (e) {
          if (esErrorReintentable(e)) { r.detenida = 'reintentable'; break; }
          await almacen.guardar({ ...op, estado: 'rechazada', motivo: e?.message ?? String(e), codigo: e?.code ?? null, intentos: op.intentos + 1, rechazada_en: ahora() });
          r.rechazadas++;
        }
      }
      r.pendientes = (await ordenadas()).filter(o => o.estado === 'pendiente').length;
      return r;
    })().finally(() => { enCurso = null; });
    return enCurso;
  }

  return {
    encolar,
    enviarPendientes,
    pendientes: async () => (await ordenadas()).filter(o => o.estado === 'pendiente'),
    rechazadas: async () => (await ordenadas()).filter(o => o.estado === 'rechazada'),
    /** El usuario ya vio una operación rechazada: se quita de la lista (decisión explícita, no automática). */
    descartarRechazada: async opId => {
      const op = (await almacen.todas()).find(o => o.op_id === opId);
      if (op && op.estado === 'rechazada') await almacen.borrar(opId);
    },
  };
}

/** Almacén que resuelve el usuario al primer uso (la base es `cola-<userId>`: un usuario distinto nunca ve la cola de otro). */
export function almacenPorUsuario(obtenerUserId, fabrica = almacenIndexedDB) {
  let real = null;
  const abrir = async () => {
    if (real) return real;
    const id = await obtenerUserId();
    real = fabrica(id);
    if (!real) throw new Error('Este navegador no permite guardar operaciones sin conexión.');
    return real;
  };
  return { todas: async () => (await abrir()).todas(), guardar: async o => (await abrir()).guardar(o), borrar: async i => (await abrir()).borrar(i) };
}

/** Reenvía una operación guardada a su RPC con la misma op_id, dispositivo y seq (idempotente en el servidor). */
export const enviadorRpc = supabase => async op => {
  const r = await supabase.rpc(op.rpc, { p_op_id: op.op_id, p_dispositivo_id: op.dispositivo_id, p_seq: op.seq, ...op.args });
  if (r.error) throw r.error;
  return r.data;
};

/** Almacén en memoria (pruebas y entornos sin IndexedDB). */
export function almacenEnMemoria() {
  const m = new Map();
  return {
    todas: async () => [...m.values()].map(o => ({ ...o })),
    guardar: async op => { m.set(op.op_id, { ...op }); },
    borrar: async id => { m.delete(id); },
  };
}

/** Almacén persistente en IndexedDB, aislado por usuario (base `cola-<userId>`, almacén `operaciones`). */
export function almacenIndexedDB(userId, idb = globalThis.indexedDB) {
  if (!idb || !userId) return null;
  const abrir = () => new Promise((res, rej) => {
    const q = idb.open(`cola-${userId}`, 1);
    q.onupgradeneeded = () => { q.result.createObjectStore('operaciones', { keyPath: 'op_id' }); };
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
  const tx = async (modo, f) => {
    const db = await abrir();
    return new Promise((res, rej) => {
      const t = db.transaction('operaciones', modo);
      const out = f(t.objectStore('operaciones'));
      t.oncomplete = () => { db.close(); res(out?.result); };
      t.onerror = t.onabort = () => { db.close(); rej(t.error); };
    });
  };
  return {
    todas: () => tx('readonly', s => s.getAll()),
    guardar: op => tx('readwrite', s => { s.put(op); }),
    borrar: id => tx('readwrite', s => { s.delete(id); }),
  };
}
