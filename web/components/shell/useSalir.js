'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Cierre de sesión: exactamente el mismo flujo que tenía el menú anterior (Nav.js).
// Si falla, expone el error para mostrarlo con opción de reintento.
export function useSalir() {
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);
  const [error, setError] = useState(false);

  async function salir() {
    setSaliendo(true);
    setError(false);
    try {
      const { error: e } = await createClient().auth.signOut();
      if (e) throw e;
      router.push('/login');
      router.refresh();
    } catch {
      setError(true);
      setSaliendo(false);
    }
  }
  return { salir, saliendo, error };
}
