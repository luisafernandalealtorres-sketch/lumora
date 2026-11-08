import { createClient } from '@/lib/supabase/server';
import Jornada from '@/components/Jornada';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase.from('jornadas').select('*').order('fecha', { ascending: false }).limit(120);
  return <Jornada userId={user.id} inicial={data ?? []} />;
}
