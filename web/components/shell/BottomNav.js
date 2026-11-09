'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { elementosBarraMovil, esActivo, masEstaActivo } from '@/lib/domain/navegacion';
import { useShell } from './ShellProvider';
import estilos from './BottomNav.module.css';

// Barra inferior móvil: tres accesos directos y "Más" (abre la hoja con el resto).
export default function BottomNav({ desarrollo }) {
  const ruta = usePathname();
  const { masAbierto, abrirMas } = useShell();
  const enMas = masEstaActivo(ruta, { desarrollo });

  return (
    <nav className={estilos.barra} aria-label="Principal (móvil)">
      <ul className={estilos.lista}>
        {elementosBarraMovil().map(e => {
          const activo = esActivo(e, ruta);
          return (
            <li key={e.id} className={estilos.item}>
              <Link href={e.ruta} className={`${estilos.acceso} ${activo ? estilos.activo : ''}`} aria-current={activo ? 'page' : undefined}>
                <Icon name={e.icono} size={22} />
                <span>{e.nombre}</span>
              </Link>
            </li>
          );
        })}
        <li className={estilos.item}>
          <button
            type="button"
            className={`${estilos.acceso} ${enMas ? estilos.activo : ''}`}
            onClick={abrirMas}
            aria-haspopup="dialog"
            aria-expanded={masAbierto}
          >
            <Icon name="more" size={22} />
            <span>Más</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
