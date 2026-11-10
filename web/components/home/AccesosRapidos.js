'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { createClient } from '@/lib/supabase/client';
import { useShell } from '@/components/shell/ShellProvider';
import {
  validarPendiente, validarGasto, validarNota, validarIdea, crearPendiente, registrarGasto, crearNota,
} from '@/lib/data/acciones';
import { frenteInicial } from '@/lib/domain/formularios';
import { CATEGORIAS } from '@/lib/format';
import timer from '@/components/timer/Timer.module.css';
import estilos from './Home.module.css';

// Accesos rápidos: cada uno ejecuta una acción REAL (escribe en las tablas existentes). En escritorio es una barra; en móvil
// un botón que abre una hoja inferior. «Consultar al asistente» abre el panel del asistente (aún no conectado a IA: lo dice).
const ACCIONES = [
  { id: 'pendiente', texto: 'Nuevo pendiente', icono: 'plus' },
  { id: 'gasto', texto: 'Registrar gasto', icono: 'wallet' },
  { id: 'nota', texto: 'Agregar nota', icono: 'book' },
  { id: 'idea', texto: 'Capturar idea', icono: 'bolt' },
  { id: 'asistente', texto: 'Consultar al asistente', icono: 'sparkles' },
];

export default function AccesosRapidos({ frentes, hoy }) {
  const router = useRouter();
  const shell = useShell();
  const dialogo = useRef(null);
  const [vista, setVista] = useState(null);          // null | 'menu' | id de acción
  const [aviso, setAviso] = useState(null);          // { ok, texto }

  function elegir(id) {
    if (id === 'asistente') { setVista(null); shell.abrirAsistente(); return; }
    setAviso(null); setVista(id);
  }
  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (vista && !d.open) d.showModal();
    if (!vista && d.open) d.close();
  }, [vista]);
  useEffect(() => {
    const alAccion = e => elegir(e.detail);
    window.addEventListener('home:accion', alAccion);
    return () => window.removeEventListener('home:accion', alAccion);
  });

  function exito(texto) { setAviso({ ok: true, texto }); setVista(null); router.refresh(); }

  return (
    <section className={estilos.accesos} aria-label="Accesos rápidos">
      <div className={estilos.accesosBarra}>
        <b><Icon name="bolt" size={16} /> Accesos rápidos</b>
        {ACCIONES.map(a => (
          <button key={a.id} type="button" className={timer.boton} onClick={() => elegir(a.id)}><Icon name={a.icono} size={16} />{a.texto}</button>
        ))}
      </div>
      <button type="button" className={`${timer.boton} ${timer.primario} ${estilos.accesosMovil}`} onClick={() => setVista('menu')} aria-label="Accesos rápidos"><Icon name="plus" size={20} /></button>
      {aviso && <p className={estilos.confirmacion} role="status">{aviso.texto}</p>}

      <dialog ref={dialogo} className={estilos.hoja} onClose={() => setVista(null)} aria-label="Accesos rápidos">
        <div className={estilos.hojaCabecera}>
          <b>{vista === 'menu' || !vista ? 'Accesos rápidos' : ACCIONES.find(a => a.id === vista)?.texto}</b>
          <button type="button" className={timer.boton} onClick={() => setVista(null)} aria-label="Cerrar"><Icon name="x" size={16} /></button>
        </div>
        {vista === 'menu' && (
          <ul className={estilos.hojaMenu}>
            {ACCIONES.map(a => <li key={a.id}><button type="button" className={timer.boton} onClick={() => elegir(a.id)}><Icon name={a.icono} size={16} />{a.texto}</button></li>)}
          </ul>
        )}
        {vista === 'pendiente' && <FormPendiente frentes={frentes} onListo={() => exito('Pendiente creado.')} />}
        {vista === 'gasto' && <FormGasto frentes={frentes} hoy={hoy} onListo={() => exito('Gasto registrado.')} />}
        {vista === 'nota' && <FormNota frentes={frentes} onListo={() => exito('Nota guardada.')} />}
        {vista === 'idea' && <FormIdea frentes={frentes} onListo={() => exito('Idea capturada como nota con la etiqueta «idea».')} />}
      </dialog>
    </section>
  );
}

function SelectorFrenteCampo({ frentes, valor, onCambio }) {
  return (
    <label className={timer.campo}>Frente
      <select value={valor} onChange={e => onCambio(e.target.value)} required>
        {frentes.map(f => <option key={f.slug} value={f.slug}>{f.nombre}</option>)}
      </select>
    </label>
  );
}

// Envío común: valida, escribe y devuelve el error de la base si falla (no se confunde con éxito).
function useEnvio(onListo) {
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  async function enviar(validacion, escribir) {
    if (!validacion.ok) { setError(validacion.error); return; }
    setError(null); setEnviando(true);
    try { await escribir(createClient(), validacion.valor); onListo(); } catch { setError('No se pudo guardar. Intenta de nuevo.'); } finally { setEnviando(false); }
  }
  return { error, enviando, enviar };
}

function Pie({ error, enviando, texto }) {
  return (
    <>
      {error && <p className={timer.nota} role="alert">{error}</p>}
      <button type="submit" className={`${timer.boton} ${timer.primario}`} disabled={enviando}>{texto}</button>
    </>
  );
}

function FormPendiente({ frentes, onListo }) {
  const [t, setT] = useState(''); const [frente, setFrente] = useState(frenteInicial('miDiaPendiente')); const [fecha, setFecha] = useState('');
  const { error, enviando, enviar } = useEnvio(onListo);
  return (
    <form className={timer.form} onSubmit={e => { e.preventDefault(); enviar(validarPendiente({ texto: t, frente, fechaLimite: fecha }), crearPendiente); }}>
      <label className={timer.campo}>Pendiente<input type="text" value={t} onChange={e => setT(e.target.value)} maxLength={200} autoFocus required /></label>
      <SelectorFrenteCampo frentes={frentes} valor={frente} onCambio={setFrente} />
      <label className={timer.campo}>Fecha límite (opcional)<input type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></label>
      <Pie error={error} enviando={enviando} texto="Crear pendiente" />
    </form>
  );
}

function FormGasto({ frentes, hoy, onListo }) {
  const [f, setF] = useState({ fecha: hoy, lugar: '', categoria: CATEGORIAS[0], valor: '', frente: frenteInicial('gastoNuevo') });
  const { error, enviando, enviar } = useEnvio(onListo);
  return (
    <form className={timer.form} onSubmit={e => { e.preventDefault(); enviar(validarGasto(f), registrarGasto); }}>
      <label className={timer.campo}>Lugar<input type="text" value={f.lugar} onChange={e => setF({ ...f, lugar: e.target.value })} autoFocus required /></label>
      <label className={timer.campo}>Valor (COP)<input type="text" inputMode="numeric" value={f.valor} onChange={e => setF({ ...f, valor: e.target.value })} required /></label>
      <div className={timer.dos}>
        <label className={timer.campo}>Categoría<select value={f.categoria} onChange={e => setF({ ...f, categoria: e.target.value })}>{CATEGORIAS.map(c => <option key={c}>{c}</option>)}</select></label>
        <label className={timer.campo}>Fecha<input type="date" value={f.fecha} onChange={e => setF({ ...f, fecha: e.target.value })} required /></label>
      </div>
      <SelectorFrenteCampo frentes={frentes} valor={f.frente} onCambio={frente => setF({ ...f, frente })} />
      <Pie error={error} enviando={enviando} texto="Registrar gasto" />
    </form>
  );
}

function FormNota({ frentes, onListo }) {
  const [f, setF] = useState({ titulo: '', contenido: '', etiquetas: '', frente: frenteInicial('notaNueva') });
  const { error, enviando, enviar } = useEnvio(onListo);
  return (
    <form className={timer.form} onSubmit={e => { e.preventDefault(); enviar(validarNota({ ...f, etiquetas: f.etiquetas.split(',') }), crearNota); }}>
      <label className={timer.campo}>Título<input type="text" value={f.titulo} onChange={e => setF({ ...f, titulo: e.target.value })} autoFocus required /></label>
      <label className={timer.campo}>Contenido (opcional)<input type="text" value={f.contenido} onChange={e => setF({ ...f, contenido: e.target.value })} /></label>
      <label className={timer.campo}>Etiquetas, separadas por coma<input type="text" value={f.etiquetas} onChange={e => setF({ ...f, etiquetas: e.target.value })} /></label>
      <SelectorFrenteCampo frentes={frentes} valor={f.frente} onCambio={frente => setF({ ...f, frente })} />
      <Pie error={error} enviando={enviando} texto="Guardar nota" />
    </form>
  );
}

function FormIdea({ frentes, onListo }) {
  const [t, setT] = useState(''); const [frente, setFrente] = useState(frenteInicial('notaNueva'));
  const { error, enviando, enviar } = useEnvio(onListo);
  return (
    <form className={timer.form} onSubmit={e => { e.preventDefault(); enviar(validarIdea({ texto: t, frente }), crearNota); }}>
      <label className={timer.campo}>Tu idea<input type="text" value={t} onChange={e => setT(e.target.value)} autoFocus required /></label>
      <SelectorFrenteCampo frentes={frentes} valor={frente} onCambio={setFrente} />
      <p className={timer.nota}>Se guarda como una nota con la etiqueta «idea» (visible en Cerebro).</p>
      <Pie error={error} enviando={enviando} texto="Capturar idea" />
    </form>
  );
}
