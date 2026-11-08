import { createClient } from '@/lib/supabase/server';
import Finanzas from '@/components/Finanzas';
import { mesActual } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const mes = mesActual();
  const [fr, ga, ing, pre, rec, deu] = await Promise.all([
    supabase.from('frentes').select('*').order('orden'),
    supabase.from('gastos').select('categoria,valor_cop').gte('fecha', `${mes}-01`),
    supabase.from('ingresos').select('*').gte('fecha', `${mes}-01`).order('fecha', { ascending: false }),
    supabase.from('presupuestos').select('*'),
    supabase.from('recurrentes').select('*').eq('activo', true).order('dia_mes'),
    supabase.from('deudas').select('*').order('creado_en'),
  ]);
  return (
    <Finanzas
      userId={user.id}
      frentes={fr.data ?? []}
      gastos={ga.data ?? []}
      ingresos={ing.data ?? []}
      presupuestos={pre.data ?? []}
      recurrentes={rec.data ?? []}
      deudas={deu.data ?? []}
    />
  );
}
