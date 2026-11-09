import { geometriaAnillo } from '@/lib/ui/anillo';
import { resolverTono } from '@/lib/ui/tonos';
import estilos from './Ring.module.css';

// Anillo de progreso (base de Life Pulse).
// - `valor`: fracción de 0 a 1. Ausente o inválido: anillo discontinuo y "—", NUNCA un porcentaje inventado.
//   Un cero real sí es 0 %.
// - `etiqueta`: obligatoria. Es lo que anuncia el lector de pantalla ("Finanzas: 76 %").
// - `children`: contenido del centro. Por defecto el porcentaje.
// - `tono`: neutro, primario, exito, advertencia, peligro, o el id de un frente de diseño.
export default function Ring({ valor, etiqueta, tono = 'primario', tamano = 96, grosor = 10, children, className }) {
  const g = geometriaAnillo({ tamano, grosor, valor });
  const t = resolverTono({ tono });
  const ok = g.estado === 'ok';

  const propsA11y = ok
    ? { role: 'progressbar', 'aria-label': etiqueta, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': g.porcentaje }
    : { role: 'img', 'aria-label': `${etiqueta}: sin datos` };

  return (
    <div
      className={[estilos.anillo, className].filter(Boolean).join(' ')}
      style={{ width: g.tamano, height: g.tamano }}
      {...propsA11y}
    >
      <svg className={estilos.svg} width={g.tamano} height={g.tamano} viewBox={`0 0 ${g.tamano} ${g.tamano}`} aria-hidden="true" focusable="false">
        <circle className={ok ? estilos.pista : estilos.pistaSinDatos} cx={g.centro} cy={g.centro} r={g.radio} strokeWidth={g.grosor} />
        {ok && g.longitudArco > 0 && (
          <circle
            className={`${estilos.arco} ${estilos[`t_${t}`]}`}
            cx={g.centro}
            cy={g.centro}
            r={g.radio}
            strokeWidth={g.grosor}
            strokeLinecap="round"
            strokeDasharray={`${g.longitudArco} ${g.circunferencia}`}
            transform={`rotate(-90 ${g.centro} ${g.centro})`}
          />
        )}
      </svg>
      <div className={estilos.centro} style={{ fontSize: Math.round(g.tamano * 0.26) }}>
        {children ?? (ok ? `${g.porcentaje} %` : '—')}
      </div>
    </div>
  );
}
