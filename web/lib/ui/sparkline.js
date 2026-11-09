// Cálculo de la minigráfica de tendencia. Puro, con pruebas en tests/sparkline.test.mjs.
//
// - Solo se usan valores numéricos finitos; el resto se descarta (no se interpola ni se inventa).
// - Con menos de 2 valores válidos devuelve "insuficiente": no hay tendencia que dibujar.
// - Todas las coordenadas quedan dentro del recuadro, respetando el margen.

const redondear = n => Math.round(n * 100) / 100;

/**
 * @param {unknown} puntos Serie de valores en orden temporal.
 * @param {{ ancho?: number, alto?: number, margen?: number, meta?: number }} opciones
 *   `meta` es una línea de referencia opcional; si se da, entra en el rango vertical.
 */
export function prepararSerie(puntos, { ancho = 120, alto = 36, margen = 4, meta } = {}) {
  const validos = Array.isArray(puntos) ? puntos.filter(v => typeof v === 'number' && Number.isFinite(v)) : [];
  if (validos.length < 2) return { estado: 'insuficiente', cantidad: validos.length };

  const hayMeta = typeof meta === 'number' && Number.isFinite(meta);
  const rango = hayMeta ? [...validos, meta] : validos;
  let min = Math.min(...rango);
  let max = Math.max(...rango);
  if (min === max) { min -= 1; max += 1; } // serie plana: línea al centro, sin dividir por cero

  const x = i => margen + (i / (validos.length - 1)) * (ancho - 2 * margen);
  const y = v => margen + (1 - (v - min) / (max - min)) * (alto - 2 * margen);

  const pts = validos.map((valor, i) => ({ x: redondear(x(i)), y: redondear(y(valor)), valor }));
  const trazo = 'M' + pts.map(p => `${p.x} ${p.y}`).join('L');
  const base = redondear(alto - margen);

  return {
    estado: 'ok',
    cantidad: validos.length,
    puntos: pts,
    trazo,
    area: `${trazo}L${pts[pts.length - 1].x} ${base}L${pts[0].x} ${base}Z`,
    ultimo: pts[pts.length - 1],
    min: Math.min(...validos),
    max: Math.max(...validos),
    yMeta: hayMeta ? redondear(y(meta)) : null,
    ancho,
    alto,
    margen,
  };
}

/** Descripción para lectores de pantalla. */
export function describirSerie(etiqueta, serie, formato = n => String(n)) {
  if (serie.estado !== 'ok') return `${etiqueta}: datos insuficientes`;
  return `${etiqueta}: ${serie.cantidad} puntos, de ${formato(serie.min)} a ${formato(serie.max)}, último ${formato(serie.ultimo.valor)}`;
}
