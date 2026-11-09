import Icon from './Icon';
import estilos from './EmptyState.module.css';

// Estado vacío: aún no hay nada que mostrar, y el sistema funciona bien.
// Explica qué aparecerá aquí y, en `children`, ofrece cómo agregar el primer dato.
// No es un error: para eso está ErrorState. Un error nunca se muestra como vacío.
export default function EmptyState({ icono = 'sparkles', titulo, descripcion, compacto = false, className, children }) {
  const clases = [estilos.vacio, compacto ? estilos.compacto : '', className].filter(Boolean).join(' ');
  return (
    <div className={clases}>
      <span className={estilos.icono} aria-hidden="true">
        <Icon name={icono} size={compacto ? 20 : 28} />
      </span>
      <div className={estilos.texto}>
        <p className={estilos.titulo}>{titulo}</p>
        {descripcion && <p className={estilos.descripcion}>{descripcion}</p>}
      </div>
      {children && <div className={estilos.accion}>{children}</div>}
    </div>
  );
}
