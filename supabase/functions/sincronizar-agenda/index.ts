// sincronizar-agenda: lee de Google Calendar (SOLO LECTURA) los eventos de hoy y de mañana de los calendarios activos
// y los reemplaza en `agenda_hoy`. La llama pg_cron a las 6:00, 12:00 y 17:00 (hora de Bogotá) con un secreto que vive en el Vault.
// verify_jwt = false: se autentica con el encabezado `x-sync-secret`, que se valida contra la base (nunca en el código).
// Nunca escribe tokens en los registros ni en la respuesta. Guarda solo título, hora, detalle corto y origen.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { normalizarEvento, descartarEvento } from './agenda.js';

const ZONA = 'America/Bogota';

function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
}

const fechaBogota = (d: Date): string => d.toLocaleDateString('en-CA', { timeZone: ZONA });
function sumarDias(fecha: string, n: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function accesoDesde(refreshToken: string): Promise<{ token?: string; revocada?: boolean; error?: string }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_SYNC_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_SYNC_CLIENT_SECRET')!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (res.ok) return { token: (await res.json()).access_token };
  let motivo = `http_${res.status}`;
  try { motivo = (await res.json()).error ?? motivo; } catch { /* sin cuerpo */ }
  return { revocada: motivo === 'invalid_grant', error: motivo };
}

async function listarEventos(calendarioId: string, token: string, desde: string, hasta: string): Promise<any[]> {
  const eventos: any[] = [];
  let pagina: string | undefined;
  for (let i = 0; i < 4; i++) {
    const params = new URLSearchParams({
      singleEvents: 'true', orderBy: 'startTime', timeMin: desde, timeMax: hasta, timeZone: ZONA, maxResults: '250',
      // Solo lo necesario: de los invitados, únicamente si el propio usuario rechazó (nunca correos ajenos).
      fields: 'nextPageToken,items(id,status,summary,description,start,end,attendees(self,responseStatus))',
    });
    if (pagina) params.set('pageToken', pagina);
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarioId)}/events?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`calendar_http_${res.status}`);
    const cuerpo = await res.json();
    eventos.push(...(cuerpo.items ?? []));
    pagina = cuerpo.nextPageToken;
    if (!pagina) break;
  }
  return eventos;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'metodo_no_permitido' }, 405);
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  // Autenticación: el secreto compartido vive en el Vault; la base decide si coincide.
  const { data: autorizado } = await supabase.rpc('google_validar_sync', { p_valor: req.headers.get('x-sync-secret') ?? '' });
  if (autorizado !== true) return json({ error: 'no_autorizado' }, 401);

  if (!Deno.env.get('GOOGLE_SYNC_CLIENT_ID') || !Deno.env.get('GOOGLE_SYNC_CLIENT_SECRET')) return json({ error: 'sin_configurar' }, 500);

  const ahora = new Date();
  const hoy = fechaBogota(ahora);
  const manana = sumarDias(hoy, 1);
  const desde = `${hoy}T00:00:00-05:00`;
  const hasta = `${sumarDias(hoy, 2)}T00:00:00-05:00`;

  const { data: fuentes, error: errFuentes } = await supabase
    .from('calendarios_fuente')
    .select('user_id,calendario_id,nombre,frente_id,cuenta_id')
    .eq('estado', 'activa')
    .not('cuenta_id', 'is', null);
  if (errFuentes) return json({ error: 'sin_fuentes' }, 500);
  if (!fuentes?.length) return json({ cuentas: 0, calendarios: [] });

  const idsCuentas = [...new Set(fuentes.map((f: any) => f.cuenta_id))];
  const { data: cuentas } = await supabase.from('google_cuentas').select('id,estado').in('id', idsCuentas).eq('estado', 'activa');

  const resumen: any[] = [];
  for (const cuenta of cuentas ?? []) {
    const propias = fuentes.filter((f: any) => f.cuenta_id === cuenta.id);
    const { data: refresh } = await supabase.rpc('google_leer_token', { p_cuenta_id: cuenta.id });
    const acceso = refresh ? await accesoDesde(refresh) : { error: 'sin_token' };
    if (!acceso.token) {
      await supabase.rpc('google_marcar_cuenta', { p_cuenta_id: cuenta.id, p_estado: acceso.revocada ? 'revocada' : 'error', p_error: acceso.error ?? 'error' });
      for (const f of propias) {
        await supabase.rpc('agenda_error_fuente', { p_user_id: f.user_id, p_calendario_id: f.calendario_id, p_error: `cuenta: ${acceso.error ?? 'error'}` });
        resumen.push({ nombre: f.nombre, error: `cuenta: ${acceso.error ?? 'error'}` });
      }
      continue;
    }
    for (const f of propias) {
      try {
        const eventos = await listarEventos(f.calendario_id, acceso.token, desde, hasta);
        const filas = eventos
          .filter((e: any) => !descartarEvento(e))
          .map((e: any) => normalizarEvento({ evento: e, calendarioId: f.calendario_id, fuentes: [f], ahoraIso: ahora.toISOString() }))
          .filter(Boolean);
        const { error } = await supabase.rpc('agenda_reemplazar', {
          p_user_id: f.user_id, p_calendario_id: f.calendario_id, p_desde: hoy, p_hasta: manana, p_filas: filas,
        });
        if (error) throw new Error('guardado_fallido');
        resumen.push({ nombre: f.nombre, hoy: filas.filter((r: any) => r.fecha === hoy).length, manana: filas.filter((r: any) => r.fecha === manana).length });
      } catch (e) {
        const motivo = e instanceof Error ? e.message : 'error';
        await supabase.rpc('agenda_error_fuente', { p_user_id: f.user_id, p_calendario_id: f.calendario_id, p_error: motivo });
        resumen.push({ nombre: f.nombre, error: motivo });
      }
    }
  }
  return json({ cuentas: (cuentas ?? []).length, calendarios: resumen });
});
