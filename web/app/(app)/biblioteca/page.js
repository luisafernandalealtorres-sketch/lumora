import { createClient } from '@/lib/supabase/server';
import { verificar } from '@/lib/consulta';
import Biblioteca from '@/components/Biblioteca';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const supabase = createClient();
  const { data, error } = await supabase.from('biblioteca').select('*').order('guardado_en', { ascending: false });
  verificar({ biblioteca: { error } });
  return <Biblioteca inicial={data ?? []} />;
}
