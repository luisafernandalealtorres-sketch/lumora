// Costo y tope de gasto del asistente. Lógica pura.
//
// Los precios son USD por millón de tokens (tarifas de la API de Anthropic al 2026-11; hay que revisarlas si cambian).
// Haiku 5.5 cobra más si el mensaje pasa de 100.000 tokens; el asistente envía mucho menos, pero se calcula igual.
// El caché de lectura se cobra aquí como el 10 % de la entrada (estimación prudente: puede costar menos).

export const MODELO_POR_DEFECTO = 'claude-haiku-5-5';

export const PRECIOS = {
  'claude-haiku-5-5': { entrada: 0.10, salida: 0.50, umbral: 100000, entradaLarga: 0.50, salidaLarga: 2.50 },
  'claude-haiku-4-5': { entrada: 1.00, salida: 5.00 },
  'claude-sonnet-5-5': { entrada: 2.00, salida: 10.00 },
  'claude-opus-5-5': { entrada: 4.00, salida: 20.00 },
};

const MAS_CARO = Object.values(PRECIOS).reduce((m, p) => (p.salida > m.salida ? p : m));

/**
 * Costo en USD de una respuesta a partir de `usage`. Un modelo desconocido se cobra a la tarifa más cara (nunca se subestima).
 * @param {string} modelo
 * @param {{input_tokens?:number, output_tokens?:number, cache_creation_input_tokens?:number, cache_read_input_tokens?:number}} uso
 */
export function costoUsd(modelo, uso) {
  const p = PRECIOS[modelo] ?? MAS_CARO;
  const n = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const entrada = n(uso?.input_tokens), salida = n(uso?.output_tokens);
  const escritura = n(uso?.cache_creation_input_tokens), lectura = n(uso?.cache_read_input_tokens);
  const larga = p.umbral && entrada + escritura + lectura > p.umbral;
  const pe = larga ? p.entradaLarga : p.entrada, ps = larga ? p.salidaLarga : p.salida;
  return ((entrada + escritura * 1.25 + lectura * 0.1) * pe + salida * ps) / 1e6;
}

/**
 * Estado del tope mensual. `aviso` se activa desde el 80 %; `ok` es false al llegar al tope (no se debe llamar a la API).
 * Un tope inválido o cero cuenta como sin permiso: nunca se gasta sin un tope claro.
 */
export function estadoPresupuesto({ gastadoUsd, topeUsd }) {
  const tope = Number(topeUsd), gastado = Math.max(0, Number(gastadoUsd) || 0);
  if (!Number.isFinite(tope) || tope <= 0) return { ok: false, motivo: 'sin_tope', porcentaje: null, aviso: false, restanteUsd: 0 };
  const porcentaje = gastado / tope;
  return { ok: gastado < tope, motivo: gastado < tope ? null : 'tope_alcanzado', porcentaje, aviso: porcentaje >= 0.8, restanteUsd: Math.max(0, tope - gastado) };
}

/**
 * Parámetros de la petición que dependen del modelo. Haiku 5.5 usa pensamiento adaptativo (por defecto) y `effort`;
 * Haiku 4.5 no admite `effort` ni pensamiento adaptativo, así que no se envía nada de eso.
 */
export function parametrosDelModelo(modelo, esfuerzo = 'low') {
  if (modelo === 'claude-haiku-4-5') return {};
  const niveles = ['low', 'medium', 'high', 'xhigh', 'max'];
  return { output_config: { effort: niveles.includes(esfuerzo) ? esfuerzo : 'low' } };
}

/** Mes de Bogotá como AAAA-MM, para sumar el gasto del mes. */
export function mesDe(fechaIso) {
  return new Date(fechaIso).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }).slice(0, 7);
}
