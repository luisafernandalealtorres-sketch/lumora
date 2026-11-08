import { notFound } from 'next/navigation';
import ThemeToggle from '@/components/ui/ThemeToggle';
import TemaActivo from './TemaActivo';
import estilos from './laboratorio.module.css';

// LABORATORIO DE DISEÑO. Solo desarrollo.
// - En la compilación de producción responde 404.
// - No consulta ni escribe en Supabase y no muestra datos reales. Todo lo que ves son muestras estáticas.
// - Exige sesión, igual que el resto de la app (lo hace el middleware).
export const dynamic = 'force-dynamic';

const NEUTROS = [
  ['--ds-bg', 'Fondo'], ['--ds-bg-2', 'Fondo secundario'], ['--ds-surface', 'Superficie'], ['--ds-surface-raised', 'Superficie elevada'],
  ['--ds-text', 'Texto'], ['--ds-text-2', 'Texto secundario'], ['--ds-border-strong', 'Borde de control'], ['--ds-focus', 'Foco'],
];
const ACENTOS = [
  ['--ds-primary', 'Primario'], ['--ds-on-primary', 'Sobre primario'], ['--ds-secondary', 'Secundario'],
  ['--ds-success', 'Éxito'], ['--ds-warning', 'Advertencia'], ['--ds-danger', 'Error'],
];
const FRENTES = [
  ['tanku', 'TANKU'], ['ticketcode', 'TICKETCODE'], ['personal', 'Personal'],
  ['salud', 'Salud'], ['familia', 'Familia'], ['otros', 'Otros proyectos'],
];

function Muestras({ lista }) {
  return (
    <div className={estilos.muestras}>
      {lista.map(([token, nombre]) => (
        <div className={estilos.muestra} key={token}>
          <div className={estilos.color} style={{ background: `var(${token})` }} />
          <div className={estilos.nombre}>{nombre}</div>
          <code className={estilos.token}>{token}</code>
        </div>
      ))}
    </div>
  );
}

export default function Laboratorio() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <div className={estilos.pagina}>
      <div className={estilos.aviso} role="note">
        Laboratorio de diseño: solo desarrollo. Son muestras estáticas, no datos reales, y esta página no consulta Supabase.
      </div>

      <h1 className={estilos.h1}>Laboratorio</h1>

      <section className={estilos.seccion} aria-labelledby="lab-tema">
        <h2 className={estilos.h2} id="lab-tema">Tema</h2>
        <p className={estilos.texto2}>Elige claro, oscuro o sistema. La preferencia se recuerda en este navegador.</p>
        <div className={estilos.fila}>
          <ThemeToggle />
          <TemaActivo />
        </div>
      </section>

      <section className={estilos.seccion} aria-labelledby="lab-neutros">
        <h2 className={estilos.h2} id="lab-neutros">Neutros</h2>
        <Muestras lista={NEUTROS} />
      </section>

      <section className={estilos.seccion} aria-labelledby="lab-acentos">
        <h2 className={estilos.h2} id="lab-acentos">Acentos y estados</h2>
        <Muestras lista={ACENTOS} />
      </section>

      <section className={estilos.seccion} aria-labelledby="lab-frentes">
        <h2 className={estilos.h2} id="lab-frentes">Frentes (propuesta para aprobar)</h2>
        <p className={estilos.texto2}>Cada frente de diseño con su color y su fondo suave, como se verá en las etiquetas.</p>
        <div className={estilos.fila}>
          {FRENTES.map(([id, nombre]) => (
            <span
              key={id}
              className={estilos.chip}
              style={{ color: `var(--ds-frente-${id})`, background: `var(--ds-frente-${id}-soft)` }}
            >
              {nombre}
            </span>
          ))}
        </div>
      </section>

      <section className={estilos.seccion} aria-labelledby="lab-texto">
        <h2 className={estilos.h2} id="lab-texto">Texto sobre superficies</h2>
        <div className={estilos.superficies}>
          {[['--ds-bg', 'Fondo'], ['--ds-surface', 'Superficie'], ['--ds-surface-raised', 'Elevada']].map(([t, n]) => (
            <div key={t} className={estilos.caja} style={{ background: `var(${t})` }}>
              <p className={estilos.cajaTitulo}>{n}</p>
              <p className={estilos.cajaTexto}>Texto principal de ejemplo.</p>
              <p className={estilos.cajaTexto2}>Texto secundario de ejemplo.</p>
            </div>
          ))}
        </div>
        <div className={estilos.fila}>
          <span className={estilos.estado} style={{ color: 'var(--ds-success)', background: 'var(--ds-success-soft)' }}>Éxito</span>
          <span className={estilos.estado} style={{ color: 'var(--ds-warning)', background: 'var(--ds-warning-soft)' }}>Advertencia</span>
          <span className={estilos.estado} style={{ color: 'var(--ds-danger)', background: 'var(--ds-danger-soft)' }}>Error</span>
          <span className={estilos.estado} style={{ color: 'var(--ds-primary)', background: 'var(--ds-primary-soft)' }}>Primario</span>
        </div>
      </section>

      <section className={estilos.seccion} aria-labelledby="lab-grad">
        <h2 className={estilos.h2} id="lab-grad">Degradado del encabezado</h2>
        <p className={estilos.texto2}>Abstracto azul-violeta, sin imagen ni paisaje. Se usará en el encabezado de Home.</p>
        <div className={estilos.degradado}>
          <p className={estilos.degradadoTitulo}>Buenas tardes</p>
          <p className={estilos.degradadoTexto}>Texto principal sobre el degradado.</p>
        </div>
      </section>
    </div>
  );
}
