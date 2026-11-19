import { createClient } from '@/lib/supabase/server';
import { verificar } from '@/lib/consulta';
import CerebroPanel from '@/components/cerebro/CerebroPanel';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const supabase = createClient();
  const [fr, no] = await Promise.all([
    supabase.from('frentes').select('*').order('orden'),
    supabase.from('notas').select('*').order('actualizado_en', { ascending: false }),
  ]);
  verificar({ frentes: fr, notas: no });
  return <CerebroPanel frentes={fr.data ?? []} inicial={no.data ?? []} />;
}
