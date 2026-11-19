import { createClient } from '@/lib/supabase/server';
import { verificar } from '@/lib/consulta';
import MetasPanel from '@/components/metas/MetasPanel';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const supabase = createClient();
  const [fr, me, hi, pe] = await Promise.all([
    supabase.from('frentes').select('*').order('orden'),
    supabase.from('metas').select('*').order('creado_en'),
    supabase.from('hitos').select('*').order('creado_en'),
    supabase.from('pendientes').select('id,texto,hecho,meta_id').not('meta_id', 'is', null),
  ]);
  verificar({ frentes: fr, metas: me, hitos: hi, pendientes: pe });
  return <MetasPanel frentes={fr.data ?? []} metas={me.data ?? []} hitos={hi.data ?? []} tareas={pe.data ?? []} />;
}
