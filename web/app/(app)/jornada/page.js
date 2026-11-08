import { createClient } from '@/lib/supabase/server';
import { verificar } from '@/lib/consulta';
import Jornada from '@/components/Jornada';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('jornadas').select('*').order('fecha', { ascending: false }).limit(120);
  verificar({ jornadas: { error } });
  return <Jornada userId={user.id} inicial={data ?? []} />;
}
