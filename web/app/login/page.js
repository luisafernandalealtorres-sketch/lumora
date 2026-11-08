'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';

function Form() {
  const error = useSearchParams().get('error');
  async function entrar() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }
  return (
    <div className="login">
      <h1>Cerebro de Lu</h1>
      <p className="sub">Entra con tu cuenta de Google.</p>
      {error === 'no-autorizado' && <div className="err">Esta cuenta no tiene acceso.</div>}
      {error === 'fallo' && <div className="err">No se pudo iniciar sesión. Intenta de nuevo.</div>}
      <button className="btn" onClick={entrar}>Entrar con Google</button>
    </div>
  );
}

export default function Login() {
  return <Suspense><Form /></Suspense>;
}
