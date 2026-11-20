import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { urlAutorizacionGoogle } from '@/lib/domain/conexiones';

// Inicia la conexión de una cuenta de Google. Exige sesión (el middleware la pide y aquí se vuelve a comprobar).
// 1) La base crea un código de un solo uso para este usuario. 2) Se envía a Google con permiso solo de lectura de eventos.
// 3) Google vuelve a la función `google-oauth` de Supabase, que guarda el token cifrado. El secreto del cliente nunca pasa por aquí.
export async function GET(request) {
  const { origin, searchParams } = new URL(request.url);
  const clientId = process.env.GOOGLE_SYNC_CLIENT_ID;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!clientId || !supabaseUrl) return NextResponse.redirect(`${origin}/conexiones?google=sin_configurar`);

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const { data: nonce, error } = await supabase.rpc('google_iniciar_conexion');
  if (error || !nonce) return NextResponse.redirect(`${origin}/conexiones?google=no_iniciada`);

  return NextResponse.redirect(urlAutorizacionGoogle({ clientId, supabaseUrl, nonce, pista: searchParams.get('cuenta') }));
}
