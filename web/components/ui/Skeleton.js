import estilos from './Skeleton.module.css';

// Esqueleto de carga.
// - variante: 'linea' (una línea), 'texto' (varias líneas, la última más corta), 'bloque' (recuadro) o 'circulo'.
// - `anunciar` (por defecto sí): el conjunto se anuncia una vez como "Cargando" (role="status", aria-busy).
//   Ponlo en false cuando varios esqueletos están dentro de un mismo contenedor que ya anuncia la carga.
// - Los bloques en sí son decorativos y se ocultan a los lectores de pantalla.
// - Con prefers-reduced-motion no hay brillo animado.
export default function Skeleton({ variante = 'linea', lineas = 3, ancho, alto, anunciar = true, etiqueta = 'Cargando', className }) {
  const medida = { width: ancho, height: alto };
  let bloques;

  if (variante === 'texto') {
    const n = Math.max(1, Math.min(12, Math.round(lineas)));
    bloques = Array.from({ length: n }, (_, i) => (
      <div key={i} aria-hidden="true" className={`${estilos.bloque} ${estilos.linea} ${i === n - 1 && n > 1 ? estilos.ultima : ''}`} style={{ width: i === n - 1 && n > 1 ? undefined : ancho }} />
    ));
  } else if (variante === 'bloque') {
    bloques = <div aria-hidden="true" className={`${estilos.bloque} ${estilos.recuadro}`} style={medida} />;
  } else if (variante === 'circulo') {
    const d = ancho ?? alto ?? 48;
    bloques = <div aria-hidden="true" className={`${estilos.bloque} ${estilos.circulo}`} style={{ width: d, height: d }} />;
  } else {
    bloques = <div aria-hidden="true" className={`${estilos.bloque} ${estilos.linea}`} style={medida} />;
  }

  const clases = [estilos.contenedor, className].filter(Boolean).join(' ');
  if (!anunciar) return <div className={clases}>{bloques}</div>;

  return (
    <div className={clases} role="status" aria-busy="true">
      <span className={estilos.soloLector}>{etiqueta}</span>
      {bloques}
    </div>
  );
}
