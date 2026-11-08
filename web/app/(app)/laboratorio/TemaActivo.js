'use client';
import { useEffect, useState } from 'react';
import estilos from './laboratorio.module.css';

// Muestra qué tema se está aplicando de verdad: lo forzado (data-theme) o el del sistema.
export default function TemaActivo() {
  const [texto, setTexto] = useState('…');

  useEffect(() => {
    const el = document.documentElement;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const actualizar = () => {
      const forzado = el.getAttribute('data-theme');
      const efectivo = forzado ?? (mq.matches ? 'dark' : 'light');
      setTexto(`Se ve en ${efectivo === 'dark' ? 'oscuro' : 'claro'}${forzado ? ' (forzado)' : ' (según el sistema)'}`);
    };
    actualizar();
    mq.addEventListener('change', actualizar);
    const obs = new MutationObserver(actualizar);
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
    return () => { mq.removeEventListener('change', actualizar); obs.disconnect(); };
  }, []);

  return <span className={estilos.indicador} role="status">{texto}</span>;
}
