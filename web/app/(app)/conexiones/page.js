import { createClient } from '@/lib/supabase/server';
import { verificar } from '@/lib/consulta';
import ConexionesPanel from '@/components/conexiones/ConexionesPanel';

export const dynamic = 'force-dynamic';

// Conexiones de Google: qué cuentas hay, cuáles están conectadas y de qué calendarios sale la agenda.
// Solo lee `google_cuentas` (sin tokens) y `calendarios_fuente`; conectar y desconectar pasan por la ruta /api/google/conectar y por la función de la base.
export default async function Page({ searchParams }) {
  const supabase = createClient();
  const [cu, fu] = await Promise.all([
    supabase.from('google_cuentas').select('id,email,estado,conectada_en,ultimo_error').order('conectada_en'),
    supabase.from('calendarios_fuente').select('calendario_id,nombre,frente_id,estado,cuenta,cuenta_id,ultima_sincronizacion,ultimo_error').order('nombre'),
  ]);
  verificar({ cuentas: cu, fuentes: fu });
  return <ConexionesPanel cuentas={cu.data ?? []} fuentes={fu.data ?? []} resultado={searchParams?.google ?? null} ahoraMs={Date.now()} />;
}
