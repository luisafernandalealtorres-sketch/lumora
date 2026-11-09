// Fechas con la zona horaria de Colombia (America/Bogota, UTC-5 todo el año, sin horario de verano).
// Lógica pura, sin dependencias, con pruebas en tests/fechas.test.mjs.
//
// - Las fechas de calendario se representan como texto "AAAA-MM-DD". La aritmética de días se hace sobre
//   el calendario (a mediodía UTC), nunca sobre horas, así que no hay saltos por cambios de hora.
// - Toda función que depende de "ahora" recibe un `ahora` opcional (por defecto new Date()),
//   para poder probarla con instantes fijos.
// - Los nombres de días y meses están escritos aquí (no vienen de Intl) para que el resultado no cambie
//   entre navegadores ni versiones de Node.

const DESFASE_BOGOTA_MS = -5 * 60 * 60 * 1000;
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const pad = n => String(n).padStart(2, '0');
const aISO = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

// Instante desplazado a hora de Bogotá, leído con los getters UTC.
const enBogota = ahora => new Date(ahora.getTime() + DESFASE_BOGOTA_MS);
const mediodiaUTC = iso => new Date(`${iso}T12:00:00Z`);

/** ¿Es un texto "AAAA-MM-DD" que corresponde a un día real del calendario? */
export function esFechaISO(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const d = mediodiaUTC(valor);
  return !Number.isNaN(d.getTime()) && aISO(d) === valor;
}

function exigirFecha(valor) {
  if (!esFechaISO(valor)) throw new RangeError(`Fecha inválida: ${JSON.stringify(valor)}. Se esperaba "AAAA-MM-DD".`);
  return valor;
}

/** Fecha de hoy en Bogotá, "AAAA-MM-DD". */
export function fechaBogota(ahora = new Date()) {
  return aISO(enBogota(ahora));
}

/** Mes actual en Bogotá, "AAAA-MM". */
export function mesBogota(ahora = new Date()) {
  return fechaBogota(ahora).slice(0, 7);
}

/** Hora actual en Bogotá, entero de 0 a 23. */
export function horaBogota(ahora = new Date()) {
  return enBogota(ahora).getUTCHours();
}

/** Suma (o resta) días de calendario a una fecha. */
export function sumarDias(fecha, n) {
  const d = mediodiaUTC(exigirFecha(fecha));
  d.setUTCDate(d.getUTCDate() + Math.trunc(n));
  return aISO(d);
}

/** Días de calendario entre dos fechas (b - a). */
export function diasEntre(a, b) {
  return Math.round((mediodiaUTC(exigirFecha(b)) - mediodiaUTC(exigirFecha(a))) / 864e5);
}

/** Día de la semana: 0 = lunes … 6 = domingo (la semana empieza el lunes). */
export function diaDeSemana(fecha) {
  return (mediodiaUTC(exigirFecha(fecha)).getUTCDay() + 6) % 7;
}

/** Lunes de la semana de una fecha. */
export function inicioSemana(fecha) {
  return sumarDias(fecha, -diaDeSemana(fecha));
}

/** Los 7 días (lunes a domingo) de la semana de una fecha. */
export function diasDeLaSemana(fecha) {
  const lunes = inicioSemana(fecha);
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
}

/** Último día de un mes (28 a 31). `mes` va de 1 a 12. */
export function ultimoDiaMes(anio, mes) {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

/** "Domingo, 8 de noviembre". */
export function etiquetaFecha(fecha) {
  const d = mediodiaUTC(exigirFecha(fecha));
  const dia = DIAS[d.getUTCDay()];
  return `${dia[0].toUpperCase()}${dia.slice(1)}, ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}

/** Saludo según la hora de Bogotá: 5 a 11 días, 12 a 18 tardes, 19 a 4 noches. */
export function saludo(hora) {
  if (!Number.isInteger(hora) || hora < 0 || hora > 23) throw new RangeError(`Hora inválida: ${hora}`);
  if (hora >= 5 && hora < 12) return 'Buenos días';
  if (hora >= 12 && hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}
