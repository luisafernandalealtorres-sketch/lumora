'use client';
import { useEffect, useRef } from 'react';

const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Comportamiento común de los diálogos modales del shell (hoja "Más", más adelante paleta y asistente):
// enfoca el primer control al abrir, atrapa el Tab, cierra con Escape y devuelve el foco a quien lo abrió.
export function useDialogo(ref, abierto, cerrar) {
  const previo = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    previo.current = document.activeElement;
    const nodo = ref.current;
    const lista = () => (nodo ? [...nodo.querySelectorAll(ENFOCABLES)].filter(e => e.offsetParent !== null) : []);
    (lista()[0] ?? nodo)?.focus();
    const raiz = document.documentElement;
    const overflowPrevio = raiz.style.overflow;
    raiz.style.overflow = 'hidden';

    function alTeclear(e) {
      if (e.key === 'Escape') { e.stopPropagation(); cerrar(); return; }
      if (e.key !== 'Tab') return;
      const items = lista();
      if (!items.length) { e.preventDefault(); return; }
      const primero = items[0];
      const ultimo = items[items.length - 1];
      if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
      else if (!nodo.contains(document.activeElement)) { e.preventDefault(); primero.focus(); }
    }
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('keydown', alTeclear);
      raiz.style.overflow = overflowPrevio;
      const volver = previo.current;
      if (volver && document.contains(volver)) volver.focus();
    };
  }, [abierto, ref, cerrar]);
}
