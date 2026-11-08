'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fechaCorta } from '@/lib/format';

const ESTADOS = { activa: 'Activa', pausada: 'Pausada', lograda: 'Lograda' };

export default function Metas({ frentes, metas: m0, hitos: h0, tareas }) {
  const supabase = createClient();
  const [metas, setMetas] = useState(m0);
  const [hitos, setHitos] = useState(h0);
  const [ver, setVer] = useState('activa');
  const [error, setError] = useState('');
  const [nuevoHito, setNuevoHito] = useState({});
  const [f, setF] = useState({ titulo: '', descripcion: '', frente: frentes[0]?.slug ?? 'personal', fecha: '' });

  const progreso = m => {
    const hs = hitos.filter(h => h.meta_id === m.id);
    const ts = tareas.filter(t => t.meta_id === m.id);
    const total = hs.length + ts.length;
    const hechos = hs.filter(h => h.hecho).length + ts.filter(t => t.hecho).length;
    return { total, hechos, pct: total ? hechos / total : 0, hs, ts };
  };

  async function crear(e) {
    e.preventDefault();
    if (!f.titulo.trim()) return setError('Ponle un título a la meta.');
    const { data, error } = await supabase.from('metas').insert({
      titulo: f.titulo.trim(), descripcion: f.descripcion.trim() || null, frente: f.frente, fecha_meta: f.fecha || null,
    }).select().single();
    if (error) return setError('No se pudo crear la meta.');
    setError(''); setMetas([...metas, data]);
    setF({ ...f, titulo: '', descripcion: '', fecha: '' });
  }

  async function cambiarEstado(m, estado) {
    const antes = metas;
    setMetas(metas.map(x => (x.id === m.id ? { ...x, estado } : x)));
    const { error } = await supabase.from('metas').update({ estado }).eq('id', m.id);
    if (error) setMetas(antes);
  }

  async function borrarMeta(m) {
    const antes = metas;
    setMetas(metas.filter(x => x.id !== m.id));
    const { error } = await supabase.from('metas').delete().eq('id', m.id);
    if (error) setMetas(antes);
  }

  async function agregarHito(m, e) {
    e.preventDefault();
    const t = (nuevoHito[m.id] ?? '').trim();
    if (!t) return;
    const { data, error } = await supabase.from('hitos').insert({ meta_id: m.id, titulo: t }).select().single();
    if (error) return setError('No se pudo guardar el hito.');
    setError(''); setHitos([...hitos, data]); setNuevoHito({ ...nuevoHito, [m.id]: '' });
  }

  async function alternarHito(h) {
    const antes = hitos;
    setHitos(hitos.map(x => (x.id === h.id ? { ...x, hecho: !x.hecho } : x)));
    const { error } = await supabase.from('hitos').update({ hecho: !h.hecho }).eq('id', h.id);
    if (error) setHitos(antes);
  }

  async function borrarHito(h) {
    const antes = hitos;
    setHitos(hitos.filter(x => x.id !== h.id));
    const { error } = await supabase.from('hitos').delete().eq('id', h.id);
    if (error) setHitos(antes);
  }

  const visibles = metas.filter(m => m.estado === ver);

  return (
    <>
      <header>
        <div><div className="date">Hacia dónde voy</div><h1>Metas</h1></div>
        <div className="toolbar" role="tablist" aria-label="Estado">
          {Object.entries(ESTADOS).map(([k, l]) => (
            <button key={k} className={`tag ${ver === k ? 'on' : ''}`} onClick={() => setVer(k)}>
              {l} ({metas.filter(m => m.estado === k).length})
            </button>
          ))}
        </div>
      </header>
      {error && <div className="err" role="alert">{error}</div>}

      <div className="cols">
        <div className="stack">
          {visibles.length ? frentes.map(fr => {
            const lista = visibles.filter(m => m.frente === fr.slug);
            if (!lista.length) return null;
            return (
              <section key={fr.slug}>
                <p className="front">{fr.nombre}</p>
                <div style={{ display: 'grid', gap: 12 }}>
                  {lista.map(m => {
                    const p = progreso(m);
                    return (
                      <div className="card" key={m.id}>
                        <div className="rowx">
                          <span className="from">{m.titulo}</span>
                          <span className="sub">{p.total ? `${Math.round(p.pct * 100)}%` : 'sin tareas'}</span>
                        </div>
                        {m.descripcion && <div className="sub pre">{m.descripcion}</div>}
                        <div className="bar"><i style={{ width: `${p.pct * 100}%` }} /></div>
                        <div className="sub">
                          {p.hechos} de {p.total} completados · {p.ts.length} tareas vinculadas
                          {m.fecha_meta ? ` · para el ${fechaCorta(m.fecha_meta)}` : ''}
                        </div>
                        <div style={{ marginTop: 6 }}>
                          {p.hs.map(h => (
                            <div className={`todo ${h.hecho ? 'done' : ''}`} key={h.id}>
                              <input type="checkbox" checked={h.hecho} onChange={() => alternarHito(h)} aria-label={h.titulo} />
                              <span>{h.titulo}</span>
                              <button onClick={() => borrarHito(h)} aria-label="Borrar hito">×</button>
                            </div>
                          ))}
                        </div>
                        <form className="add" onSubmit={e => agregarHito(m, e)}>
                          <input type="text" id={`hito-${m.id}`} placeholder="Nuevo hito" value={nuevoHito[m.id] ?? ''}
                            onChange={e => setNuevoHito({ ...nuevoHito, [m.id]: e.target.value })} />
                          <button className="btn sec" type="submit">Agregar</button>
                        </form>
                        <div className="rowx" style={{ justifyContent: 'flex-start', gap: 16, marginTop: 4 }}>
                          {m.estado !== 'activa' && <button className="link" onClick={() => cambiarEstado(m, 'activa')}>Reactivar</button>}
                          {m.estado === 'activa' && <button className="link" onClick={() => cambiarEstado(m, 'pausada')}>Pausar</button>}
                          {m.estado !== 'lograda' && <button className="link" onClick={() => cambiarEstado(m, 'lograda')}>Marcar lograda</button>}
                          <button className="link" onClick={() => borrarMeta(m)}>Borrar</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          }) : (
            <section><p className="empty">
              {metas.length ? `No hay metas ${ESTADOS[ver].toLowerCase()}s.` : 'Crea tu primera meta, por ejemplo "EVE: primer cliente pagando".'}
            </p></section>
          )}
        </div>

        <section>
          <h2>Nueva meta</h2>
          <form className="form" onSubmit={crear}>
            <label>Frente
              <select id="m-frente" value={f.frente} onChange={e => setF({ ...f, frente: e.target.value })}>
                {frentes.map(x => <option key={x.slug} value={x.slug}>{x.nombre}</option>)}
              </select>
            </label>
            <label>Meta<input id="m-titulo" value={f.titulo} onChange={e => setF({ ...f, titulo: e.target.value })} placeholder="Lanzar TANKU" /></label>
            <label>Por qué importa (opcional)<textarea id="m-desc" style={{ minHeight: 70 }} value={f.descripcion} onChange={e => setF({ ...f, descripcion: e.target.value })} /></label>
            <label>Fecha objetivo<input id="m-fecha" type="date" value={f.fecha} onChange={e => setF({ ...f, fecha: e.target.value })} /></label>
            <button className="btn" type="submit">Crear meta</button>
          </form>
          <p className="sub" style={{ marginTop: 10 }}>
            El avance cuenta los hitos y los pendientes que vincules a la meta desde Mi día.
          </p>
        </section>
      </div>
    </>
  );
}
