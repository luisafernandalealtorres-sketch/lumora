import { agruparFrentes } from '@/lib/domain/frentesMap';

// Selector de frente agrupado por los seis frentes de diseño.
// Los valores de cada opción siguen siendo los slugs originales de la tabla `frentes`.
//
// - conGrupos + textoTodos: modo filtro. Agrega "Todo <frente>" en los grupos
//   que reúnen más de un slug y una opción vacía para no filtrar. El valor de
//   una opción de grupo es "grupo:<id>".
export default function SelectorFrente({ id, value, onChange, frentes, ariaLabel = 'Frente', conGrupos = false, textoTodos }) {
  const grupos = agruparFrentes(frentes);
  return (
    <select id={id} value={value} onChange={onChange} aria-label={ariaLabel}>
      {textoTodos && <option value="">{textoTodos}</option>}
      {grupos.map(g => (
        <optgroup key={g.frente.id} label={g.frente.nombre}>
          {conGrupos && g.frentes.length > 1 && <option value={`grupo:${g.frente.id}`}>Todo {g.frente.nombre}</option>}
          {g.frentes.map(f => <option key={f.slug} value={f.slug}>{f.nombre}</option>)}
        </optgroup>
      ))}
    </select>
  );
}
