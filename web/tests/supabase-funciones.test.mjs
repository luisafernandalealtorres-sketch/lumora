import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = ruta => readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8');
const OAUTH = leer('supabase/functions/google-oauth/index.ts');
const SYNC = leer('supabase/functions/sincronizar-agenda/index.ts');
const V2 = ['sync_aplicar.sql', 'sync_reversion.sql', 'sync_verificacion_solo_lectura.sql'].map(f => leer(`docs/sql/google-v2/${f}`));

test('la copia de agenda.js dentro de la función es idéntica a la de la aplicación (una sola lógica, sin desviarse)', () => {
  assert.equal(leer('supabase/functions/sincronizar-agenda/agenda.js'), leer('web/lib/domain/agenda.js'));
});

test('las funciones no registran ni devuelven tokens ni secretos', () => {
  for (const [nombre, src] of [['google-oauth', OAUTH], ['sincronizar-agenda', SYNC]]) {
    assert.ok(!/console\./.test(src), `${nombre} no debe usar console (podría filtrar tokens)`);
    assert.ok(!/GOCSPX-|ya29\.|1\/\/0/.test(src), `${nombre} contiene un secreto`);
    assert.ok(!/[\w.+-]+@[\w-]+\.[\w.-]+/.test(src), `${nombre} contiene un correo`);
  }
  assert.ok(!/json\(\{[^}]*(token|secret)/i.test(SYNC), 'la respuesta de sincronizar no incluye tokens');
});

test('el secreto del cliente de Google viene de variables de entorno, nunca del código', () => {
  for (const src of [OAUTH, SYNC]) {
    assert.match(src, /Deno\.env\.get\('GOOGLE_SYNC_CLIENT_SECRET'\)/);
    assert.ok(!/client_secret:\s*'[^']+'/.test(src));
  }
});

test('el retorno de Google consume el código de un solo uso, exige el permiso de eventos y el token de actualización', () => {
  assert.match(OAUTH, /google_consumir_nonce/);
  assert.match(OAUTH, /calendar\.events\.readonly/);
  assert.match(OAUTH, /!tokens\.refresh_token/);
  assert.ok(OAUTH.indexOf('google_consumir_nonce') < OAUTH.indexOf('oauth2.googleapis.com/token'), 'primero valida el código, luego habla con Google');
  assert.match(OAUTH, /google_guardar_cuenta/);
});

test('la sincronización es solo lectura de Google, se autentica contra la base y pide solo lo necesario', () => {
  assert.match(SYNC, /google_validar_sync/);
  assert.ok(SYNC.indexOf('google_validar_sync') < SYNC.indexOf('calendarios_fuente'), 'valida antes de leer nada');
  assert.ok(!/method:\s*'(POST|PUT|PATCH|DELETE)'[^}]*googleapis\.com\/calendar/.test(SYNC), 'no escribe en Calendar');
  assert.match(SYNC, /fields:\s*'nextPageToken,items\(id,status,summary,description,start,end,attendees\(self,responseStatus\)\)'/);
  assert.match(SYNC, /agenda_reemplazar/);
  assert.match(SYNC, /descartarEvento/);
});

test('las funciones de apoyo de la sincronización (v2) son solo de service_role y no llevan datos personales', () => {
  const [aplicar, reversion, verificacion] = V2;
  for (const s of V2) {
    assert.ok(!/[\w.+-]+@[\w-]+\.[\w.-]+/.test(s), 'sin correos');
    assert.ok(!s.includes('group.calendar.google.com'), 'sin ids de calendario');
  }
  const funciones = ['google_validar_sync(text)', 'agenda_reemplazar(uuid, text, date, date, jsonb)', 'agenda_error_fuente(uuid, text, text)', 'google_marcar_cuenta(uuid, text, text)', 'google_vincular_calendarios(uuid, uuid, text)'];
  for (const fn of funciones) {
    assert.ok(aplicar.includes(`revoke execute on function public.${fn} from public, anon, authenticated;`), fn);
    assert.ok(aplicar.includes(`grant execute on function public.${fn} to service_role;`), fn);
  }
  assert.ok(!aplicar.includes('to authenticated'), 'ninguna función de v2 es del navegador');
  assert.equal((aplicar.match(/set search_path = ''/g) ?? []).length, 5);
  assert.match(aplicar, /vault\.create_secret\(\s*replace\(gen_random_uuid/);
  assert.match(reversion, /delete from vault\.secrets where name = 'sync_agenda_secret'/);
  assert.match(verificacion, /sync_agenda_secret/);
});
