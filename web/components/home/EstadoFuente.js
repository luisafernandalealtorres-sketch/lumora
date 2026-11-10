import { mensajeVacio } from '@/lib/domain/fuentes';

// Estado de una fuente de Home sin datos. «Fuente no conectada» NO es un día vacío: nadie escribe en esa fuente.
// Usa las clases globales heredadas (.empty, .sub) para no alterar el aspecto de Mi día.
export default function EstadoFuente({ estado }) {
  const m = mensajeVacio(estado);
  if (!m) return null;
  const noConectada = estado.estado === 'no_conectada';
  return (
    <p className="empty" role={noConectada ? 'note' : undefined} data-fuente={estado.fuente.id} data-estado={estado.estado}>
      {noConectada ? <b>{m.titulo}</b> : m.titulo}
      {m.detalle && <span className="sub" style={{ display: 'block' }}>{m.detalle} Esto no significa que no tengas {estado.fuente.id === 'agenda' ? 'eventos' : estado.fuente.id === 'correos' ? 'correos' : 'resumen'}: no hay nada alimentando esta fuente.</span>}
    </p>
  );
}
