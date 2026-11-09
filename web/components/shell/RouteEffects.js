'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { tituloDeRuta } from '@/lib/domain/navegacion';

// Actualiza el título del documento por pantalla ("Metas · Cerebro de Lu") sin tocar las páginas.
// El anuncio del cambio de pantalla a lectores de pantalla ya lo hace Next (next-route-announcer),
// que lee este título: no se agrega un segundo anunciador.
export default function RouteEffects() {
  const ruta = usePathname();
  useEffect(() => { document.title = tituloDeRuta(ruta, undefined, { desarrollo: process.env.NODE_ENV !== 'production' }); }, [ruta]);
  return null;
}
