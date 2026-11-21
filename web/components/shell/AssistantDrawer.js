'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import Chip from '@/components/ui/Chip';
import { createClient } from '@/lib/supabase/client';
import { filasParaCrear, PRIORIDADES, MAX_TEXTO_TAREA } from '@/lib/asistente/tareas';
import { migas } from '@/lib/domain/navegacion';
import { nombreFrenteActivo } from '@/lib/domain/frenteActivo';
import {
  estadoAsistente, puedeEnviar, FUTURO_ASISTENTE, leerEventos, mensajeDeError, estadoDeError, textoConsulta, textoPresupuesto, bloquesDeTexto,
} from '@/lib/domain/asistente';
import { useShell } from './ShellProvider';
import { useDialogo } from './useDialogo';
import { useFrenteActivo } from './useFrenteActivo';
import estilos from './AssistantDrawer.module.css';

// Asistente: chat de SOLO LECTURA. Consulta tus datos a través del servidor (la clave de la IA nunca llega aquí),
// no cambia nada y solo guarda un recuerdo cuando tú lo apruebas. La conversación no se guarda: al cerrar el panel empieza limpia.
// Escritorio: panel lateral que no bloquea la pantalla. Móvil: hoja modal.
export default function AssistantDrawer() {
  const { asistenteAbierto, cerrar } = useShell();
  const ruta = usePathname();
  const router = useRouter();
  const { frente } = useFrenteActivo();
  const panel = useRef(null);
  const fin = useRef(null);
  const abortar = useRef(null);
  const [modal, setModal] = useState(false);
  const [mensajes, setMensajes] = useState([]);          // { role, content }
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState('disponible');
  const [consulta, setConsulta] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [propuestas, setPropuestas] = useState([]);      // recuerdos propuestos, pendientes de tu decisión
  const [memoria, setMemoria] = useState(null);          // null = sin cargar / no disponible
  const [verMemoria, setVerMemoria] = useState(false);
  const [errorMemoria, setErrorMemoria] = useState('');
  const [tarjetas, setTarjetas] = useState([]);          // tareas propuestas desde unas notas, pendientes de tu decisión
  const [frentes, setFrentes] = useState([]);            // { slug, nombre } para asignar
  const [errorTareas, setErrorTareas] = useState('');
  const [creadas, setCreadas] = useState('');

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const act = () => setModal(mq.matches);
    act();
    mq.addEventListener('change', act);
    return () => mq.removeEventListener('change', act);
  }, []);

  useDialogo(panel, asistenteAbierto && modal, cerrar);
  useEffect(() => {
    if (!asistenteAbierto || modal) return undefined;
    panel.current?.querySelector('textarea')?.focus();
    function tecla(e) {
      if (e.key === 'Escape' && panel.current?.contains(document.activeElement)) {
        cerrar();
        document.querySelector('[data-asistente-boton]')?.focus();
      }
    }
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [asistenteAbierto, modal, cerrar]);

  // Al cerrar el panel se corta la respuesta en curso y la conversación se descarta.
  useEffect(() => {
    if (asistenteAbierto) return;
    abortar.current?.abort();
    setMensajes([]); setTexto(''); setEstado('disponible'); setConsulta(''); setError(''); setAviso(''); setPropuestas([]); setVerMemoria(false); setTarjetas([]); setErrorTareas(''); setCreadas('');
  }, [asistenteAbierto]);

  const cargarMemoria = useCallback(async () => {
    const { data, error: e } = await createClient().from('asistente_memoria').select('id,texto').order('creado_en', { ascending: true });
    setMemoria(e ? null : data ?? []);
  }, []);
  useEffect(() => { if (asistenteAbierto) cargarMemoria(); }, [asistenteAbierto, cargarMemoria]);
  useEffect(() => {
    if (!asistenteAbierto) return;
    createClient().from('frentes').select('slug,nombre').then(({ data }) => setFrentes(data ?? []));
  }, [asistenteAbierto]);

  useEffect(() => { fin.current?.scrollIntoView?.({ block: 'end' }); }, [mensajes, propuestas, consulta, error]);

  const enviar = useCallback(async () => {
    const pregunta = texto.trim();
    if (!pregunta || !puedeEnviar(estado)) return;
    const historial = [...mensajes, { role: 'user', content: pregunta }];
    setMensajes([...historial, { role: 'assistant', content: '' }]);
    setTexto(''); setError(''); setAviso(''); setCreadas(''); setEstado('pensando'); setConsulta('');
    const control = new AbortController();
    abortar.current = control;
    let huboTexto = false, terminado = false;
    try {
      const respuesta = await fetch('/api/asistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: control.signal,
        body: JSON.stringify({ mensajes: historial, contexto: { ruta: pathnameLegible(ruta), frente: frente || '' } }),
      });
      if (!respuesta.ok || !respuesta.body) {
        const cuerpo = await respuesta.json().catch(() => ({}));
        throw Object.assign(new Error('http'), { codigo: cuerpo?.error ?? 'interno' });
      }
      const lector = respuesta.body.getReader();
      const decodificador = new TextDecoder();
      let pendiente = '';
      for (;;) {
        const { done, value } = await lector.read();
        if (done) break;
        const { eventos, resto } = leerEventos(pendiente + decodificador.decode(value, { stream: true }));
        pendiente = resto;
        for (const ev of eventos) {
          if (ev.tipo === 'estado') { setEstado(ev.estado === 'consultando' ? 'consultando' : 'pensando'); setConsulta(ev.estado === 'consultando' ? textoConsulta(ev.herramienta) : ''); }
          else if (ev.tipo === 'texto' && typeof ev.delta === 'string') { huboTexto = true; setConsulta(''); setMensajes(m => m.map((x, i) => (i === m.length - 1 ? { ...x, content: x.content + ev.delta } : x))); }
          else if (ev.tipo === 'propuesta_memoria' && typeof ev.texto === 'string') setPropuestas(p => [...p, { id: `${Date.now()}-${p.length}`, texto: ev.texto, estado: 'pendiente' }]);
          else if (ev.tipo === 'propuesta_tareas' && Array.isArray(ev.tareas)) setTarjetas(t => [...t, { id: `${Date.now()}-${t.length}`, dudas: Array.isArray(ev.dudas) ? ev.dudas : [], items: ev.tareas.map((x, i) => ({ k: i, incluir: true, texto: x.texto, frente: x.frente ?? '', fecha_limite: x.fecha_limite ?? '', prioridad: x.prioridad })) }]);
          else if (ev.tipo === 'rechazo') setError('No puedo ayudar con eso.');
          else if (ev.tipo === 'cortada') setError('La respuesta quedó incompleta. Pídeme que continúe o hazme la pregunta más corta.');
          else if (ev.tipo === 'aviso' && ev.codigo === 'uso_no_registrado') setAviso('No pude registrar el costo de esta respuesta.');
          else if (ev.tipo === 'fin') { terminado = true; setAviso(a => a || textoPresupuesto(ev.presupuesto)); setEstado('disponible'); }
          else if (ev.tipo === 'error') { terminado = true; setError(mensajeDeError(ev.codigo)); setEstado(estadoDeError(ev.codigo)); }
        }
      }
      if (!terminado) { setError('Se cortó la conexión. Intenta de nuevo.'); setEstado('error'); }
    } catch (e) {
      if (e?.name === 'AbortError') return;
      setError(mensajeDeError(e?.codigo ?? 'conexion'));
      setEstado(estadoDeError(e?.codigo));
    } finally {
      setConsulta('');
      // Una respuesta vacía no se deja en el historial.
      if (!huboTexto) setMensajes(m => (m.at(-1)?.role === 'assistant' && !m.at(-1).content ? m.slice(0, -1) : m));
    }
  }, [texto, estado, mensajes, ruta, frente]);

  async function guardarRecuerdo(p) {
    setErrorMemoria('');
    const { error: e } = await createClient().from('asistente_memoria').insert({ texto: p.texto });
    if (e) {
      setErrorMemoria(/memoria_llena/.test(e.message ?? '') ? 'Ya tienes 50 recuerdos. Olvida alguno para guardar otro.' : 'No pude guardar el recuerdo.');
      return;
    }
    setPropuestas(ps => ps.filter(x => x.id !== p.id));
    cargarMemoria();
  }

  function cambiarTarea(idTarjeta, k, cambios) {
    setTarjetas(ts => ts.map(t => (t.id === idTarjeta ? { ...t, items: t.items.map(x => (x.k === k ? { ...x, ...cambios } : x)) } : t)));
  }

  async function crearTareas(tarjeta) {
    setErrorTareas('');
    const marcadas = tarjeta.items.filter(x => x.incluir).map(x => ({ texto: x.texto, frente: x.frente, fecha_limite: x.fecha_limite || null, prioridad: x.prioridad }));
    const r = filasParaCrear(marcadas, frentes.map(f => f.slug));
    if (r.error) {
      setErrorTareas(r.error === 'frente' ? 'Elige el frente de cada tarea marcada.' : r.error === 'vacio' ? 'No hay tareas marcadas.' : 'Revisa el texto de las tareas (mínimo 3 letras).');
      return;
    }
    const { error: e } = await createClient().from('pendientes').insert(r.filas);
    if (e) { setErrorTareas('No pude crear los pendientes. No se creó ninguno; intenta de nuevo.'); return; }
    setTarjetas(ts => ts.filter(t => t.id !== tarjeta.id));
    setCreadas(r.filas.length === 1 ? 'Creé 1 pendiente.' : `Creé ${r.filas.length} pendientes.`);
    router.refresh();
  }

  async function olvidar(id) {
    setErrorMemoria('');
    const { error: e } = await createClient().from('asistente_memoria').delete().eq('id', id);
    if (e) { setErrorMemoria('No pude borrar el recuerdo.'); return; }
    cargarMemoria();
  }

  if (!asistenteAbierto) return null;

  const lugar = migas(ruta, { desarrollo: process.env.NODE_ENV !== 'production' }).map(m => m.nombre).join(' › ') || 'Cerebro de Lu';
  const nombreFrente = nombreFrenteActivo(frente) ?? 'Todos los frentes';
  const info = estadoAsistente(estado);
  const ocupado = estado === 'pensando' || estado === 'consultando';
  const bloqueado = estado === 'no-conectado';

  return (
    <div className={`${estilos.contenedor} ${modal ? estilos.modal : ''}`} onMouseDown={e => { if (modal && e.target === e.currentTarget) cerrar(); }}>
      <aside
        id="panel-asistente"
        ref={panel}
        className={estilos.panel}
        role={modal ? 'dialog' : 'complementary'}
        aria-modal={modal ? 'true' : undefined}
        aria-labelledby="asistente-titulo"
      >
        <div className={estilos.cabecera}>
          <span className={estilos.marca} aria-hidden="true"><Icon name="sparkles" size={18} /></span>
          <div className={estilos.titulos}>
            <h2 id="asistente-titulo" className={estilos.titulo}>Lu</h2>
            <p className={estilos.sub}>{lugar} · {nombreFrente}</p>
          </div>
          <Chip tono="neutro" tamano="sm">{info.etiqueta}</Chip>
          <button type="button" className={estilos.cerrar} onClick={cerrar} aria-label="Cerrar el asistente">
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className={estilos.cuerpo}>
          {mensajes.length === 0 && (
            <div className={estilos.vacio}>
              <p className={estilos.texto}>
                {bloqueado ? `${info.descripcion} Cuando esté conectado podrás preguntarme por tu día, pendientes, agenda, gastos, metas y notas.` : '¡Hola! Soy Lu, de Lumora. Pregúntame por tu día, pendientes, agenda, gastos, metas o notas. Solo leo: no cambio nada.'}
              </p>
              <p className={estilos.rotulo}>Todavía no hago</p>
              <ul className={estilos.futuro}>
                {FUTURO_ASISTENTE.map(t => (
                  <li key={t} className={estilos.punto}>
                    <span>{t}</span>
                    <Chip tono="neutro" tamano="sm">Pendiente</Chip>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className={estilos.mensajes} aria-live="polite">
            {mensajes.map((m, i) => (
              <div key={i} className={m.role === 'user' ? estilos.mio : estilos.suyo}>
                {m.role === 'user' ? m.content : m.content ? <TextoFormateado texto={m.content} /> : (i === mensajes.length - 1 && ocupado ? <span className={estilos.pensando}>{consulta || 'Pensando…'}</span> : null)}
              </div>
            ))}
            {consulta && mensajes.at(-1)?.content ? <p className={estilos.estado}>{consulta}</p> : null}
          </div>

          {propuestas.map(p => (
            <div key={p.id} className={estilos.propuesta} role="group" aria-label="Recuerdo propuesto">
              <p className={estilos.rotulo}>¿Guardo este recuerdo?</p>
              <p className={estilos.dato}>{p.texto}</p>
              <div className={estilos.acciones}>
                <button type="button" className={estilos.primario} onClick={() => guardarRecuerdo(p)}>Guardar</button>
                <button type="button" className={estilos.secundario} onClick={() => setPropuestas(ps => ps.filter(x => x.id !== p.id))}>Descartar</button>
              </div>
            </div>
          ))}

          {tarjetas.map(t => (
            <div key={t.id} className={estilos.propuesta} role="group" aria-label="Tareas propuestas">
              <p className={estilos.rotulo}>Tareas que encontré: revisa y crea</p>
              <ul className={estilos.tareas}>
                {t.items.map(x => (
                  <li key={x.k} className={estilos.tarea}>
                    <label className={estilos.marca2}>
                      <input type="checkbox" checked={x.incluir} onChange={e => cambiarTarea(t.id, x.k, { incluir: e.target.checked })} />
                      <span>Crear</span>
                    </label>
                    <input className={estilos.campoMini} type="text" maxLength={MAX_TEXTO_TAREA} value={x.texto} aria-label="Texto de la tarea" onChange={e => cambiarTarea(t.id, x.k, { texto: e.target.value })} />
                    <div className={estilos.fila}>
                      <select className={estilos.campoMini} value={x.frente} aria-label="Frente" onChange={e => cambiarTarea(t.id, x.k, { frente: e.target.value })}>
                        <option value="">Elige frente…</option>
                        {frentes.map(f => <option key={f.slug} value={f.slug}>{f.nombre}</option>)}
                      </select>
                      <input className={estilos.campoMini} type="date" value={x.fecha_limite} aria-label="Fecha límite" onChange={e => cambiarTarea(t.id, x.k, { fecha_limite: e.target.value })} />
                      <select className={estilos.campoMini} value={x.prioridad} aria-label="Prioridad" onChange={e => cambiarTarea(t.id, x.k, { prioridad: e.target.value })}>
                        {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  </li>
                ))}
              </ul>
              {t.dudas.length > 0 && (
                <div>
                  <p className={estilos.rotulo}>Dudas</p>
                  <ul className={estilos.lista}>{t.dudas.map((d, i) => <li key={i}>{d}</li>)}</ul>
                </div>
              )}
              <div className={estilos.acciones}>
                <button type="button" className={estilos.primario} onClick={() => crearTareas(t)}>Crear marcadas</button>
                <button type="button" className={estilos.secundario} onClick={() => setTarjetas(ts => ts.filter(x => x.id !== t.id))}>Descartar</button>
              </div>
            </div>
          ))}
          {errorTareas && <p className={estilos.error} role="alert">{errorTareas}</p>}
          {creadas && <p className={estilos.aviso} role="status">{creadas}</p>}

          {error && <p className={estilos.error} role="alert">{error}</p>}
          {aviso && !error && <p className={estilos.aviso}>{aviso}</p>}
          <div ref={fin} />
        </div>

        {memoria !== null && (
          <div className={estilos.memoria}>
            <button type="button" className={estilos.memoriaBoton} aria-expanded={verMemoria} onClick={() => setVerMemoria(v => !v)}>
              Lo que recuerdo ({memoria.length})
            </button>
            {verMemoria && (
              <ul className={estilos.memoriaLista}>
                {memoria.length === 0 && <li className={estilos.vacioMemoria}>Aún no he guardado nada. Solo guardo lo que tú apruebas.</li>}
                {memoria.map(r => (
                  <li key={r.id} className={estilos.recuerdo}>
                    <span>{r.texto}</span>
                    <button type="button" className={estilos.secundario} onClick={() => olvidar(r.id)} aria-label={`Olvidar: ${r.texto}`}>Olvidar</button>
                  </li>
                ))}
              </ul>
            )}
            {errorMemoria && <p className={estilos.error} role="alert">{errorMemoria}</p>}
          </div>
        )}

        <form className={estilos.compositor} onSubmit={e => { e.preventDefault(); enviar(); }}>
          <label className={estilos.rotulo} htmlFor="asistente-mensaje">Mensaje</label>
          <textarea
            id="asistente-mensaje"
            className={estilos.campo}
            rows={2}
            maxLength={12000}
            value={texto}
            disabled={bloqueado}
            placeholder={bloqueado ? 'Disponible cuando se conecte el asistente' : 'Escribe tu pregunta'}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); enviar(); } }}
          />
          <button type="submit" className={estilos.enviar} disabled={bloqueado || ocupado || !texto.trim()}>{ocupado ? 'Respondiendo…' : 'Enviar'}</button>
        </form>
      </aside>
    </div>
  );
}

// Respuesta del asistente con negritas, listas y párrafos. Se arma con elementos de React (nunca HTML en crudo).
function TextoFormateado({ texto }) {
  const linea = (partes, k) => partes.map((p, i) => (p.negrita ? <strong key={`${k}-${i}`}>{p.texto}</strong> : <span key={`${k}-${i}`}>{p.texto}</span>));
  return bloquesDeTexto(texto).map((b, i) => {
    if (b.tipo === 'p') return <p key={i} className={estilos.parrafo}>{linea(b.items[0], i)}</p>;
    const Lista = b.tipo === 'ol' ? 'ol' : 'ul';
    return <Lista key={i} className={b.tipo === 'ol' ? `${estilos.lista} ${estilos.ol}` : estilos.lista}>{b.items.map((it, j) => <li key={j}>{linea(it, `${i}-${j}`)}</li>)}</Lista>;
  });
}

function pathnameLegible(ruta) {
  return migas(ruta, { desarrollo: process.env.NODE_ENV !== 'production' }).map(m => m.nombre).join(' › ') || 'Cerebro de Lu';
}
