import Icon from './Icon';
import { resolverTono, nombreDeFrente } from '@/lib/ui/tonos';
import estilos from './Chip.module.css';

// Etiqueta corta de estado o de frente.
// - `tono`: neutro, primario, exito, advertencia, peligro, o el id de un frente de diseño.
// - `frente`: slug original ("salud-abuela") o id de diseño ("familia"). Define el tono y, si no hay
//   `children`, el texto (el nombre del frente de diseño). Un frente desconocido sale en tono neutro.
// - El color nunca es la única señal: el chip siempre lleva texto.
export default function Chip({ tono, frente, tamano = 'md', icono, className, children, ...resto }) {
  const t = resolverTono({ tono, frente });
  const texto = children ?? nombreDeFrente(frente);
  const clases = [estilos.chip, estilos[`t_${t}`], estilos[`s_${tamano}`], className].filter(Boolean).join(' ');
  return (
    <span className={clases} {...resto}>
      {icono && <Icon name={icono} size={tamano === 'sm' ? 12 : 14} />}
      {texto}
    </span>
  );
}
