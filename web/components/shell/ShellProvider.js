'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// Estado compartido mínimo del shell: barra lateral expandida o riel, y hoja "Más".
// La preferencia de la barra se guarda en el navegador (comodidad por dispositivo); se lee en un
// efecto para que el primer pintado coincida con el del servidor.
const CLAVE_RIEL = 'sb-shell-rail';
const Ctx = createContext(null);

export function ShellProvider({ children }) {
  const [riel, setRiel] = useState(false);
  const [masAbierto, setMasAbierto] = useState(false);

  useEffect(() => {
    try { setRiel(window.localStorage.getItem(CLAVE_RIEL) === '1'); } catch { /* sin almacenamiento: expandida */ }
  }, []);

  const alternarRiel = useCallback(() => {
    setRiel(v => {
      const n = !v;
      try { window.localStorage.setItem(CLAVE_RIEL, n ? '1' : '0'); } catch { /* sin almacenamiento */ }
      return n;
    });
  }, []);

  const valor = useMemo(() => ({
    riel, alternarRiel,
    masAbierto,
    abrirMas: () => setMasAbierto(true),
    cerrarMas: () => setMasAbierto(false),
  }), [riel, alternarRiel, masAbierto]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useShell() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useShell debe usarse dentro de <ShellProvider>');
  return v;
}
