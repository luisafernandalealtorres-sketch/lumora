import Skeleton from '@/components/ui/Skeleton';

// Estado de carga de las pantallas: se anuncia una sola vez ("Cargando") y sus bloques son decorativos.
export default function Loading() {
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <Skeleton variante="linea" ancho="40%" alto={36} etiqueta="Cargando la pantalla" />
      <Skeleton variante="bloque" alto={96} anunciar={false} />
      <Skeleton variante="bloque" alto={220} anunciar={false} />
    </div>
  );
}
