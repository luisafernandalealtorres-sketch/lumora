'use client';
import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { frenteDeBusqueda, busquedaConFrente, enlaceConFrente, aplicaFiltro } from '@/lib/domain/frenteActivo';
import { itemDeRuta } from '@/lib/domain/navegacion';

// Frente activo del shell, guardado en la URL (?frente=<id>). Requiere un límite <Suspense> arriba.
export function useFrenteActivo() {
  const params = useSearchParams();
  const ruta = usePathname();
  const router = useRouter();
  const busqueda = params.toString();
  const frente = frenteDeBusqueda(busqueda);
  const item = itemDeRuta(ruta);

  const elegir = useCallback((id) => {
    router.replace(`${ruta}${busquedaConFrente(busqueda, id)}`, { scroll: false });
  }, [router, ruta, busqueda]);

  return {
    frente,
    elegir,
    quitar: () => elegir(null),
    enlace: r => enlaceConFrente(r, frente),
    // ¿La pantalla actual aplica el filtro? Mientras no, el shell lo dice y no simula filtrado.
    pantallaAplica: !!item && aplicaFiltro(item.id),
  };
}
