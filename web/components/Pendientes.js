'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import SelectorFrente from '@/components/SelectorFrente';
import { frenteInicial } from '@/lib/domain/formularios';

export default function Pendientes({ frentes, inicial, metas = [] }) {
  const supabase = createClient();
  const router = useRouter();
  const [items, setItems] = useState(inicial);
  const [texto, setTexto] = useState('');
  const [frente, setFrente] = useState(frenteInicial('miDiaPendiente'));
  const [error, setError] = useState('');
  const [meta, setMeta] = useState('');
  const metasDelFrente = metas.filter(m => m.frente === frente);

  async function agregar(e) {
    e.preventDefault();
    const t = texto.trim();
    if (!t) return;
    const { data, error } = await supabase.from('pendientes').insert({ texto: t, frente, meta_id: meta || null }).select().single();
    if (error) return setError('No se pudo guardar. Intenta de nuevo.');
    setError('');
    setItems([...items, data]);
    setTexto('');
    router.refresh();
  }

  async function alternar(it) {
    const hecho = !it.hecho;
    setItems(items.map(x => (x.id === it.id ? { ...x, hecho } : x)));
    const { error } = await supabase.from('pendientes')
      .update({ hecho, hecho_en: hecho ? new Date().toISOString() : null }).eq('id', it.id);
    if (error) setItems(items);
    router.refresh();
  }

  async function borrar(it) {
    setItems(items.filter(x => x.id !== it.id));
    const { error } = await supabase.from('pendientes').delete().eq('id', it.id);
    if (error) setItems(items);
    router.refresh();
  }

  const hechos = items.filter(i => i.hecho).length;
  return (
    <section>
      <h2>Pendientes <small>{items.length ? `${hechos} de ${items.length}` : ''}</small></h2>
      {frentes.map(f => {
        const lista = items.filter(i => i.frente === f.slug);
        if (!lista.length) return null;
        return (
          <div className="group" key={f.slug}>
            <p className="front">{f.nombre}</p>
            {lista.map(it => (
              <div className={`todo ${it.hecho ? 'done' : ''}`} key={it.id}>
                <input type="checkbox" checked={it.hecho} onChange={() => alternar(it)} aria-label={it.texto} />
                <span>{it.texto}</span>
                <button onClick={() => borrar(it)} aria-label="Borrar pendiente">×</button>
              </div>
            ))}
          </div>
        );
      })}
      {!items.length && <p className="empty">Aún no tienes pendientes. Agrega el primero abajo.</p>}
      <form className="add" onSubmit={agregar}>
        <input type="text" id="nuevo" value={texto} onChange={e => setTexto(e.target.value)} placeholder="Nuevo pendiente" />
        <SelectorFrente id="frente" value={frente} onChange={e => { setFrente(e.target.value); setMeta(''); }} frentes={frentes} />
        {metasDelFrente.length > 0 && (
          <select id="meta" value={meta} onChange={e => setMeta(e.target.value)} aria-label="Meta">
            <option value="">Sin meta</option>
            {metasDelFrente.map(m => <option key={m.id} value={m.id}>{m.titulo}</option>)}
          </select>
        )}
        <button className="btn" type="submit">Agregar</button>
      </form>
      {error && <p className="err" style={{ marginTop: 8 }}>{error}</p>}
    </section>
  );
}
