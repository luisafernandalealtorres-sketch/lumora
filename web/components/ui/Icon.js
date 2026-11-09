import { ICONOS } from './icons';
import estilos from './Icon.module.css';

// Icono SVG propio. Usa el color del texto que lo rodea (currentColor).
// - Sin `title`: es decorativo y se oculta a los lectores de pantalla (el texto cercano ya lo explica).
// - Con `title`: se anuncia como imagen con ese nombre. Úsalo cuando el icono va solo.
export default function Icon({ name, size = 20, title, className, ...resto }) {
  const def = ICONOS[name];
  if (!def) {
    if (process.env.NODE_ENV !== 'production') console.warn(`Icon: no existe el icono "${name}"`);
    return null;
  }
  const decorativo = !title;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={def.sw ?? 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      aria-hidden={decorativo ? 'true' : undefined}
      role={decorativo ? undefined : 'img'}
      aria-label={decorativo ? undefined : title}
      className={`${estilos.icono} ${className ?? ''}`.trim()}
      {...resto}
    >
      {def.d.map((trazo, i) => <path key={i} d={trazo} />)}
    </svg>
  );
}
