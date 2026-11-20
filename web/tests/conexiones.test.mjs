import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mensajeGoogle, cuentasConEstado, pistaDeCuenta, urlAutorizacionGoogle, SCOPE_EVENTOS } from '../lib/domain/conexiones.js';

test('cada resultado del retorno de Google tiene un mensaje claro; uno desconocido no se muestra', () => {
  for (const c of ['conectada', 'cancelada', 'permiso_incompleto', 'sin_token', 'sin_correo', 'estado_invalido', 'solicitud_invalida', 'intercambio_fallido', 'no_guardada', 'sin_configurar', 'no_iniciada']) {
    assert.ok(mensajeGoogle(c)?.texto.length > 10, c);
  }
  assert.equal(mensajeGoogle('inventado'), null);
  assert.equal(mensajeGoogle('toString'), null);
  assert.equal(mensajeGoogle(null), null);
});

test('las cuentas conocidas por los calendarios aparecen «sin conectar» hasta que se conectan; nunca como sincronizando', () => {
  const fuentes = [
    { calendario_id: 'c1', nombre: 'Tanku', frente_id: 'tanku', estado: 'activa', cuenta: 'A@x.com', ultima_sincronizacion: '2026-11-20T10:00:00Z' },
    { calendario_id: 'c2', nombre: 'Principal A', frente_id: null, estado: 'activa', cuenta: 'a@x.com' },
    { calendario_id: 'c3', nombre: 'greencode', frente_id: 'ticketcode', estado: 'pendiente', cuenta: 'g@x.co' },
  ];
  const r = cuentasConEstado({ cuentas: [], fuentes });
  assert.deepEqual(r.map(c => [c.email, c.estado, c.calendarios.length]), [['a@x.com', 'sin_conectar', 2], ['g@x.co', 'sin_conectar', 1]]);
});

test('una cuenta conectada se muestra primero, con su estado real', () => {
  const cuentas = [{ id: 'k1', email: 'A@x.com', estado: 'activa', conectada_en: '2026-11-20T01:00:00Z', ultimo_error: null }, { id: 'k2', email: 'r@x.com', estado: 'revocada', ultimo_error: 'invalid_grant' }];
  const fuentes = [{ calendario_id: 'c1', nombre: 'Tanku', estado: 'activa', cuenta: 'a@x.com', cuenta_id: 'k1' }, { calendario_id: 'c3', nombre: 'G', estado: 'pendiente', cuenta: 'g@x.co' }];
  const r = cuentasConEstado({ cuentas, fuentes });
  assert.deepEqual(r.map(c => [c.email, c.estado]), [['a@x.com', 'conectada'], ['r@x.com', 'revocada'], ['g@x.co', 'sin_conectar']]);
  assert.equal(r[0].cuentaId, 'k1');
  assert.equal(r[1].error, 'invalid_grant');
});

test('un calendario sin cuenta no crea una cuenta fantasma', () => {
  assert.deepEqual(cuentasConEstado({ cuentas: [], fuentes: [{ calendario_id: 'x', nombre: 'X', estado: 'activa', cuenta: null }] }), []);
  assert.deepEqual(cuentasConEstado({ cuentas: null, fuentes: null }), []);
});

test('la pista de cuenta solo acepta un correo bien formado', () => {
  assert.equal(pistaDeCuenta(' A@Ejemplo.com '), 'a@ejemplo.com');
  for (const mal of ['', null, 'sin-arroba', 'a@b', 'a b@c.com', 'x@y.z&scope=otro', 'a@b.c\nd']) assert.equal(pistaDeCuenta(mal), null, String(mal));
});

test('la dirección de Google pide solo lectura de eventos, un permiso duradero y el código de un solo uso', () => {
  const u = new URL(urlAutorizacionGoogle({ clientId: 'id-123', supabaseUrl: 'https://abc.supabase.co/', nonce: 'N0NCE', pista: 'a@x.com' }));
  assert.equal(u.origin + u.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(u.searchParams.get('client_id'), 'id-123');
  assert.equal(u.searchParams.get('redirect_uri'), 'https://abc.supabase.co/functions/v1/google-oauth');
  assert.equal(u.searchParams.get('state'), 'N0NCE');
  assert.equal(u.searchParams.get('access_type'), 'offline');
  assert.equal(u.searchParams.get('prompt'), 'consent');
  assert.equal(u.searchParams.get('login_hint'), 'a@x.com');
  const scopes = u.searchParams.get('scope').split(' ');
  assert.deepEqual(scopes, ['openid', 'email', SCOPE_EVENTOS]);
  assert.ok(!scopes.some(s => /calendar(?!\.events\.readonly)|mail\.google|drive/.test(s)), 'ningún permiso de escritura ni de otros servicios');
});

test('una pista inválida no llega a la dirección', () => {
  const u = new URL(urlAutorizacionGoogle({ clientId: 'i', supabaseUrl: 'https://a.supabase.co', nonce: 'n', pista: 'x@y.z&scope=otro' }));
  assert.equal(u.searchParams.get('login_hint'), null);
});

test('la ruta de conexión exige sesión y no lleva secretos', () => {
  const ruta = readFileSync(new URL('../app/api/google/conectar/route.js', import.meta.url), 'utf8');
  assert.match(ruta, /auth\.getUser\(\)/);
  assert.match(ruta, /google_iniciar_conexion/);
  assert.ok(!/GOOGLE_SYNC_CLIENT_SECRET/.test(ruta), 'el secreto del cliente vive solo en Supabase');
  const mw = readFileSync(new URL('../middleware.js', import.meta.url), 'utf8');
  assert.ok(!/api\/google/.test(mw), 'la ruta de conexión no se declara pública');
});
