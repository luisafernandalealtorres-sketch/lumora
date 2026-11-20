// Conexiones de Google: qué cuentas hay, cuáles están conectadas y qué calendarios alimentan la agenda. Lógica pura.
//
// Las cuentas salen de dos lugares: las que ya están conectadas (`google_cuentas`) y las que se conocen por los
// calendarios (`calendarios_fuente.cuenta`) aunque todavía no estén conectadas. Nada se inventa: una cuenta sin
// conexión se muestra como «sin conectar», nunca como si estuviera sincronizando.

export const SCOPE_EVENTOS = 'https://www.googleapis.com/auth/calendar.events.readonly';
export const SCOPES_CONEXION = ['openid', 'email', SCOPE_EVENTOS];

// Resultado del retorno de Google (parámetro ?google=...). Un código desconocido no se muestra.
const MENSAJES = {
  conectada: { tono: 'exito', texto: 'Cuenta conectada. La agenda empezará a sincronizarse con ella en la próxima corrida.' },
  cancelada: { tono: 'neutro', texto: 'Cancelaste la conexión. No se guardó nada.' },
  permiso_incompleto: { tono: 'advertencia', texto: 'No diste el permiso para ver los eventos del calendario. Vuelve a conectar y deja marcada esa casilla.' },
  sin_token: { tono: 'advertencia', texto: 'Google no entregó un permiso duradero. Vuelve a conectar la cuenta.' },
  sin_correo: { tono: 'peligro', texto: 'No se pudo saber con qué cuenta te conectaste. Intenta de nuevo.' },
  estado_invalido: { tono: 'peligro', texto: 'El enlace de conexión venció o ya se usó. Empieza de nuevo desde aquí.' },
  solicitud_invalida: { tono: 'peligro', texto: 'La respuesta de Google llegó incompleta. Intenta de nuevo.' },
  intercambio_fallido: { tono: 'peligro', texto: 'Google no aceptó la conexión. Intenta de nuevo; si se repite, revisa el cliente OAuth.' },
  no_guardada: { tono: 'peligro', texto: 'La conexión funcionó pero no se pudo guardar. Intenta de nuevo.' },
  sin_configurar: { tono: 'advertencia', texto: 'Falta configurar las credenciales de Google. No se inició ninguna conexión.' },
  no_iniciada: { tono: 'peligro', texto: 'No se pudo iniciar la conexión. Intenta de nuevo.' },
};

export function mensajeGoogle(codigo) {
  return Object.hasOwn(MENSAJES, codigo ?? '') ? MENSAJES[codigo] : null;
}

const norm = c => String(c ?? '').trim().toLowerCase();

/**
 * Cuentas con su estado y sus calendarios.
 * @param {object} p
 * @param {Array} p.cuentas  Filas de google_cuentas: { id, email, estado, conectada_en, ultimo_error }
 * @param {Array} p.fuentes  Filas de calendarios_fuente: { calendario_id, nombre, frente_id, estado, cuenta, cuenta_id, ultima_sincronizacion, ultimo_error }
 * @returns {Array<{ email, estado, cuentaId, conectadaEn, error, calendarios }>} con estado:
 *   'conectada' | 'revocada' | 'error' | 'sin_conectar'
 */
export function cuentasConEstado({ cuentas, fuentes }) {
  const porEmail = new Map();
  for (const c of cuentas ?? []) {
    porEmail.set(norm(c.email), { email: norm(c.email), estado: c.estado === 'activa' ? 'conectada' : c.estado, cuentaId: c.id, conectadaEn: c.conectada_en ?? null, error: c.ultimo_error ?? null, calendarios: [] });
  }
  for (const f of fuentes ?? []) {
    const email = norm(f.cuenta);
    if (!email) continue;
    if (!porEmail.has(email)) porEmail.set(email, { email, estado: 'sin_conectar', cuentaId: null, conectadaEn: null, error: null, calendarios: [] });
    porEmail.get(email).calendarios.push({
      id: f.calendario_id, nombre: f.nombre, frente: f.frente_id ?? null, estado: f.estado,
      ultimaSincronizacion: f.ultima_sincronizacion ?? null, error: f.ultimo_error ?? null,
    });
  }
  const orden = { conectada: 0, error: 1, revocada: 2, sin_conectar: 3 };
  return [...porEmail.values()].sort((a, b) => (orden[a.estado] ?? 9) - (orden[b.estado] ?? 9) || a.email.localeCompare(b.email));
}

/** Correo válido para usar como pista (login_hint) en la ventana de Google; si no lo es, no se envía. */
export function pistaDeCuenta(valor) {
  const v = String(valor ?? '').trim().toLowerCase();
  return /^[a-z0-9._%+-]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(v) && v.length <= 254 ? v : null;
}

/**
 * Dirección de Google para iniciar la conexión. `nonce` es el código de un solo uso que creó la base para esta sesión.
 * Pide solo lectura de eventos y el correo; `access_type=offline` + `prompt=consent` garantizan un permiso duradero.
 */
export function urlAutorizacionGoogle({ clientId, supabaseUrl, nonce, pista = null }) {
  const params = {
    client_id: clientId,
    redirect_uri: `${String(supabaseUrl).replace(/\/+$/, '')}/functions/v1/google-oauth`,
    response_type: 'code',
    scope: SCOPES_CONEXION.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'false',
    state: nonce,
  };
  const p = pistaDeCuenta(pista);
  if (p) params.login_hint = p;
  return `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams(params).toString()}`;
}
