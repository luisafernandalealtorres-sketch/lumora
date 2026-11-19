'use client';
import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import SelectorFrente from '@/components/SelectorFrente';
import Pantalla from '@/components/ui/Pantalla';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import EmptyState from '@/components/ui/EmptyState';
import Icon from '@/components/ui/Icon';
import { frenteInicial } from '@/lib/domain/formularios';
import { filtrarPorFrente, frenteDeSlug } from '@/lib/domain/frentesMap';
import estilos from './Cerebro.module.css';

const limpiarTags = s => [...new Set(s.split(',').map(t => t.trim().toLowerCase().replace(/^#/, '')).filter(Boolean))];
const vacio = frente => ({ id: null, titulo: '', contenido: '', etiquetas: '', frente });
const fechaNota = iso => (iso ? new Date(iso).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short' }) : '');

export default function CerebroPanel({ frentes, inicial }) {
  const supabase = createClient();
  const [items, setItems] = useState(inicial);
  const [frente, setFrente] = useState('');
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('');
  const [f, setF] = useState(vacio(frenteInicial('notaNueva')));
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState('');
  const [confirmar, setConfirmar] = useState(null);
  const [pendiente, setPendiente] = useState(null);
  const [expandidos, setExpandidos] = useState({});

  const nombre = slug => frentes.find(x => x.slug === slug)?.nombre ?? 'Sin frente';
  const tags = useMemo(() => [...new Set(items.flatMap(n => n.etiquetas ?? []))].sort(), [items]);
  // El filtro acepta un slug original o un grupo de diseño ("grupo:familia").
  const porFrente = frente.startsWith('grupo:') ? filtrarPorFrente(items, frente.slice(6)) : frente ? items.filter(n => n.frente === frente) : items;
  const visibles = porFrente.filter(n =>
    (!tag || (n.etiquetas ?? []).includes(tag)) &&
    (!q || `${n.titulo} ${n.contenido ?? ''} ${(n.etiquetas ?? []).join(' ')}`.toLowerCase().includes(q.toLowerCase())));
  const hayFiltros = Boolean(q || tag || frente);
  const limpiar = () => { setQ(''); setTag(''); setFrente(''); };

  // Hay cambios sin guardar si el formulario difiere de la nota (o de una nota vacía).
  const base = f.id ? items.find(n => n.id === f.id) : null;
  const sucio = abierto && (
    f.titulo !== (base?.titulo ?? '') ||
    f.contenido !== (base?.contenido ?? '') ||
    f.etiquetas !== (base ? (base.etiquetas ?? []).join(', ') : '')
  );

  function enfocarTitulo() {
    setTimeout(() => {
      const el = document.getElementById('c-titulo');
      el?.scrollIntoView?.({ block: 'center' });
      el?.focus();
    }, 0);
  }

  function aplicar(accion) {
    setPendiente(null); setError('');
    if (accion.tipo === 'nueva') { setF(vacio(f.frente)); setAbierto(true); enfocarTitulo(); }
    if (accion.tipo === 'editar') {
      const n = accion.nota;
      setF({ id: n.id, titulo: n.titulo, contenido: n.contenido ?? '', etiquetas: (n.etiquetas ?? []).join(', '), frente: n.frente ?? frenteInicial('notaEdicionSinFrente') });
      setAbierto(true); enfocarTitulo();
    }
    if (accion.tipo === 'cerrar') { setF(vacio(f.frente)); setAbierto(false); }
  }

  function pedir(accion) {
    if (sucio) return setPendiente(accion);
    aplicar(accion);
  }

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
    setAbierto(false);
  }

  async function borrar(n) {
    const antes = items;
    setItems(items.filter(x => x.id !== n.id));
    setConfirmar(null);
    if (f.id === n.id) { setF(vacio(f.frente)); setAbierto(false); setPendiente(null); }
    const { error } = await supabase.from('notas').delete().eq('id', n.id);
    if (error) { setItems(antes); setError('No se pudo borrar. Intenta de nuevo.'); } else setError('');
  }

  const resumen = items.length
    ? `${items.length} ${items.length === 1 ? 'nota' : 'notas'}${tags.length ? ` · ${tags.length} ${tags.length === 1 ? 'etiqueta' : 'etiquetas'}` : ''}`
    : 'Aún no hay notas';

  const formulario = (
    <Card as="section" id="nota-form" className={estilos.bloque} titulo={f.id ? 'Editar nota' : 'Nueva nota'} icono="book"
      accion={<button type="button" className={`${estilos.boton} ${estilos.ghost}`} onClick={() => pedir({ tipo: 'cerrar' })}>Cancelar</button>}>
      <form className={estilos.form} onSubmit={guardar}>
        {f.id && <p className={estilos.sub}>Editando: {base?.titulo}</p>}
        {pendiente && (
          <div className={estilos.confirmar} role="alertdialog" aria-label="Cambios sin guardar">
            <p>Tienes cambios sin guardar. Si continúas se pierden.</p>
            <div className={estilos.acciones}>
              <button type="button" className={`${estilos.boton} ${estilos.peligro}`} onClick={() => aplicar(pendiente)}>Descartar y continuar</button>
              <button type="button" className={estilos.boton} onClick={() => setPendiente(null)}>Seguir editando</button>
            </div>
          </div>
        )}
        <label className={estilos.campo}>Frente
          <SelectorFrente id="c-nf" value={f.frente} onChange={e => setF({ ...f, frente: e.target.value })} frentes={frentes} />
        </label>
        <label className={estilos.campo}>Título
          <input id="c-titulo" value={f.titulo} onChange={e => setF({ ...f, titulo: e.target.value })} />
        </label>
        <label className={estilos.campo}>Contenido
          <textarea id="c-contenido" className={estilos.largo} value={f.contenido} onChange={e => setF({ ...f, contenido: e.target.value })} />
        </label>
        <label className={estilos.campo}>Etiquetas separadas por coma
          <input id="c-tags" value={f.etiquetas} onChange={e => setF({ ...f, etiquetas: e.target.value })} />
        </label>
        <button className={`${estilos.boton} ${estilos.primario} ${estilos.lleno}`} type="submit">{f.id ? 'Guardar cambios' : 'Guardar nota'}</button>
      </form>
    </Card>
  );

  return (
    <Pantalla fecha="Notas, ideas y apuntes" titulo="Cerebro" resumen={resumen}
      acciones={!abierto && (
        <button type="button" className={`${estilos.boton} ${estilos.primario}`} onClick={() => pedir({ tipo: 'nueva' })}>
          <Icon name="plus" size={18} />Nueva nota
        </button>
      )}>
      {error && <p className={estilos.error} role="alert">{error}</p>}

      {items.length > 0 && (
        <div className={estilos.filtros}>
          <div className={estilos.fila}>
            <div className={estilos.buscar}>
              <Icon name="search" size={18} className={estilos.lupa} />
              <input id="c-buscar" type="search" placeholder="Buscar en todo" aria-label="Buscar en las notas" value={q} onChange={e => setQ(e.target.value)} />
              {q && <button type="button" className={`${estilos.boton} ${estilos.ghost} ${estilos.cuadrado}`} onClick={() => setQ('')} aria-label="Borrar la búsqueda"><Icon name="x" size={16} /></button>}
            </div>
            <div className={estilos.selector}>
              <SelectorFrente id="c-frente" value={frente} onChange={e => setFrente(e.target.value)} frentes={frentes} conGrupos textoTodos="Todos los frentes" />
            </div>
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
              {visibles.map(n => {
                const largo = (n.contenido ?? '').length > 260 || (n.contenido ?? '').split('\n').length > 4;
                const ver = expandidos[n.id];
                const editando = abierto && f.id === n.id;
                return (
                  <li key={n.id}>
                    <Card as="article" className={`${estilos.bloque} ${editando ? estilos.editando : ''}`}>
                      <div className={estilos.cabeza}>
                        <span className={estilos.frente}><i className={estilos.punto} data-frente={frenteDeSlug(n.frente).id} />{nombre(n.frente)}</span>
                        <span className={estilos.sub}>Actualizada el {fechaNota(n.actualizado_en)}</span>
                      </div>
                      <h2 className={estilos.titulo}>{n.titulo}</h2>
                      {n.contenido && (
                        <>
                          <p className={`${estilos.contenido} ${largo && !ver ? estilos.recortado : ''}`}>{n.contenido}</p>
                          {largo && (
                            <button type="button" className={`${estilos.boton} ${estilos.ghost} ${estilos.verMas}`} aria-expanded={Boolean(ver)}
                              onClick={() => setExpandidos({ ...expandidos, [n.id]: !ver })}>{ver ? 'Ver menos' : 'Ver más'}</button>
                          )}
                        </>
                      )}
                      {(n.etiquetas ?? []).length > 0 && (
                        <ul className={estilos.etiquetas} aria-label="Etiquetas">
                          {n.etiquetas.map(e => <li key={e}><Chip tono="neutro" tamano="sm">#{e}</Chip></li>)}
                        </ul>
                      )}
                      {confirmar === n.id ? (
                        <div className={estilos.confirmar} role="alertdialog" aria-label="Confirmar borrado">
                          <p>¿Borrar esta nota? No se puede deshacer.</p>
                          <div className={estilos.acciones}>
                            <button type="button" className={`${estilos.boton} ${estilos.peligro}`} onClick={() => borrar(n)}>Sí, borrar</button>
                            <button type="button" className={estilos.boton} onClick={() => setConfirmar(null)}>Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <div className={estilos.acciones}>
                          <button type="button" className={estilos.boton} onClick={() => pedir({ tipo: 'editar', nota: n })} aria-label={`Editar ${n.titulo}`}>Editar</button>
                          <button type="button" className={`${estilos.boton} ${estilos.peligroSuave}`} onClick={() => setConfirmar(n.id)} aria-label={`Borrar ${n.titulo}`}>Borrar</button>
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
                <EmptyState icono="layers" titulo="Aún no hay notas" descripcion="Guarda tu primera nota o idea.">
                  {!abierto && <button type="button" className={`${estilos.boton} ${estilos.primario}`} onClick={() => pedir({ tipo: 'nueva' })}>Nueva nota</button>}
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
