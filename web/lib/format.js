export const cop = n =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n) || 0);

export const hoyBogota = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
export const mesActual = () => hoyBogota().slice(0, 7);

export const esNegocio = slug => slug?.startsWith('ticketcode') || slug === 'tanku';

export const nombreMes = ym => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
};

export const fechaCorta = f =>
  new Date(f + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });

export const CATEGORIAS = ['Comida', 'Transporte', 'Servicios', 'Salud', 'Entretenimiento', 'Compras', 'Otros'];

// Días consecutivos con jornada, terminando hoy o ayer.
export function racha(fechas) {
  const set = new Set(fechas);
  const d = new Date(hoyBogota() + 'T12:00:00');
  if (!set.has(d.toLocaleDateString('en-CA'))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set.has(d.toLocaleDateString('en-CA'))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
