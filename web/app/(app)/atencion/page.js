import { Suspense } from 'react';
import AtencionPanel from '@/components/atencion/AtencionPanel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Atención' };

// Objetivos semanales de atención por frente y Balance (Fase 3, §5.3).
export default function Page() {
  return (
    <>
      <header><div><div className="date">Objetivos y balance</div><h1>Atención</h1></div></header>
      <Suspense fallback={null}><AtencionPanel /></Suspense>
    </>
  );
}
