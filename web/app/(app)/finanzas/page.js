import { createClient } from '@/lib/supabase/server';
import { verificar } from '@/lib/consulta';
import FinanzasPanel from '@/components/finanzas/FinanzasPanel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Finanzas' };

// Finanzas incluye Gastos, Ingresos y Compromisos (pagos recurrentes y deudas) en una sola pantalla con pestañas.
// `?vista=` elige la pestaña: resumen (por defecto), gastos, ingresos o compromisos.
export default async function Page({ searchParams }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [fr, ga, ing, pre, rec, deu] = await Promise.all([
    supabase.from('frentes').select('*').order('orden'),
    supabase.from('gastos').select('*').order('fecha', { ascending: false }).limit(1000),
    supabase.from('ingresos').select('*').order('fecha', { ascending: false }).limit(1000),
    supabase.from('presupuestos').select('*'),
    supabase.from('recurrentes').select('*').eq('activo', true).order('dia_mes'),
    supabase.from('deudas').select('*').order('creado_en'),
  ]);
  verificar({ frentes: fr, gastos: ga, ingresos: ing, presupuestos: pre, recurrentes: rec, deudas: deu });
  const vista = typeof searchParams?.vista === 'string' ? searchParams.vista : 'resumen';
  return (
    <FinanzasPanel
      userId={user.id}
      frentes={fr.data ?? []}
      gastos={ga.data ?? []}
      ingresos={ing.data ?? []}
      presupuestos={pre.data ?? []}
      recurrentes={rec.data ?? []}
      deudas={deu.data ?? []}
      vistaInicial={vista}
    />
  );
}
