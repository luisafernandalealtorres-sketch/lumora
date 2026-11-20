// google-oauth: retorno de Google al conectar una cuenta (Calendar, solo lectura).
// Pública a propósito (verify_jwt = false): Google redirige el navegador aquí sin sesión. La seguridad está en el
// parámetro `state`, un código de un solo uso con vencimiento que creó la aplicación para el usuario con sesión.
// Nunca escribe tokens en los registros ni en las respuestas.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const APP_URL = Deno.env.get('APP_URL') ?? 'https://lumora.synergiapps.co';
const SCOPE_EVENTOS = 'https://www.googleapis.com/auth/calendar.events.readonly';

function volver(estado: string): Response {
  return new Response(null, { status: 302, headers: { Location: `${APP_URL}/?google=${estado}` } });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET') return new Response('Método no permitido', { status: 405 });
  const url = new URL(req.url);
  if (url.searchParams.get('error')) return volver('cancelada');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) return volver('solicitud_invalida');

  const clientId = Deno.env.get('GOOGLE_SYNC_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_SYNC_CLIENT_SECRET');
  if (!clientId || !clientSecret) return volver('sin_configurar');

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  // 1) El código debe existir, no haberse usado y no haber vencido. Se consume aquí: solo sirve una vez.
  const { data: userId, error: errEstado } = await supabase.rpc('google_consumir_nonce', { p_nonce: state });
  if (errEstado || !userId) return volver('estado_invalido');

  // 2) Intercambiar el código por los tokens.
  const intercambio = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-oauth`,
      grant_type: 'authorization_code',
    }),
  });
  if (!intercambio.ok) return volver('intercambio_fallido');
  const tokens: any = await intercambio.json();

  // 3) Exigir el permiso de lectura de eventos y un token de actualización (sin él no se puede sincronizar).
  const scopes = String(tokens.scope ?? '').split(' ').filter(Boolean);
  if (!scopes.includes(SCOPE_EVENTOS)) return volver('permiso_incompleto');
  if (!tokens.refresh_token) return volver('sin_token');

  // 4) Saber con qué cuenta se conectó.
  const perfilRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!perfilRes.ok) return volver('sin_correo');
  const perfil: any = await perfilRes.json();
  if (!perfil.email || perfil.email_verified === false) return volver('sin_correo');

  // 5) Guardar el token cifrado en el Vault y activar los calendarios de esa cuenta.
  const { data: cuentaId, error: errGuardar } = await supabase.rpc('google_guardar_cuenta', {
    p_user_id: userId,
    p_email: perfil.email,
    p_refresh_token: tokens.refresh_token,
    p_scopes: scopes,
  });
  if (errGuardar || !cuentaId) return volver('no_guardada');
  await supabase.rpc('google_vincular_calendarios', { p_user_id: userId, p_cuenta_id: cuentaId, p_email: perfil.email });

  return volver('conectada');
});
