'use client';
import { useEffect, useRef, useState } from 'react';
import { TEMAS, CLAVE_TEMA, leerTema, aplicarTema } from '@/lib/theme';
import estilos from './ThemeToggle.module.css';

const ETIQUETAS = { light: 'Claro', dark: 'Oscuro', system: 'Sistema' };

// Selector de tema en tres opciones. Grupo de radio accesible: flechas para moverse, foco visible.
export default function ThemeToggle() {
  const [tema, setTema] = useState('system');
  const refs = useRef({});

  useEffect(() => {
    setTema(leerTema());
    // Si otra pestaña cambia el tema, esta se entera.
    const alCambiar = e => {
      if (e.key === CLAVE_TEMA || e.key === null) {
        const t = leerTema();
        setTema(t);
        aplicarTema(t);
      }
    };
    window.addEventListener('storage', alCambiar);
    return () => window.removeEventListener('storage', alCambiar);
  }, []);

  function elegir(t) {
    setTema(t);
    aplicarTema(t);
  }

  function alTeclear(e, i) {
    let j = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % TEMAS.length;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i + TEMAS.length - 1) % TEMAS.length;
    if (j === null) return;
    e.preventDefault();
    elegir(TEMAS[j]);
    refs.current[TEMAS[j]]?.focus();
  }

  return (
    <div className={estilos.grupo} role="radiogroup" aria-label="Tema de color">
      {TEMAS.map((t, i) => (
        <button
          key={t}
          ref={el => { refs.current[t] = el; }}
          type="button"
          role="radio"
          aria-checked={tema === t}
          tabIndex={tema === t ? 0 : -1}
          className={`${estilos.opcion} ${tema === t ? estilos.activa : ''}`}
          onClick={() => elegir(t)}
          onKeyDown={e => alTeclear(e, i)}
        >
          {ETIQUETAS[t]}
        </button>
      ))}
    </div>
  );
}
