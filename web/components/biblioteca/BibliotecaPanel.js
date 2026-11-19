'use client';
import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Pantalla from '@/components/ui/Pantalla';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import EmptyState from '@/components/ui/EmptyState';
import Icon from '@/components/ui/Icon';
import estilos from './Biblioteca.module.css';

const TIPOS = [['articulo', 'Artículo', 'book'], ['video', 'Video', 'monitor'], ['libro', 'Libro', 'library'], ['otro', 'Otro', 'layers']];
const limpiarTags = s => [...new Set(s.split(',').map(t => t.trim().toLowerCase().replace(/^#/, '')).filter(Boolean))];
const esEnlace = s => /^https?:\/\/\S+$/i.test((s ?? '').trim());
const VACIO = { titulo: '', fuente: '', tipo: 'articulo', resumen: '', etiquetas: '' };

export default function BibliotecaPanel({ inicial }) {
  const supabase = createClient();
  const [items, setItems] = useState(inicial);
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('');
  const [tipo, setTipo] = useState('');
  const [error, setError] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [confirmar, setConfirmar] = useState(null);
  const [expandidos, setExpandidos] = useState({});
  const [f, setF] = useState(VACIO);

  const tags = useMemo(() => [...new Set(items.flatMap(i => i.etiquetas ?? []))].sort(), [items]);
  const visibles = items.filter(i =>
    (!tag || (i.etiquetas ?? []).includes(tag)) &&
    (!tipo || i.tipo === tipo) &&
    (!q || `${i.titulo} ${i.resumen ?? ''} ${i.fuente ?? ''}`.toLowerCase().includes(q.toLowerCase())));
  const hayFiltros = Boolean(q || tag || tipo);
  const limpiar = () => { setQ(''); setTag(''); setTipo(''); };

  async function agregar(e) {
    e.preventDefault();
    if (!f.titulo.trim()) return setError('Ponle un título.');
    const { data, error } = await supabase.from('biblioteca').insert({
      titulo: f.titulo.trim(), fuente: f.fuente.trim() || null, tipo: f.tipo,
      resumen: f.resumen.trim() || null, etiquetas: limpiarTags(f.etiquetas),
    }).select().single();
    if (error) return setError('No se pudo guardar. Intenta de nuevo.');
    setError('');
    setItems([data, ...items]);
    setF(VACIO);
    setAbierto(false);
  }

  async function borrar(it) {
    const antes = items;
    setItems(items.filter(x => x.id !== it.id));
    setConfirmar(null);
    const { error } = await supabase.from('biblioteca').delete().eq('id', it.id);
    if (error) { setItems(antes); setError('No se pudo borrar. Intenta de nuevo.'); } else setError('');
  }

  const resumen = items.length
    ? `${items.length} ${items.length === 1 ? 'guardado' : 'guardados'}${tags.length ? ` · ${tags.length} ${tags.length === 1 ? 'etiqueta' : 'etiquetas'}` : ''}`
    : 'Aún no hay nada guardado';

  const formulario = (
    <Card as="section" id="guardar-algo" className={estilos.bloque} titulo="Guardar algo nuevo" icono="plus"
      accion={<button type="button" className={`${estilos.boton} ${estilos.ghost}`} onClick={() => setAbierto(false)}>Cancelar</button>}>
      <form className={estilos.form} onSubmit={agregar}>
        <label className={estilos.campo}>Título
          <input id="b-titulo" value={f.titulo} onChange={e => setF({ ...f, titulo: e.target.value })} />
        </label>
        <div className={estilos.dos}>
          <label className={estilos.campo}>Tipo
            <select id="b-tipo" value={f.tipo} onChange={e => setF({ ...f, tipo: e.target.value })}>
              {TIPOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className={estilos.campo}>Enlace o autor
            <input id="b-fuente" value={f.fuente} onChange={e => setF({ ...f, fuente: e.target.value })} />
          </label>
        </div>
        <label className={estilos.campo}>Resumen (5 líneas)
          <textarea id="b-resumen" value={f.resumen} onChange={e => setF({ ...f, resumen: e.target.value })} />
        </label>
        <label className={estilos.campo}>Etiquetas separadas por coma
          <input id="b-tags" value={f.etiquetas} onChange={e => setF({ ...f, etiquetas: e.target.value })} placeholder="ventas, productividad" />
        </label>
        {limpiarTags(f.etiquetas).length > 0 && (
          <p className={estilos.sub}>Se guardará como: {limpiarTags(f.etiquetas).map(t => `#${t}`).join(' ')}</p>
        )}
        <button className={`${estilos.boton} ${estilos.primario} ${estilos.lleno}`} type="submit">Guardar</button>
      </form>
    </Card>
  );

  return (
    <Pantalla fecha="Lo que leo, veo y aprendo" titulo="Biblioteca" resumen={resumen}
      acciones={!abierto && (
        <button type="button" className={`${estilos.boton} ${estilos.primario}`} onClick={() => setAbierto(true)}>
          <Icon name="plus" size={18} />Guardar algo
        </button>
      )}>
      {error && <p className={estilos.error} role="alert">{error}</p>}

      {items.length > 0 && (
        <div className={estilos.filtros}>
          <div className={estilos.buscar}>
            <Icon name="search" size={18} className={estilos.lupa} />
            <input id="b-buscar" type="search" placeholder="Buscar" aria-label="Buscar en la biblioteca" value={q} onChange={e => setQ(e.target.value)} />
            {q && <button type="button" className={`${estilos.boton} ${estilos.ghost} ${estilos.cuadrado}`} onClick={() => setQ('')} aria-label="Borrar la búsqueda"><Icon name="x" size={16} /></button>}
          </div>
          <div className={estilos.chips} role="group" aria-label="Filtrar por tipo">
            <button type="button" className={estilos.chip} aria-pressed={!tipo} onClick={() => setTipo('')}>Todo</button>
            {TIPOS.map(([v, l]) => (
              <button key={v} type="button" className={estilos.chip} aria-pressed={tipo === v} onClick={() => setTipo(tipo === v ? '' : v)}>{l}</button>
            ))}
          </div>
          {tags.length > 0 && (
            <div className={estilos.chips} role="group" aria-label="Filtrar por etiqueta">
              <button type="button" className={estilos.chip} aria-pressed={!tag} onClick={() => setTag('')}>Todas</button>
              {tags.map(t => (
                <button key={t} type="button" className={estilos.chip} aria-pressed={tag === t} onClick={() => setTag(tag === t ? '' : t)}>#{t}</button>
              ))}
            </div>
          )}
          {hayFiltros && (
            <p className={estilos.estado} role="status">
              {visibles.length} de {items.length}
              <button type="button" className={`${estilos.boton} ${estilos.ghost}`} onClick={limpiar}>Limpiar filtros</button>
            </p>
          )}
        </div>
      )}

      <div className={`${estilos.rejilla} ${abierto ? estilos.conForm : ''}`}>
        <div className={estilos.col}>
          {visibles.length ? (
            <ul className={estilos.lista}>
              {visibles.map(it => {
                const t = TIPOS.find(x => x[0] === it.tipo);
                const largo = (it.resumen ?? '').length > 220 || (it.resumen ?? '').split('\n').length > 3;
                const abiertoRes = expandidos[it.id];
                return (
                  <li key={it.id}>
                    <Card as="article" className={estilos.bloque}>
                      <div className={estilos.cabeza}>
                        <span className={estilos.tipo}><Icon name={t?.[2] ?? 'layers'} size={18} /></span>
                        <div className={estilos.datos}>
                          <h2 className={estilos.titulo}>{it.titulo}</h2>
                          <p className={estilos.sub}>{t?.[1] ?? 'Otro'}</p>
                          {it.fuente && (esEnlace(it.fuente)
                            ? <a className={estilos.enlace} href={it.fuente.trim()} target="_blank" rel="noopener noreferrer">{it.fuente.trim()}</a>
                            : <p className={estilos.sub}>{it.fuente}</p>)}
                        </div>
                      </div>
                      {it.resumen && (
                        <>
                          <p className={`${estilos.resumen} ${largo && !abiertoRes ? estilos.recortado : ''}`}>{it.resumen}</p>
                          {largo && (
                            <button type="button" className={`${estilos.boton} ${estilos.ghost} ${estilos.verMas}`} aria-expanded={Boolean(abiertoRes)}
                              onClick={() => setExpandidos({ ...expandidos, [it.id]: !abiertoRes })}>{abiertoRes ? 'Ver menos' : 'Ver más'}</button>
                          )}
                        </>
                      )}
                      {(it.etiquetas ?? []).length > 0 && (
                        <ul className={estilos.etiquetas} aria-label="Etiquetas">
                          {it.etiquetas.map(e => <li key={e}><Chip tono="neutro" tamano="sm">#{e}</Chip></li>)}
                        </ul>
                      )}
                      {confirmar === it.id ? (
                        <div className={estilos.confirmar} role="alertdialog" aria-label="Confirmar borrado">
                          <p>¿Borrar este elemento? No se puede deshacer.</p>
                          <div className={estilos.acciones}>
                            <button type="button" className={`${estilos.boton} ${estilos.peligro}`} onClick={() => borrar(it)}>Sí, borrar</button>
                            <button type="button" className={estilos.boton} onClick={() => setConfirmar(null)}>Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <div className={estilos.acciones}>
                          <button type="button" className={`${estilos.boton} ${estilos.peligroSuave}`} onClick={() => setConfirmar(it.id)}>Borrar</button>
                        </div>
                      )}
                    </Card>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Card className={estilos.bloque}>
              {items.length ? (
                <EmptyState icono="search" titulo="Nada coincide con tu búsqueda" descripcion="Prueba con otras palabras o quita los filtros.">
                  <button type="button" className={estilos.boton} onClick={limpiar}>Limpiar filtros</button>
                </EmptyState>
              ) : (
                <EmptyState icono="library" titulo="Aún no hay nada guardado" descripcion="Guarda tu primer artículo, video o libro.">
                  {!abierto && <button type="button" className={`${estilos.boton} ${estilos.primario}`} onClick={() => setAbierto(true)}>Guardar algo</button>}
                </EmptyState>
              )}
            </Card>
          )}
        </div>
        {abierto && <div className={estilos.col}>{formulario}</div>}
      </div>
    </Pantalla>
  );
}
