'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// Estado compartido mínimo del shell: barra lateral expandida o riel, y los diálogos (hoja "Más",
// búsqueda, asistente). Solo uno está abierto a la vez. La preferencia de la barra se guarda en el
// navegador (comodidad por dispositivo); se lee en un efecto para que el primer pintado coincida con el del servidor.
const CLAVE_RIEL = 'sb-shell-rail';
const Ctx = createContext(null);

export function ShellProvider({ children }) {
  const [riel, setRiel] = useState(false);
  const [abierto, setAbierto] = useState(null); // null | 'mas' | 'buscar' | 'asistente'

  useEffect(() => {
    try { setRiel(window.localStorage.getItem(CLAVE_RIEL) === '1'); } catch { /* sin almacenamiento: expandida */ }
  }, []);

  // Ctrl/Cmd + K abre o cierra la búsqueda, también con el foco en un campo de texto.
  useEffect(() => {
    function tecla(e) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setAbierto(a => (a === 'buscar' ? null : 'buscar'));
      }
    }
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, []);

  const alternarRiel = useCallback(() => {
    setRiel(v => {
      const n = !v;
      try { window.localStorage.setItem(CLAVE_RIEL, n ? '1' : '0'); } catch { /* sin almacenamiento */ }
      return n;
    });
  }, []);

  const cerrar = useCallback(() => setAbierto(null), []);
  const cerrarMas = useCallback(() => setAbierto(a => (a === 'mas' ? null : a)), []);

  const valor = useMemo(() => ({
    riel, alternarRiel,
    abierto, cerrar,
    masAbierto: abierto === 'mas', abrirMas: () => setAbierto('mas'), cerrarMas,
    buscarAbierto: abierto === 'buscar', abrirBuscar: () => setAbierto('buscar'),
    asistenteAbierto: abierto === 'asistente',
    abrirAsistente: () => setAbierto('asistente'),
    alternarAsistente: () => setAbierto(a => (a === 'asistente' ? null : 'asistente')),
  }), [riel, alternarRiel, abierto, cerrar, cerrarMas]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useShell() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useShell debe usarse dentro de <ShellProvider>');
  return v;
}
