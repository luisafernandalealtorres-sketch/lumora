'use client';
import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import ThemeToggle from '@/components/ui/ThemeToggle';
import ErrorState from '@/components/ui/ErrorState';
import { useSalir } from './useSalir';
import estilos from './UserMenu.module.css';

// Menú de cuenta: tema y cerrar sesión. Sin nombre ni foto todavía (se difiere a Home).
// Patrón de despliegue (botón + panel): Escape o clic fuera lo cierran y el foco vuelve al botón.
export default function UserMenu() {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef(null);
  const boton = useRef(null);
  const { salir, saliendo, error } = useSalir();

  useEffect(() => {
    if (!abierto) return undefined;
    function fuera(e) { if (raiz.current && !raiz.current.contains(e.target)) setAbierto(false); }
    function tecla(e) {
      if (e.key === 'Escape') { setAbierto(false); boton.current?.focus(); }
    }
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', tecla); };
  }, [abierto]);

  return (
    <div className={estilos.raiz} ref={raiz}>
      <button
        ref={boton}
        type="button"
        className={estilos.boton}
        onClick={() => setAbierto(v => !v)}
        aria-expanded={abierto}
        aria-controls="menu-cuenta"
        aria-label="Cuenta"
      >
        <Icon name="user" size={18} />
      </button>
      {abierto && (
        <div id="menu-cuenta" className={estilos.panel} role="group" aria-label="Cuenta">
          <p className={estilos.rotulo}>Tema</p>
          <ThemeToggle />
          <button type="button" className={estilos.salir} onClick={salir} disabled={saliendo}>
            {saliendo ? 'Saliendo…' : 'Salir'}
          </button>
          {error && <ErrorState compacto titulo="No se pudo cerrar la sesión" mensaje="Intenta de nuevo." onReintentar={salir} />}
        </div>
      )}
    </div>
  );
}
