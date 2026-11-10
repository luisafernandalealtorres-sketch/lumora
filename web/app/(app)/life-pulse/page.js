import { Suspense } from 'react';
import LifePulsePanel from '@/components/lifepulse/LifePulsePanel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Life Pulse' };

// Life Pulse (Fase 3, §5): Execution, Balance y Wellbeing, diario, semanal y mensual. Tres indicadores independientes.
export default function Page() {
  return (
    <>
      <header><div><div className="date">Indicadores</div><h1>Life Pulse</h1></div></header>
      <Suspense fallback={null}><LifePulsePanel /></Suspense>
    </>
  );
}
