import { normalizarProgreso, textoProgreso } from '@/lib/ui/progreso';
import { resolverTono } from '@/lib/ui/tonos';
import estilos from './ProgressBar.module.css';

// Barra de progreso.
// - `valor`: fracción de 0 a 1. Un valor ausente o inválido (null, undefined, NaN, texto) se muestra como
//   "Sin datos", con una pista rayada, y NUNCA como 0 %. Un cero real sí es 0 %.
// - `etiqueta`: obligatoria. Es lo que anuncia el lector de pantalla ("Avance de TANKU: 35 %").
// - `tono`: neutro, primario, exito, advertencia, peligro, o el id de un frente de diseño.
// - `mostrarValor`: muestra el porcentaje (o "Sin datos") junto a la barra.
export default function ProgressBar({ valor, etiqueta, tono = 'primario', mostrarValor = false, tamano = 'md', className }) {
  const p = normalizarProgreso(valor);
  const t = resolverTono({ tono });
  const ok = p.estado === 'ok';
  const clases = [estilos.barra, estilos[`s_${tamano}`], className].filter(Boolean).join(' ');

  const propsPista = ok
    ? { role: 'progressbar', 'aria-label': etiqueta, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': p.porcentaje }
    : { role: 'img', 'aria-label': `${etiqueta}: sin datos` };

  return (
    <div className={clases}>
      <div className={`${estilos.pista} ${ok ? '' : estilos.sinDatos}`} {...propsPista}>
        {ok && <div className={`${estilos.relleno} ${estilos[`t_${t}`]}`} style={{ width: `${p.porcentaje}%` }} />}
      </div>
      {mostrarValor && <span className={estilos.valor}>{textoProgreso(valor)}</span>}
    </div>
  );
}
