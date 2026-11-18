import { Suspense } from 'react';
import AtencionPanel from '@/components/atencion/AtencionPanel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Atención' };

// Objetivos semanales de atención por frente y Balance (Fase 3, §5.3).
// El encabezado (título, semana, resumen y estado) lo dibuja el panel.
export default function Page() {
  return <Suspense fallback={null}><AtencionPanel /></Suspense>;
}
