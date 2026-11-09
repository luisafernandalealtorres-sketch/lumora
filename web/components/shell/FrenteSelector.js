'use client';
import { useRef } from 'react';
import Icon from '@/components/ui/Icon';
import { FRENTES_DISENO } from '@/lib/domain/frentesMap';
import estilos from './FrenteSelector.module.css';

const OPCIONES = [{ id: null, nombre: 'Todos' }, ...FRENTES_DISENO.map(f => ({ id: f.id, nombre: f.nombre }))];

// Selector de frente de selección única: "Todos" y los seis frentes. El seleccionado se distingue
// por fondo, marca de verificación y texto (no solo por color). "Todos" quita el filtro.
// Los colores de los frentes son una PROPUESTA (pendiente de aprobación).
export default function FrenteSelector({ frente, onElegir, className }) {
  const refs = useRef([]);
  const actual = OPCIONES.findIndex(o => o.id === (frente ?? null));

  function alTeclear(e, i) {
    let j = null;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') j = (i + 1) % OPCIONES.length;
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') j = (i + OPCIONES.length - 1) % OPCIONES.length;
    if (e.key === 'Home') j = 0;
    if (e.key === 'End') j = OPCIONES.length - 1;
    if (j === null) return;
    e.preventDefault();
    onElegir(OPCIONES[j].id);
    refs.current[j]?.focus();
  }

  return (
    <div className={`${estilos.lista} ${className ?? ''}`.trim()} role="radiogroup" aria-label="Frente">
      {OPCIONES.map((o, i) => {
        const sel = i === actual;
        return (
          <button
            key={o.id ?? 'todos'}
            ref={el => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={sel}
            tabIndex={sel ? 0 : -1}
            className={`${estilos.opcion} ${sel ? estilos.sel : ''}`}
            onClick={() => onElegir(o.id)}
            onKeyDown={e => alTeclear(e, i)}
          >
            <span className={`${estilos.punto} ${o.id ? estilos[`f_${o.id}`] : estilos.todos}`} aria-hidden="true" />
            <span className={estilos.nombre}>{o.nombre}</span>
            {sel && <Icon name="check" size={16} />}
          </button>
        );
      })}
    </div>
  );
}
