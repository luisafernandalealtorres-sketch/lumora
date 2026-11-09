import { prepararSerie, describirSerie } from '@/lib/ui/sparkline';
import { resolverTono } from '@/lib/ui/tonos';
import estilos from './Sparkline.module.css';

const formato = n => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(n);

// Minigráfica de tendencia.
// - `puntos`: serie de valores en orden temporal. Solo cuentan los números finitos; nada se interpola.
// - Con menos de 2 valores válidos muestra "Datos insuficientes" en lugar de una línea inventada.
// - `etiqueta`: obligatoria; el lector de pantalla recibe un resumen ("Gasto: 6 puntos, de 2 a 9, último 5").
//   Se puede reemplazar con `descripcion`.
// - `meta`: línea de referencia opcional (entra en el rango vertical).
export default function Sparkline({ puntos, etiqueta, descripcion, tono = 'primario', ancho = 120, alto = 36, meta, mostrarUltimo = true, className }) {
  const s = prepararSerie(puntos, { ancho, alto, meta });
  const t = resolverTono({ tono });
  const clases = [estilos.contenedor, className].filter(Boolean).join(' ');

  if (s.estado === 'insuficiente') {
    return (
      <div className={`${clases} ${estilos.insuficiente}`} style={{ width: ancho, height: alto }} role="img" aria-label={describirSerie(etiqueta, s)}>
        <span aria-hidden="true">Datos insuficientes</span>
      </div>
    );
  }

  return (
    <svg
      className={`${clases} ${estilos.svg}`}
      width={ancho}
      height={alto}
      viewBox={`0 0 ${ancho} ${alto}`}
      role="img"
      aria-label={descripcion ?? describirSerie(etiqueta, s, formato)}
      focusable="false"
    >
      <path className={estilos[`area_${t}`]} d={s.area} />
      {s.yMeta !== null && <line className={estilos.meta} x1={s.margen} x2={ancho - s.margen} y1={s.yMeta} y2={s.yMeta} />}
      <path className={`${estilos.linea} ${estilos[`linea_${t}`]}`} d={s.trazo} />
      {mostrarUltimo && <circle className={estilos[`punto_${t}`]} cx={s.ultimo.x} cy={s.ultimo.y} r="3" />}
    </svg>
  );
}
