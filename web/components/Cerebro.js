'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import SelectorFrente from '@/components/SelectorFrente';
import { filtrarPorFrente } from '@/lib/domain/frentesMap';

const limpiarTags = s => [...new Set(s.split(',').map(t => t.trim().toLowerCase().replace(/^#/, '')).filter(Boolean))];
const vacio = frente => ({ id: null, titulo: '', contenido: '', etiquetas: '', frente });

export default function Cerebro({ frentes, inicial }) {
  const supabase = createClient();
  const [items, setItems] = useState(inicial);
  const [frente, setFrente] = useState('');
  const [q, setQ] = useState('');
  const [f, setF] = useState(vacio(frentes[0]?.slug ?? 'personal'));
  const [error, setError] = useState('');

  const nombre = slug => frentes.find(x => x.slug === slug)?.nombre ?? 'Sin frente';
  // El filtro acepta un slug original o un grupo de diseño ("grupo:familia").
  const porFrente = frente.startsWith('grupo:') ? filtrarPorFrente(items, frente.slice(6)) : frente ? items.filter(n => n.frente === frente) : items;
  const visibles = porFrente.filter(n =>
    (!q ||`${n.titulo} ${n.contenido ?? ''} ${n.etiquetas.join(' ')}`.toLowerCase().includes(q.toLowerCase())));

  async function guardar(e) {
    e.preventDefault();
    if (!f.titulo.trim()) return setError('Ponle un título a la nota.');
    const fila = {
      titulo: f.titulo.trim(), contenido: f.contenido.trim() || null,
      etiquetas: limpiarTags(f.etiquetas), frente: f.frente, actualizado_en: new Date().toISOString(),
    };
    const q = f.id
      ? supabase.from('notas').update(fila).eq('id', f.id).select().single()
      : supabase.from('notas').insert(fila).select().single();
    const { data, error } = await q;
    if (error) return setError('No se pudo guardar. Intenta de nuevo.');
    setError('');
    setItems([data, ...items.filter(n => n.id !== data.id)]);
    setF(vacio(f.frente));
  }

  async function borrar(n) {
    const antes = items;
    setItems(items.filter(x => x.id !== n.id));
    const { error } = await supabase.from('notas').delete().eq('id', n.id);
    if (error) setItems(antes);
  }

  function editar(n) {
    setF({ id: n.id, titulo: n.titulo, contenido: n.contenido ?? '', etiquetas: n.etiquetas.join(', '), frente: n.frente ?? frentes[0]?.slug });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <>
      <header>
        <div><div className="date">Notas, ideas y apuntes</div><h1>Cerebro</h1></div>
        <div className="toolbar">
          <input id="c-buscar" type="search" placeholder="Buscar en todo" value={q} onChange={e => setQ(e.target.value)} />
          <SelectorFrente id="c-frente" value={frente} onChange={e => setFrente(e.target.value)} frentes={frentes} conGrupos textoTodos="Todos los frentes" />
        </div>
      </header>

      <div className="cols">
        <section>
          <h2>Notas <small>{visibles.length}</small></h2>
          {visibles.length ? (
            <ul>{visibles.map(n => (
              <li key={n.id}>
                <div className="rowx"><span className="from">{n.titulo}</span><span className="sub">{nombre(n.frente)}</span></div>
                {n.contenido && <div className="pre">{n.contenido}</div>}
                <div>{n.etiquetas.map(t => <span className="tag" key={t}>#{t}</span>)}</div>
                <div className="rowx" style={{ justifyContent: 'flex-start', gap: 16 }}>
                  <button className="link" onClick={() => editar(n)}>Editar</button>
                  <button className="link" onClick={() => borrar(n)}>Borrar</button>
                </div>
              </li>
            ))}</ul>
          ) : <p className="empty">{items.length ? 'Nada coincide con tu búsqueda.' : 'Guarda tu primera nota o idea con el formulario.'}</p>}
        </section>

        <section>
          <h2>{f.id ? 'Editar nota' : 'Nueva nota'}</h2>
          <form className="form" onSubmit={guardar}>
            <label>Frente
              <SelectorFrente id="c-nf" value={f.frente} onChange={e => setF({ ...f, frente: e.target.value })} frentes={frentes} />
            </label>
            <label>Título<input id="c-titulo" value={f.titulo} onChange={e => setF({ ...f, titulo: e.target.value })} /></label>
            <label>Contenido<textarea id="c-contenido" style={{ minHeight: 160 }} value={f.contenido} onChange={e => setF({ ...f, contenido: e.target.value })} /></label>
            <label>Etiquetas separadas por coma<input id="c-tags" value={f.etiquetas} onChange={e => setF({ ...f, etiquetas: e.target.value })} /></label>
            <div className="toolbar">
              <button className="btn" type="submit">{f.id ? 'Guardar cambios' : 'Guardar nota'}</button>
              {f.id && <button className="btn sec" type="button" onClick={() => setF(vacio(f.frente))}>Cancelar</button>}
            </div>
            {error && <div className="err">{error}</div>}
          </form>
        </section>
      </div>
    </>
  );
}
