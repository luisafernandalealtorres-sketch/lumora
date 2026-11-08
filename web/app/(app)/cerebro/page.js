import { createClient } from '@/lib/supabase/server';
import { verificar } from '@/lib/consulta';
import Cerebro from '@/components/Cerebro';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const supabase = createClient();
  const [fr, no] = await Promise.all([
    supabase.from('frentes').select('*').order('orden'),
    supabase.from('notas').select('*').order('actualizado_en', { ascending: false }),
  ]);
  verificar({ frentes: fr, notas: no });
  return <Cerebro frentes={fr.data ?? []} inicial={no.data ?? []} />;
}
