'use client';
import { useEffect, useId, useRef, useState } from 'react';
import estilos from './Desplegable.module.css';

// Botón + panel flotante (patrón de despliegue). Escape o clic fuera lo cierran y el foco vuelve al botón.
// `children` puede ser una función que recibe `cerrar`.
export default function Desplegable({ boton, etiqueta, claseBoton, ancho, children, titulo }) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef(null);
  const btn = useRef(null);
  const id = useId();

  useEffect(() => {
    if (!abierto) return undefined;
    function fuera(e) { if (raiz.current && !raiz.current.contains(e.target)) setAbierto(false); }
    function tecla(e) { if (e.key === 'Escape') { setAbierto(false); btn.current?.focus(); } }
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', tecla); };
  }, [abierto]);

  const cerrar = () => { setAbierto(false); btn.current?.focus(); };

  return (
    <div className={estilos.raiz} ref={raiz}>
      <button
        ref={btn}
        type="button"
        className={claseBoton ?? estilos.boton}
        onClick={() => setAbierto(v => !v)}
        aria-expanded={abierto}
        aria-controls={id}
        aria-label={etiqueta}
      >
        {boton}
      </button>
      {abierto && (
        <div id={id} className={estilos.panel} style={ancho ? { width: ancho } : undefined} role="group" aria-label={titulo ?? etiqueta}>
          {typeof children === 'function' ? children(cerrar) : children}
        </div>
      )}
    </div>
  );
}
