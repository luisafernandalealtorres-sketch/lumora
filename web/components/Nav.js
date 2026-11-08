'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const links = [
  ['/', 'Mi día'],
  ['/panel', 'Panel'],
  ['/metas', 'Metas'],
  ['/finanzas', 'Finanzas'],
  ['/gastos', 'Gastos'],
  ['/jornada', 'Jornada'],
  ['/salud', 'Salud'],
  ['/biblioteca', 'Biblioteca'],
  ['/cerebro', 'Cerebro'],
];

export default function Nav() {
  const path = usePathname();
  const router = useRouter();
  async function salir() {
    await createClient().auth.signOut();
    router.push('/login');
    router.refresh();
  }
  return (
    <nav className="nav" aria-label="Secciones">
      <div className="nav-links">
        {links.map(([href, label]) => (
          <Link key={href} href={href} className={(href === '/' ? path === '/' : path.startsWith(href)) ? 'on' : ''}>
            {label}
          </Link>
        ))}
      </div>
      <button className="btn sec" onClick={salir}>Salir</button>
    </nav>
  );
}
