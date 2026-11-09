import Icon from './Icon';
import Skeleton from './Skeleton';
import EmptyState from './EmptyState';
import ErrorState from './ErrorState';
import { resolverEstado } from '@/lib/ui/estados';
import estilos from './EstadoDatos.module.css';

// Envoltorio que obliga a cada widget a decidir los cinco estados de datos de la especificación:
//   cargando · vacio · error · parcial · ok
// - `estado`: uno de los cinco. Cualquier otro valor se muestra como ERROR, nunca como vacío.
//   Para derivarlo de una consulta usa estadoDeConsulta() de '@/lib/ui/estados'.
// - `cargando`, `vacio`, `error`: contenido propio de cada estado. Si falta, se usa uno genérico.
// - `parcial`: muestra `children` con un aviso encima (`aviso`) que explica qué falta.
// - `onReintentar`: se pasa al ErrorState genérico. Solo puede usarse desde un componente cliente.
export default function EstadoDatos({ estado, cargando, vacio, error, aviso, onReintentar, children }) {
  const e = resolverEstado(estado);
  if (e !== estado && process.env.NODE_ENV !== 'production') console.warn(`EstadoDatos: estado desconocido "${estado}"; se muestra como error`);

  if (e === 'cargando') return cargando ?? <Skeleton variante="texto" lineas={3} />;
  if (e === 'vacio') return vacio ?? <EmptyState titulo="Todavía no hay nada aquí" descripcion="Cuando haya datos, los verás en este lugar." />;
  if (e === 'error') return error ?? <ErrorState onReintentar={onReintentar} />;
  if (e === 'parcial') {
    return (
      <div className={estilos.parcial}>
        <div className={estilos.aviso} role="status">
          <Icon name="info" size={18} className={estilos.iconoAviso} />
          <span>{aviso ?? 'Mostrando datos parciales: faltan algunos para completar esta vista.'}</span>
        </div>
        {children}
      </div>
    );
  }
  return <>{children}</>;
}
