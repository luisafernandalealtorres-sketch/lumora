import Icon from './Icon';
import estilos from './Card.module.css';

const ETIQUETAS_CON_NOMBRE = ['section', 'article', 'aside'];

// Superficie base de los widgets.
// - `as`: etiqueta HTML. Si es section, article o aside y hay `id` y `titulo`, el título nombra la región.
// - `nivel`: nivel del encabezado del título (2 a 4). Elige el que corresponda en la jerarquía de la página.
// - `variante`: 'elevada' (con borde y sombra) o 'plana' (sin sombra).
// - `relleno`: 'md' (por defecto), 'sm' o 'ninguno'.
// - `accion`: contenido a la derecha del título (un botón, un selector).
export default function Card({
  as: Etiqueta = 'div',
  titulo,
  nivel = 2,
  icono,
  accion,
  variante = 'elevada',
  relleno = 'md',
  id,
  className,
  children,
  ...resto
}) {
  const Encabezado = `h${Math.min(4, Math.max(2, nivel))}`;
  const idTitulo = id && titulo ? `${id}-titulo` : undefined;
  const nombraRegion = idTitulo && ETIQUETAS_CON_NOMBRE.includes(Etiqueta);
  const conCabecera = titulo || icono || accion;
  const clases = [estilos.card, estilos[`v_${variante}`], estilos[`r_${relleno}`], className].filter(Boolean).join(' ');

  return (
    <Etiqueta id={id} className={clases} aria-labelledby={nombraRegion ? idTitulo : undefined} {...resto}>
      {conCabecera && (
        <div className={estilos.cabecera}>
          <div className={estilos.encabezado}>
            {icono && <Icon name={icono} size={20} className={estilos.icono} />}
            {titulo && <Encabezado id={idTitulo} className={estilos.titulo}>{titulo}</Encabezado>}
          </div>
          {accion && <div className={estilos.accion}>{accion}</div>}
        </div>
      )}
      <div className={estilos.cuerpo}>{children}</div>
    </Etiqueta>
  );
}
