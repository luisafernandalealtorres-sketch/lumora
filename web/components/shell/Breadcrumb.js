'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { migas } from '@/lib/domain/navegacion';
import estilos from './Breadcrumb.module.css';

// Migas de pan: grupo › módulo. No es un encabezado: cada pantalla conserva su propio <h1>.
// En móvil solo se ve el último nivel (el resto sigue disponible para lectores de pantalla).
export default function Breadcrumb() {
  const ruta = usePathname();
  const cadena = migas(ruta, { desarrollo: process.env.NODE_ENV !== 'production' });
  if (!cadena.length) return null;

  return (
    <nav aria-label="Dónde estás" className={estilos.migas}>
      <ol className={estilos.lista}>
        {cadena.map((m, i) => {
          const ultimo = i === cadena.length - 1;
          return (
            <li key={m.nombre} className={`${estilos.item} ${ultimo ? estilos.ultimo : ''}`}>
              {m.ruta && !ultimo
                ? <Link href={m.ruta} className={estilos.enlace}>{m.nombre}</Link>
                : <span aria-current={ultimo ? 'page' : undefined}>{m.nombre}</span>}
              {!ultimo && <span className={estilos.sep} aria-hidden="true">›</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
