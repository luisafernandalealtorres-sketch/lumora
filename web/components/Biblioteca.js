'use client';
import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const TIPOS = [['articulo', 'Artículo'], ['video', 'Video'], ['libro', 'Libro'], ['otro', 'Otro']];
const limpiarTags = s => [...new Set(s.split(',').map(t => t.trim().toLowerCase().replace(/^#/, '')).filter(Boolean))];

export default function Biblioteca({ inicial }) {
  const supabase = createClient();
  const [items, setItems] = useState(inicial);
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('');
  const [error, setError] = useState('');
  const [f, setF] = useState({ titulo: '', fuente: '', tipo: 'articulo', resumen: '', etiquetas: '' });

  const tags = useMemo(() => [...new Set(items.flatMap(i => i.etiquetas))].sort(), [items]);
  const visibles = items.filter(i =>
    (!tag || i.etiquetas.includes(tag)) &&
    (!q || `${i.titulo} ${i.resumen ?? ''} ${i.fuente ?? ''}`.toLowerCase().includes(q.toLowerCase())));

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
    setF({ titulo: '', fuente: '', tipo: 'articulo', resumen: '', etiquetas: '' });
  }

  async function borrar(it) {
    const antes = items;
    setItems(items.filter(x => x.id !== it.id));
    const { error } = await supabase.from('biblioteca').delete().eq('id', it.id);
    if (error) setItems(antes);
  }

  return (
    <>
      <header>
        <div><div className="date">Lo que leo, veo y aprendo</div><h1>Biblioteca</h1></div>
        <div className="toolbar">
          <input id="b-buscar" type="search" placeholder="Buscar" value={q} onChange={e => setQ(e.target.value)} />
        </div>
      </header>

      {tags.length > 0 && (
        <div>
          <button className={`tag ${!tag ? 'on' : ''}`} onClick={() => setTag('')}>todo</button>
          {tags.map(t => <button key={t} className={`tag ${tag === t ? 'on' : ''}`} onClick={() => setTag(t)}>#{t}</button>)}
        </div>
      )}

      <div className="cols">
        <section>
          <h2>Guardado <small>{visibles.length}</small></h2>
          {visibles.length ? (
            <ul>{visibles.map(it => (
              <li key={it.id}>
                <div className="rowx"><span className="from">{it.titulo}</span><span className="sub">{TIPOS.find(t => t[0] === it.tipo)?.[1]}</span></div>
                {it.fuente && <div className="sub" style={{ overflowWrap: 'anywhere' }}>{it.fuente}</div>}
                {it.resumen && <div className="pre">{it.resumen}</div>}
                <div>{it.etiquetas.map(t => <span className="tag" key={t}>#{t}</span>)}</div>
                <button className="link" onClick={() => borrar(it)}>Borrar</button>
              </li>
            ))}</ul>
          ) : <p className="empty">{items.length ? 'Nada coincide con tu búsqueda.' : 'Guarda tu primer artículo, video o libro con el formulario.'}</p>}
        </section>

        <section>
          <h2>Guardar algo nuevo</h2>
          <form className="form" onSubmit={agregar}>
            <label>Título<input id="b-titulo" value={f.titulo} onChange={e => setF({ ...f, titulo: e.target.value })} /></label>
            <div className="two">
              <label>Tipo
                <select id="b-tipo" value={f.tipo} onChange={e => setF({ ...f, tipo: e.target.value })}>
                  {TIPOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label>Enlace o autor<input id="b-fuente" value={f.fuente} onChange={e => setF({ ...f, fuente: e.target.value })} /></label>
            </div>
            <label>Resumen (5 líneas)<textarea id="b-resumen" value={f.resumen} onChange={e => setF({ ...f, resumen: e.target.value })} /></label>
            <label>Etiquetas separadas por coma<input id="b-tags" value={f.etiquetas} onChange={e => setF({ ...f, etiquetas: e.target.value })} placeholder="ventas, productividad" /></label>
            <button className="btn" type="submit">Guardar</button>
            {error && <div className="err">{error}</div>}
          </form>
        </section>
      </div>
    </>
  );
}
