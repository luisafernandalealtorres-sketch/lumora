import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = f => readFileSync(new URL(`../../docs/sql/google-v1/${f}`, import.meta.url), 'utf8');
const ARCHIVOS = ['google_aplicar.sql', 'google_reversion.sql', 'google_verificacion_solo_lectura.sql'];

test('la migración de Google no contiene correos, ids de calendario ni secretos (el repositorio es público)', () => {
  for (const f of ARCHIVOS) {
    const s = leer(f);
    assert.ok(!/[\w.+-]+@[\w-]+\.[\w.-]+/.test(s), `${f} contiene un correo`);
    assert.ok(!s.includes('group.calendar.google.com'), `${f} contiene un id de calendario`);
    assert.ok(!/GOCSPX-|ya29\.|1\/\/0/.test(s), `${f} parece contener un secreto de Google`);
  }
});

test('las tablas de Google se crean con seguridad por filas y sin acceso del cliente a tokens', () => {
  const s = leer('google_aplicar.sql');
  for (const t of ['google_cuentas', 'google_secretos', 'google_oauth_estados']) {
    assert.match(s, new RegExp(`alter table public\\.${t} enable row level security`), t);
    assert.match(s, new RegExp(`revoke all on public\\.${t} from anon, authenticated`), t);
  }
  assert.ok(!/grant (select|insert|update|delete)[^;]*on public\.google_(secretos|oauth_estados)/.test(s), 'el cliente no puede tocar secretos ni códigos');
  assert.ok(!/^\s+(refresh_|access_)?token\w*\s+text/m.test(s), 'ninguna tabla guarda el token: va al Vault');
  assert.match(s, /vault\.create_secret/);
});

test('las funciones que manejan tokens solo las ejecuta service_role', () => {
  const s = leer('google_aplicar.sql');
  for (const fn of ['google_consumir_nonce(text)', 'google_guardar_cuenta(uuid, text, text, text[])', 'google_leer_token(uuid)']) {
    assert.ok(s.includes(`revoke execute on function public.${fn} from public, anon, authenticated;`), `${fn} debe quitarse a authenticated`);
    assert.ok(s.includes(`grant execute on function public.${fn} to service_role;`), `${fn} debe darse a service_role`);
  }
  for (const fn of ['google_iniciar_conexion()', 'google_desconectar(uuid)']) {
    assert.ok(s.includes(`grant execute on function public.${fn} to authenticated;`), `${fn} lo ejecuta el usuario`);
  }
  assert.equal((s.match(/security definer/g) ?? []).length, 5);
  assert.equal((s.match(/set search_path = ''/g) ?? []).length, 5, 'cada función security definer fija search_path');
});

test('la reversión borra los secretos del Vault antes de perder el mapa que los referencia', () => {
  const s = leer('google_reversion.sql');
  assert.ok(s.indexOf('delete from vault.secrets') < s.indexOf('drop table if exists public.google_secretos'));
  assert.match(s, /drop column if exists cuenta_id/);
});
