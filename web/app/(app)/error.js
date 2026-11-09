'use client';
import ErrorState from '@/components/ui/ErrorState';

// Error de una pantalla: se anuncia (role="alert") y ofrece reintentar. Un error nunca se muestra como "sin datos".
export default function Error({ error, reset }) {
  return (
    <ErrorState
      titulo="No pudimos cargar esta pantalla"
      mensaje="Hubo un problema al consultar tus datos. Tus datos no se perdieron: esto es un error de lectura, no una pantalla vacía."
      detalle={error?.digest ? `Código del error: ${error.digest}` : undefined}
      onReintentar={() => reset()}
    />
  );
}
