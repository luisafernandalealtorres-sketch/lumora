// Geometría del anillo de progreso. Pura, con pruebas en tests/anillo.test.mjs.
// Un valor ausente o inválido da estado "sin-datos" y arco de longitud 0: nunca se dibuja un porcentaje inventado.
import { normalizarProgreso } from './progreso.js';

const TAMANO_MINIMO = 16;

export function geometriaAnillo({ tamano = 96, grosor = 10, valor } = {}) {
  const t = Number.isFinite(tamano) && tamano > 0 ? Math.max(TAMANO_MINIMO, tamano) : 96;
  let g = Number.isFinite(grosor) && grosor > 0 ? grosor : 10;
  g = Math.min(g, t / 2 - 1); // el trazo nunca llega al centro: el radio siempre es positivo

  const radio = (t - g) / 2;
  const circunferencia = 2 * Math.PI * radio;
  const p = normalizarProgreso(valor);

  return {
    tamano: t,
    grosor: g,
    centro: t / 2,
    radio,
    circunferencia,
    longitudArco: p.estado === 'ok' ? p.fraccion * circunferencia : 0,
    estado: p.estado,
    porcentaje: p.porcentaje,
  };
}
