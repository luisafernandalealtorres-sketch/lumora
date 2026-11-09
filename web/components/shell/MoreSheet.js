'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import ThemeToggle from '@/components/ui/ThemeToggle';
import ErrorState from '@/components/ui/ErrorState';
import { gruposConElementos, esActivo } from '@/lib/domain/navegacion';
import { visibleEnShell } from './acciones';
import { useShell } from './ShellProvider';
import { useDialogo } from './useDialogo';
import { useSalir } from './useSalir';
import estilos from './MoreSheet.module.css';

// Hoja inferior "Más" (móvil): todo lo que no cabe en la barra inferior, el tema y salir.
// Diálogo modal: atrapa el foco, se cierra con Escape, con el botón o tocando el fondo.
export default function MoreSheet({ desarrollo }) {
  const ruta = usePathname();
  const { masAbierto, cerrarMas } = useShell();
  const panel = useRef(null);
  const { salir, saliendo, error } = useSalir();
  useDialogo(panel, masAbierto, cerrarMas);

  // Cambiar de pantalla cierra la hoja.
  useEffect(() => { cerrarMas(); }, [ruta]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!masAbierto) return null;

  const grupos = gruposConElementos({ desarrollo })
    .map(g => ({ ...g, elementos: g.elementos.filter(e => !e.barraMovil && visibleEnShell(e)) }))
    .filter(g => g.elementos.length);

  return (
    <div className={estilos.fondo} onMouseDown={e => { if (e.target === e.currentTarget) cerrarMas(); }}>
      <div ref={panel} className={estilos.hoja} role="dialog" aria-modal="true" aria-labelledby="mas-titulo">
        <div className={estilos.asa} aria-hidden="true" />
        <div className={estilos.cabecera}>
          <h2 id="mas-titulo" className={estilos.titulo}>Más</h2>
          <button type="button" className={estilos.cerrar} onClick={cerrarMas} aria-label="Cerrar">
            <Icon name="x" size={20} />
          </button>
        </div>

        <div className={estilos.cuerpo}>
          {grupos.map(g => (
            <section key={g.id} className={estilos.grupo} aria-labelledby={`mas-${g.id}`}>
              <h3 id={`mas-${g.id}`} className={estilos.rotulo}>{g.nombre}</h3>
              <ul className={estilos.lista}>
                {g.elementos.map(e => {
                  const activo = esActivo(e, ruta);
                  return (
                    <li key={e.id} className={estilos.item}>
                      <Link href={e.ruta} className={`${estilos.enlace} ${e.padre ? estilos.hijo : ''} ${activo ? estilos.activo : ''}`} aria-current={activo ? 'page' : undefined}>
                        <Icon name={e.icono} size={20} />
                        <span>{e.nombre}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          <div className={estilos.ajustes}>
            <p className={estilos.rotulo}>Tema</p>
            <ThemeToggle />
            <button type="button" className={estilos.salir} onClick={salir} disabled={saliendo}>
              <Icon name="arrowRight" size={18} />
              {saliendo ? 'Saliendo…' : 'Salir'}
            </button>
            {error && <ErrorState compacto titulo="No se pudo cerrar la sesión" mensaje="Intenta de nuevo." onReintentar={salir} />}
          </div>
        </div>
      </div>
    </div>
  );
}
