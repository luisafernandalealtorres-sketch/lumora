import { createClient } from '@/lib/supabase/server';
import Biblioteca from '@/components/Biblioteca';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const supabase = createClient();
  const { data } = await supabase.from('biblioteca').select('*').order('guardado_en', { ascending: false });
  return <Biblioteca inicial={data ?? []} />;
}
