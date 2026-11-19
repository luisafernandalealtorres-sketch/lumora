import { createClient } from '@/lib/supabase/server';
import { verificar } from '@/lib/consulta';
import SaludPanel from '@/components/salud/SaludPanel';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const desde = new Date(Date.now() - 120 * 864e5).toLocaleDateString('en-CA');
  const [h, r, m, o] = await Promise.all([
    supabase.from('habitos').select('*').eq('activo', true).order('creado_en'),
    supabase.from('habito_registros').select('*').gte('fecha', desde),
    supabase.from('medidas').select('*').order('fecha'),
    supabase.from('objetivos_salud').select('*').order('creado_en'),
  ]);
  verificar({ habitos: h, registros: r, medidas: m, objetivos: o });
  return (
    <SaludPanel
      userId={user.id}
      habitos={h.data ?? []}
      registros={r.data ?? []}
      medidas={m.data ?? []}
      objetivos={o.data ?? []}
    />
  );
}
