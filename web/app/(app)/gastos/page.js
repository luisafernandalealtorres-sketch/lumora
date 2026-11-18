import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

// Gastos vive dentro de Finanzas. Esta ruta se conserva como alias para que los enlaces y marcadores no se rompan.
export default function Page({ searchParams }) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams ?? {})) if (typeof v === 'string' && k !== 'vista') q.set(k, v);
  q.set('vista', 'gastos');
  redirect(`/finanzas?${q.toString()}`);
}
