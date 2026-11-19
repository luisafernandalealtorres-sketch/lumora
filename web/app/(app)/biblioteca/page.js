import { createClient } from '@/lib/supabase/server';
import { verificar } from '@/lib/consulta';
import BibliotecaPanel from '@/components/biblioteca/BibliotecaPanel';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const supabase = createClient();
  const { data, error } = await supabase.from('biblioteca').select('*').order('guardado_en', { ascending: false });
  verificar({ biblioteca: { error } });
  return <BibliotecaPanel inicial={data ?? []} />;
}
