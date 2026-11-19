'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import SelectorFrente from '@/components/SelectorFrente';
import Pantalla from '@/components/ui/Pantalla';
import Card from '@/components/ui/Card';
import Ring from '@/components/ui/Ring';
import EmptyState from '@/components/ui/EmptyState';
import Icon from '@/components/ui/Icon';
import { frenteInicial } from '@/lib/domain/formularios';
import { frenteDeSlug } from '@/lib/domain/frentesMap';
import { fechaCorta } from '@/lib/format';
import estilos from './Metas.module.css';

const ESTADOS = [
  { id: 'activa', nombre: 'Activa', plural: 'activas' },
  { id: 'pausada', nombre: 'Pausada', plural: 'pausadas' },
  { id: 'lograda', nombre: 'Lograda', plural: 'logradas' },
];

export default function MetasPanel({ frentes, metas: m0, hitos: h0, tareas }) {
  const supabase = createClient();
  const [metas, setMetas] = useState(m0);
  const [hitos, setHitos] = useState(h0);
  const [ver, setVer] = useState('activa');
  const [error, setError] = useState('');
  const [nuevoHito, setNuevoHito] = useState({});
  const [abierto, setAbierto] = useState(false);
  const [confirmar, setConfirmar] = useState(null);
  const [f, setF] = useState({ titulo: '', descripcion: '', frente: frenteInicial('metaNueva'), fecha: '' });

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
    setAbierto(false);
  }

  async function cambiarEstado(m, estado) {
    const antes = metas;
    setMetas(metas.map(x => (x.id === m.id ? { ...x, estado } : x)));
    const { error } = await supabase.from('metas').update({ estado }).eq('id', m.id);
    if (error) { setMetas(antes); setError('No se pudo cambiar el estado de la meta.'); } else setError('');
  }

  async function borrarMeta(m) {
    const antes = metas;
    setMetas(metas.filter(x => x.id !== m.id));
    setConfirmar(null);
    const { error } = await supabase.from('metas').delete().eq('id', m.id);
    if (error) { setMetas(antes); setError('No se pudo borrar la meta.'); } else setError('');
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
    if (error) { setHitos(antes); setError('No se pudo actualizar el hito.'); }
  }

  async function borrarHito(h) {
    const antes = hitos;
    setHitos(hitos.filter(x => x.id !== h.id));
    const { error } = await supabase.from('hitos').delete().eq('id', h.id);
    if (error) { setHitos(antes); setError('No se pudo borrar el hito.'); }
  }

  function teclado(e, i) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const sig = ESTADOS[(i + (e.key === 'ArrowRight' ? 1 : ESTADOS.length - 1)) % ESTADOS.length].id;
    setVer(sig);
    document.getElementById(`pestana-${sig}`)?.focus();
  }

  const cuenta = id => metas.filter(m => m.estado === id).length;
  const visibles = metas.filter(m => m.estado === ver);
  const estadoActual = ESTADOS.find(s => s.id === ver);
  const resumen = metas.length
    ? `${cuenta('activa')} ${cuenta('activa') === 1 ? 'meta activa' : 'metas activas'} · ${cuenta('lograda')} ${cuenta('lograda') === 1 ? 'lograda' : 'logradas'}`
    : 'Aún no hay metas';

  const formulario = (
    <Card as="section" id="nueva-meta" className={estilos.bloque} titulo="Nueva meta" icono="target"
      accion={<button type="button" className={`${estilos.boton} ${estilos.ghost}`} onClick={() => setAbierto(false)}>Cancelar</button>}>
      <form className={estilos.form} onSubmit={crear}>
        <label className={estilos.campo}>Frente
          <SelectorFrente id="m-frente" value={f.frente} onChange={e => setF({ ...f, frente: e.target.value })} frentes={frentes} />
        </label>
        <label className={estilos.campo}>Meta
          <input id="m-titulo" value={f.titulo} onChange={e => setF({ ...f, titulo: e.target.value })} placeholder="Lanzar TANKU" />
        </label>
        <label className={estilos.campo}>Por qué importa (opcional)
          <textarea id="m-desc" value={f.descripcion} onChange={e => setF({ ...f, descripcion: e.target.value })} />
        </label>
        <label className={estilos.campo}>Fecha objetivo
          <input id="m-fecha" type="date" value={f.fecha} onChange={e => setF({ ...f, fecha: e.target.value })} />
        </label>
        <button className={`${estilos.boton} ${estilos.primario} ${estilos.lleno}`} type="submit">Crear meta</button>
        <p className={estilos.sub}>El avance cuenta los hitos y los pendientes que vincules a la meta desde Home.</p>
      </form>
    </Card>
  );

  return (
    <Pantalla fecha="Hacia dónde voy" titulo="Metas" resumen={resumen}
      acciones={!abierto && (
        <button type="button" className={`${estilos.boton} ${estilos.primario}`} onClick={() => setAbierto(true)}>
          <Icon name="plus" size={18} />Nueva meta
        </button>
      )}>
      {error && <p className={estilos.error} role="alert">{error}</p>}

      <div className={estilos.pestanas} role="tablist" aria-label="Estado de las metas">
        {ESTADOS.map((s, i) => (
          <button key={s.id} id={`pestana-${s.id}`} type="button" role="tab" className={estilos.pestana} aria-selected={ver === s.id}
            aria-controls="panel-metas" tabIndex={ver === s.id ? 0 : -1} onClick={() => setVer(s.id)} onKeyDown={e => teclado(e, i)}>
            {s.nombre} ({cuenta(s.id)})
          </button>
        ))}
      </div>

      <div className={`${estilos.rejilla} ${abierto ? estilos.conForm : ''}`}>
        <div id="panel-metas" role="tabpanel" aria-labelledby={`pestana-${ver}`} className={estilos.col}>
          {visibles.length ? frentes.map(fr => {
            const lista = visibles.filter(m => m.frente === fr.slug);
            if (!lista.length) return null;
            return (
              <section key={fr.slug} className={estilos.grupo} aria-label={fr.nombre}>
                <h2 className={estilos.frente}><i className={estilos.punto} data-frente={frenteDeSlug(fr.slug).id} />{fr.nombre}</h2>
                <ul className={estilos.lista}>
                  {lista.map(m => {
                    const p = progreso(m);
                    return (
                      <li key={m.id}>
                        <Card as="article" className={estilos.bloque}>
                          <div className={estilos.meta}>
                            <Ring valor={p.total ? p.pct : undefined} etiqueta={`Avance de ${m.titulo}`} tono={frenteDeSlug(fr.slug).id} tamano={72} grosor={8} />
                            <div className={estilos.datos}>
                              <h3 className={estilos.titulo}>{m.titulo}</h3>
                              {m.descripcion && <p className={estilos.desc}>{m.descripcion}</p>}
                              <p className={estilos.sub}>
                                {p.total ? `${p.hechos} de ${p.total} completados · ${p.ts.length} ${p.ts.length === 1 ? 'tarea vinculada' : 'tareas vinculadas'}` : 'Sin tareas'}
                                {m.fecha_meta ? ` · para el ${fechaCorta(m.fecha_meta)}` : ''}
                              </p>
                            </div>
                          </div>

                          {p.hs.length > 0 && (
                            <ul className={estilos.hitos}>
                              {p.hs.map(h => (
                                <li className={`${estilos.hito} ${h.hecho ? estilos.hecho : ''}`} key={h.id}>
                                  <label className={estilos.casilla}>
                                    <input type="checkbox" checked={h.hecho} onChange={() => alternarHito(h)} />
                                    <span>{h.titulo}</span>
                                  </label>
                                  <button type="button" className={`${estilos.boton} ${estilos.ghost} ${estilos.cuadrado}`} onClick={() => borrarHito(h)} aria-label={`Borrar hito ${h.titulo}`}>×</button>
                                </li>
                              ))}
                            </ul>
                          )}

                          <form className={estilos.insertar} onSubmit={e => agregarHito(m, e)}>
                            <input type="text" id={`hito-${m.id}`} placeholder="Nuevo hito" aria-label={`Nuevo hito para ${m.titulo}`} value={nuevoHito[m.id] ?? ''}
                              onChange={e => setNuevoHito({ ...nuevoHito, [m.id]: e.target.value })} />
                            <button className={estilos.boton} type="submit">Agregar</button>
                          </form>

                          {confirmar === m.id ? (
                            <div className={estilos.confirmar} role="alertdialog" aria-label="Confirmar borrado">
                              <p>¿Borrar esta meta y sus hitos? No se puede deshacer.</p>
                              <div className={estilos.acciones}>
                                <button type="button" className={`${estilos.boton} ${estilos.peligro}`} onClick={() => borrarMeta(m)}>Sí, borrar</button>
                                <button type="button" className={estilos.boton} onClick={() => setConfirmar(null)}>Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            <div className={estilos.acciones}>
                              {m.estado !== 'activa' && <button type="button" className={estilos.boton} onClick={() => cambiarEstado(m, 'activa')}>Reactivar</button>}
                              {m.estado === 'activa' && <button type="button" className={estilos.boton} onClick={() => cambiarEstado(m, 'pausada')}>Pausar</button>}
                              {m.estado !== 'lograda' && <button type="button" className={estilos.boton} onClick={() => cambiarEstado(m, 'lograda')}>Marcar lograda</button>}
                              <button type="button" className={`${estilos.boton} ${estilos.peligroSuave}`} onClick={() => setConfirmar(m.id)}>Borrar</button>
                            </div>
                          )}
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          }) : (
            <Card className={estilos.bloque}>
              <EmptyState
                icono="target"
                titulo={metas.length ? `No hay metas ${estadoActual.plural}` : 'Aún no hay metas'}
                descripcion={metas.length ? undefined : 'Crea tu primera meta, por ejemplo "EVE: primer cliente pagando".'}>
                {!metas.length && !abierto && <button type="button" className={`${estilos.boton} ${estilos.primario}`} onClick={() => setAbierto(true)}>Nueva meta</button>}
              </EmptyState>
            </Card>
          )}
        </div>
        {abierto && <div className={estilos.col}>{formulario}</div>}
      </div>
    </Pantalla>
  );
}
