'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { gruposConElementos, esActivo } from '@/lib/domain/navegacion';
import { visibleEnShell } from './acciones';
import { useShell } from './ShellProvider';
import { useFrenteActivo } from './useFrenteActivo';
import estilos from './Sidebar.module.css';

// Barra lateral de escritorio y tablet. Expandida (≥1280 px, alternable) o riel de iconos.
// En modo riel el texto sigue en el DOM (oculto a la vista) para conservar el nombre accesible.
export default function Sidebar({ desarrollo }) {
  const ruta = usePathname();
  const { riel, alternarRiel, abrirAsistente, asistenteAbierto } = useShell();
  const { enlace } = useFrenteActivo();
  const grupos = gruposConElementos({ desarrollo })
    .map(g => ({ ...g, elementos: g.elementos.filter(visibleEnShell) }))
    .filter(g => g.elementos.length);

  return (
    <aside className={estilos.barra} data-riel={riel ? 'true' : 'false'}>
      <div className={estilos.marca}>
        <span className={estilos.logo} aria-hidden="true"><Icon name="layers" size={18} /></span>
        <span className={estilos.nombre}>Cerebro de Lu</span>
      </div>

      <nav className={estilos.nav} aria-label="Principal">
        {grupos.map((g, i) => (
          <div key={g.id} className={estilos.grupo}>
            {i > 0 && <hr className={estilos.separador} />}
            <p className={estilos.rotulo} id={`grupo-${g.id}`}>{g.nombre}</p>
            <ul className={estilos.lista} aria-labelledby={`grupo-${g.id}`}>
              {g.elementos.map(e => {
                const activo = esActivo(e, ruta, { desarrollo });
                if (e.accion) {
                  return (
                    <li key={e.id} className={estilos.item}>
                      <button type="button" className={`${estilos.enlace} ${estilos.boton}`} onClick={abrirAsistente} aria-expanded={asistenteAbierto} aria-controls="panel-asistente" title={e.nombre}>
                        <Icon name={e.icono} size={18} />
                        <span className={estilos.etiqueta}>{e.nombre}</span>
                      </button>
                    </li>
                  );
                }
                return (
                  <li key={e.id} className={estilos.item}>
                    <Link
                      href={enlace(e.ruta)}
                      className={`${estilos.enlace} ${e.padre ? estilos.hijo : ''} ${activo ? estilos.activo : ''}`}
                      aria-current={activo ? 'page' : undefined}
                      title={e.nombre}
                    >
                      <Icon name={e.icono} size={18} />
                      <span className={estilos.etiqueta}>{e.nombre}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={estilos.pie}>
        <div className={estilos.tema}><ThemeToggle /></div>
        <button
          type="button"
          className={estilos.alternar}
          onClick={alternarRiel}
          aria-pressed={riel}
          title={riel ? 'Expandir la barra lateral' : 'Contraer la barra lateral'}
        >
          <Icon name={riel ? 'chevronRight' : 'chevronDown'} size={16} className={riel ? undefined : estilos.girar} />
          <span className={estilos.etiqueta}>{riel ? 'Expandir barra' : 'Contraer barra'}</span>
        </button>
      </div>
    </aside>
  );
}
