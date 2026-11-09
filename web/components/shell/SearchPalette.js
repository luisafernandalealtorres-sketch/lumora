'use client';
import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { elementosVisibles } from '@/lib/domain/navegacion';
import { buscar } from '@/lib/domain/busqueda';
import { FRENTES_DISENO } from '@/lib/domain/frentesMap';
import { aplicarTema, CLAVE_TEMA } from '@/lib/theme';
import { visibleEnShell } from './acciones';
import { useShell } from './ShellProvider';
import { useDialogo } from './useDialogo';
import { useSalir } from './useSalir';
import { useFrenteActivo } from './useFrenteActivo';
import estilos from './SearchPalette.module.css';

// Paleta de búsqueda (Ctrl/Cmd + K). Alcance de la Fase 2: navegación y acciones del shell.
// NO busca dentro de notas, gastos ni pendientes (eso es de la Fase 5) y no consulta datos.
function cambiarTema(t) {
  aplicarTema(t);
  // Avisa a los selectores de tema ya montados en esta misma pestaña.
  window.dispatchEvent(new StorageEvent('storage', { key: CLAVE_TEMA }));
}

export default function SearchPalette({ desarrollo }) {
  const { buscarAbierto, cerrar, abrirAsistente } = useShell();
  if (!buscarAbierto) return null;
  return <Paleta desarrollo={desarrollo} cerrar={cerrar} abrirAsistente={abrirAsistente} />;
}

function Paleta({ desarrollo, cerrar, abrirAsistente }) {
  const router = useRouter();
  const { frente, elegir, quitar, enlace } = useFrenteActivo();
  const { salir } = useSalir();
  const [consulta, setConsulta] = useState('');
  const [activo, setActivo] = useState(0);
  const panel = useRef(null);
  useDialogo(panel, true, cerrar);

  const candidatos = useMemo(() => {
    const ir = elementosVisibles({ desarrollo }).filter(visibleEnShell).map(e => ({
      id: `ir-${e.id}`, grupo: 'Ir a', nombre: e.accion ? `Abrir ${e.nombre.toLowerCase()}` : e.nombre, claves: [...e.claves, e.nombre], icono: e.icono,
      ejecutar: () => (e.accion === 'asistente' ? abrirAsistente() : router.push(enlace(e.ruta))),
    }));
    const frentes = [
      ...FRENTES_DISENO.map(f => ({ id: `f-${f.id}`, grupo: 'Frente', nombre: `Filtrar por ${f.nombre}`, claves: ['frente', f.nombre], icono: 'layers', ejecutar: () => elegir(f.id) })),
      ...(frente ? [{ id: 'f-todos', grupo: 'Frente', nombre: 'Quitar filtro de frente', claves: ['frente', 'todos'], icono: 'x', ejecutar: quitar }] : []),
    ];
    const tema = [['light', 'claro', 'sun'], ['dark', 'oscuro', 'moon'], ['system', 'del sistema', 'monitor']].map(([t, n, i]) => ({
      id: `t-${t}`, grupo: 'Acciones', nombre: `Tema ${n}`, claves: ['tema', 'color', 'apariencia'], icono: i, ejecutar: () => cambiarTema(t),
    }));
    const cuenta = [{ id: 'salir', grupo: 'Acciones', nombre: 'Cerrar sesión', claves: ['salir', 'logout'], icono: 'arrowRight', ejecutar: salir }];
    return [...ir, ...frentes, ...tema, ...cuenta];
  }, [desarrollo, frente, router, enlace, elegir, quitar, salir, abrirAsistente]);

  const resultados = useMemo(() => buscar(candidatos, consulta), [candidatos, consulta]);
  const idx = Math.min(activo, Math.max(resultados.length - 1, 0));

  function ejecutar(r) {
    cerrar();
    r.ejecutar();
  }

  function alTeclear(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActivo(Math.min(idx + 1, resultados.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo(Math.max(idx - 1, 0)); }
    else if (e.key === 'Enter' && resultados[idx]) { e.preventDefault(); ejecutar(resultados[idx]); }
  }

  let grupoPrevio = null;
  return (
    <div className={estilos.fondo} onMouseDown={e => { if (e.target === e.currentTarget) cerrar(); }}>
      <div ref={panel} className={estilos.panel} role="dialog" aria-modal="true" aria-label="Buscar o ir a">
        <div className={estilos.campo}>
          <Icon name="search" size={18} />
          <input
            className={estilos.input}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="paleta-lista"
            aria-activedescendant={resultados[idx] ? `paleta-${resultados[idx].id}` : undefined}
            aria-autocomplete="list"
            aria-label="Buscar o ir a"
            placeholder="Buscar o ir a…"
            value={consulta}
            onChange={e => { setConsulta(e.target.value); setActivo(0); }}
            onKeyDown={alTeclear}
          />
          <kbd className={estilos.atajo}>Esc</kbd>
        </div>

        <div id="paleta-lista" className={estilos.lista} role="listbox" aria-label="Resultados">
          {resultados.map((r, i) => {
            const cab = r.grupo !== grupoPrevio ? r.grupo : null;
            grupoPrevio = r.grupo;
            return (
              <div key={r.id}>
                {cab && <p className={estilos.grupo} role="presentation">{cab}</p>}
                <div
                  id={`paleta-${r.id}`}
                  role="option"
                  aria-selected={i === idx}
                  className={`${estilos.opcion} ${i === idx ? estilos.sel : ''}`}
                  onMouseMove={() => setActivo(i)}
                  onClick={() => ejecutar(r)}
                >
                  <Icon name={r.icono} size={18} />
                  <span>{r.nombre}</span>
                </div>
              </div>
            );
          })}
          {!resultados.length && (
            <p className={estilos.vacio} role="status">No hay resultados para “{consulta.trim()}”.</p>
          )}
        </div>

        <p className={estilos.pie}>Busca pantallas y acciones. La búsqueda dentro de notas, gastos y pendientes llegará más adelante.</p>
      </div>
    </div>
  );
}
