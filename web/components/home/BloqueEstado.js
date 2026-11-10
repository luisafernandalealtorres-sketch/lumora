import Icon from '@/components/ui/Icon';
import { TEXTO_ESTADO } from '@/lib/domain/estadosHome';
import estilos from './Home.module.css';

// Estado de un bloque sin datos. Los estados son DISTINTOS (Sin datos, Sin registros, Fuente no conectada, Error de lectura,
// Fase 3 aún no activada): cada uno con su texto, su icono y su tono; el color nunca es la única señal.
// `corto`: versión de una línea (la explicación larga de la Fase 3 se muestra una sola vez en Home).
export default function BloqueEstado({ estado, detalle, compacto = false, corto = false }) {
  const e = TEXTO_ESTADO[estado];
  if (!e) return null;
  const texto = detalle ?? (corto && e.corto ? e.corto : e.detalle);
  return (
    <p className={`${estilos.estadoBloque} ${estilos[`tono_${e.tono}`]} ${compacto || corto ? estilos.compacto : ''}`} role={estado === 'error_lectura' ? 'alert' : 'note'} data-estado={estado}>
      <Icon name={e.icono} size={16} />
      <span><b>{e.titulo}.</b> {texto}</span>
    </p>
  );
}
