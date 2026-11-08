import { createClient } from '@/lib/supabase/server';
import { verificar } from '@/lib/consulta';
import Gastos from '@/components/Gastos';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const supabase = createClient();
  const [fr, ga] = await Promise.all([
    supabase.from('frentes').select('*').order('orden'),
    supabase.from('gastos').select('*').order('fecha', { ascending: false }).limit(1000),
  ]);
  verificar({ frentes: fr, gastos: ga });
  return <Gastos frentes={fr.data ?? []} inicial={ga.data ?? []} />;
}
