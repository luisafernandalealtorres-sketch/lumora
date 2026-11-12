'use client';
import { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import Icon from '@/components/ui/Icon';
import Ring from '@/components/ui/Ring';
import Skeleton from '@/components/ui/Skeleton';
import { FRENTES_DISENO } from '@/lib/domain/frentesMap';
import { fechaBogota, etiquetaFecha } from '@/lib/domain/fechas';
import {
  MODALIDADES, ETIQUETA_TIPO, ETIQUETA_ESTADO_SESION, formatoReloj, duracionLegible, resumenSesiones,
} from '@/lib/domain/temporizador';
import { useTemporizador } from './TemporizadorProvider';
import Controles from './Controles';
import estilos from './Focus.module.css';

const hora = iso => new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' });
// Nombres en español de las modalidades (los identificadores del dominio no cambian).
const NOMBRE_MODALIDAD = { productivity: 'Productividad', enjoyment: 'Disfrute' };
const NOMBRE_FRENTE = Object.fromEntries(FRENTES_DISENO.map(f => [f.id, f.nombre]));

export default function FocusPanel() {
  const t = useTemporizador();
  const { cargando, noDisponible, error, datos, inst, prefs, sugerido, ocupado } = t;
  const [resultado, setResultado] = useState(null);

  const hoy = fechaBogota(new Date(t.ahora));
  const sesionesHoy = (datos?.sesiones ?? []).filter(s => s.finalizado_en && fechaBogota(new Date(s.finalizado_en)) === hoy);
  const resumen = resumenSesiones(sesionesHoy);
  const marco = (hijos, conResumen = true) => (
    <div className={estilos.pagina}>
      <EncabezadoFocus hoy={hoy} inst={inst} sesionesHoy={sesionesHoy} resumen={resumen} conResumen={conResumen} />
      {hijos}
    </div>
  );

  if (noDisponible) {
    return marco(
      <Card as="section" id="focus-no-disponible" titulo="Focus aún no está activado" icono="alert" className={estilos.bloque}>
        <p>{error?.mensaje}</p>
        <p className={estilos.nota}>La interfaz está lista, pero la base de datos de Supabase todavía no tiene las tablas y funciones de la Fase 3. Se activan aplicando la migración v1.11, lo que requiere tu autorización expresa. Mientras tanto no se guarda nada.</p>
      </Card>, false);
  }
  if (cargando && !datos) {
    return marco(<div className={estilos.rejilla}><div className={estilos.principal}><Skeleton variante="bloque" alto={320} etiqueta="Cargando el temporizador" /></div><div className={estilos.lateral}><Skeleton variante="bloque" alto={200} etiqueta="Cargando el resumen de hoy" /></div></div>, false);
  }
  if (error && !datos) {
    return marco(<ErrorState titulo="No se pudo leer el temporizador" mensaje={error.mensaje} onReintentar={() => t.recargar()} />, false);
  }

  return marco(
    <>
      {error && error.codigo !== 'fase3_no_disponible' && (
        <div className={`${estilos.aviso} ${estilos.avisoError}`} role="alert">
          <span>{error.mensaje}</span>
          <button type="button" className={estilos.boton} onClick={t.limpiarError}>Cerrar</button>
        </div>
      )}
      {resultado && (
        <div className={`${estilos.aviso} ${estilos.avisoOk}`} role="status">
          <span>{resultado}</span>
          <button type="button" className={estilos.boton} onClick={() => setResultado(null)}>Entendido</button>
        </div>
      )}

      {!inst && sugerido && <Sugerencia sugerido={sugerido} />}

      <div className={estilos.rejilla}>
        <div className={estilos.principal}>
          {inst ? <Activo onResultado={setResultado} /> : <FormularioIniciar />}
        </div>

        <div className={estilos.lateral}>
          <Card as="section" id="focus-hoy" titulo="Hoy" icono="clock" className={estilos.bloque}>
            <ul className={estilos.metricas} aria-label="Resumen de hoy">
              <li><b>{resumen.puntos}</b><span>puntos de atención</span></li>
              <li><b>{resumen.completadas}</b><span>completadas</span></li>
              <li><b>{resumen.parciales}</b><span>parciales</span></li>
              <li><b>{duracionLegible(resumen.efectivoS) ?? '0 s'}</b><span>de tiempo efectivo</span></li>
            </ul>
            {sesionesHoy.length ? (
              <ul className={estilos.lista}>
                {sesionesHoy.map(s => (
                  <li key={s.id} className={estilos.item}>
                    <div className={estilos.itemTexto}>
                      <b>{s.actividad || (NOMBRE_MODALIDAD[s.modalidad] ?? s.modalidad)}</b>
                      <span className={estilos.sub}>{hora(s.iniciado_en)} – {hora(s.finalizado_en)} · {duracionLegible(s.tiempo_efectivo_s) ?? 'sin dato'} de {duracionLegible(s.duracion_objetivo_s)}{s.intencion ? ` · ${s.intencion}` : ''}</span>
                    </div>
                    <div className={estilos.chips}>
                      <Chip frente={s.frente_id} tamano="sm">{NOMBRE_FRENTE[s.frente_id] ?? s.frente_id}</Chip>
                      <Chip tono={s.estado === 'completada' ? 'exito' : s.estado === 'parcial' ? 'advertencia' : 'neutro'} tamano="sm">
                        {ETIQUETA_ESTADO_SESION[s.estado]}{s.puntos ? ` · +${s.puntos}` : ''}
                      </Chip>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <EmptyState compacto icono="bolt" titulo="Aún no hay sesiones terminadas hoy" descripcion="Cuando completes, dejes parcial o canceles una sesión, aparecerá aquí." />}
          </Card>

          {!inst && <HabitosConTemporizador />}
          <Preferencias prefs={prefs} guardado={!!datos?.prefs} ocupado={ocupado} onGuardar={t.guardarPreferencias} />
        </div>
      </div>
    </>
  );
}

function EncabezadoFocus({ hoy, inst, sesionesHoy, resumen, conResumen }) {
  const chip = !inst ? { tono: 'neutro', texto: 'Sin sesión' } : inst.incompleto ? { tono: 'advertencia', texto: 'Activo' } : inst.pausado ? { tono: 'advertencia', texto: 'En pausa' } : { tono: 'primario', texto: 'Corriendo' };
  const texto = !conResumen ? '' : sesionesHoy.length
    ? ` · ${resumen.puntos} ${resumen.puntos === 1 ? 'punto' : 'puntos'} hoy · ${resumen.completadas} ${resumen.completadas === 1 ? 'completada' : 'completadas'}`
    : ' · Sin sesiones hoy';
  return (
    <header className={estilos.encabezado}>
      <div className={estilos.encabezadoTexto}>
        <div className="date">Temporizador global</div>
        <h1>Focus</h1>
        <p className={estilos.resumen}>{etiquetaFecha(hoy)}{texto}</p>
      </div>
      <Chip tono={chip.tono} icono={inst ? 'bolt' : undefined} role="status">{chip.texto}</Chip>
    </header>
  );
}

// Tamaño del anillo: 240 px en pantallas anchas y 200 px en móvil (solo presentación).
function useAnilloTamano() {
  const [tam, setTam] = useState(240);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const act = () => setTam(mq.matches ? 200 : 240);
    act();
    mq.addEventListener('change', act);
    return () => mq.removeEventListener('change', act);
  }, []);
  return tam;
}

// Temporizador activo (Focus, descanso o hábito). Solo presentación: lee el contexto y delega los controles en <Controles />.
function Activo({ onResultado }) {
  const t = useTemporizador();
  const { inst, lectura } = t;
  const tam = useAnilloTamano();
  if (inst.incompleto) {
    return <ErrorState titulo="Hay un temporizador activo pero no se pudo leer" mensaje="Su registro no apareció en la lectura. Reintenta." onReintentar={() => t.recargar()} />;
  }
  const cuenta = inst.cuentaAtras && lectura.restanteS !== null;
  const valor = cuenta ? lectura.restanteS : lectura.transcurridoS;
  const reloj = formatoReloj(valor);
  const subtitulo = inst.tipo === 'focus'
    ? `${NOMBRE_MODALIDAD[inst.modalidad] ?? inst.modalidad} · ${NOMBRE_FRENTE[inst.frenteId] ?? inst.frenteId}`
    : inst.tipo === 'descanso' ? 'Ningún descanso empieza solo: este lo iniciaste tú.' : 'Cronómetro de hábito';
  const conMeta = inst.objetivoS !== null && lectura.meta;
  // Estado visual: descanso > meta alcanzada > pausa > corriendo
  const estado = inst.tipo === 'descanso' ? 'descanso' : conMeta ? 'meta' : inst.pausado ? 'pausado' : 'corriendo';
  const tono = { descanso: 'personal', meta: 'exito', pausado: 'advertencia', corriendo: 'primario' }[estado];
  const etiquetaEstado = inst.pausado ? 'En pausa' : conMeta ? 'Meta alcanzada' : 'Corriendo';
  const tonoChip = inst.pausado ? 'advertencia' : conMeta ? 'exito' : 'primario';
  const progreso = inst.objetivoS !== null ? lectura.progreso : null;
  return (
    <Card as="section" id="focus-activo" titulo={`${ETIQUETA_TIPO[inst.tipo]}${inst.titulo ? ` · ${inst.titulo}` : ''}`} icono={inst.tipo === 'descanso' ? 'sun' : inst.tipo === 'habito' ? 'heart' : 'bolt'}
      className={`${estilos.bloque} ${estilos.activo}`} data-estado={estado}
      accion={<Chip tono={tonoChip} tamano="sm">{etiquetaEstado}</Chip>}>
      <div className={estilos.hero}>
        <div className={`${estilos.anilloActivo} ${estado === 'corriendo' || estado === 'descanso' ? estilos.vivo : ''}`}>
          <Ring valor={progreso ?? undefined} etiqueta={`Avance hacia la meta de ${ETIQUETA_TIPO[inst.tipo]}`} tono={tono} tamano={tam} grosor={tam === 240 ? 16 : 14}>
            <span className={`${estilos.reloj} ${reloj.length > 5 ? estilos.relojLargo : ''}`} role="timer" aria-label={`${cuenta ? 'Tiempo restante' : 'Tiempo transcurrido'} ${reloj}`}>{reloj}</span>
          </Ring>
        </div>
        <p className={estilos.subActivo}>{subtitulo}</p>
        {progreso !== null && <p className={estilos.sub}>{Math.round(progreso * 100)} % de la meta</p>}
        {conMeta && (
          <p className={estilos.notaMeta}>Meta alcanzada{lectura.excedidoS > 0 ? ` (+${formatoReloj(lectura.excedidoS)} de más)` : ''}. {inst.tipo === 'focus' ? 'Completa la sesión para registrar el punto.' : 'Ciérralo cuando quieras.'}</p>
        )}
        {inst.tipo === 'habito' && inst.objetivoS === null && <p className={estilos.nota}>Este hábito no tiene un objetivo de tiempo vigente conocido: se muestra solo el tiempo transcurrido.</p>}
      </div>
      <div className={estilos.zonaControles}>
        <Controles onResultado={onResultado} />
      </div>
    </Card>
  );
}

function Sugerencia({ sugerido }) {
  const t = useTemporizador();
  const largo = sugerido.tipo === 'largo';
  return (
    <Card as="section" id="focus-sugerencia" titulo={largo ? 'Descanso largo sugerido' : 'Descanso corto sugerido'} icono="sun" className={`${estilos.bloque} ${estilos.destacada}`}>
      <div className={estilos.sugerencia}>
        <p>{largo
          ? `Completaste ${sugerido.ciclos} ciclos. Te sugiero un descanso largo de ${duracionLegible(sugerido.duracionS)}.`
          : `Completaste un ciclo (${sugerido.ciclos} de ${sugerido.ciclosParaLargo}). Te sugiero un descanso corto de ${duracionLegible(sugerido.duracionS)}.`}</p>
        <p className={estilos.sub}>Es una sugerencia: no empieza solo.</p>
        <div className={estilos.controles}>
          <button type="button" className={`${estilos.boton} ${estilos.primario}`} disabled={t.ocupado}
            onClick={() => t.descansoIniciar({ tipo: sugerido.tipo, sesionOrigenId: sugerido.sesionOrigenId })}>Iniciar descanso</button>
          <button type="button" className={estilos.boton} disabled={t.ocupado}
            onClick={() => t.descansoOmitir({ tipo: sugerido.tipo, sesionOrigenId: sugerido.sesionOrigenId })}>Omitir</button>
        </div>
      </div>
    </Card>
  );
}

function FormularioIniciar() {
  const t = useTemporizador();
  const [modalidad, setModalidad] = useState('productivity');
  const [frenteId, setFrenteId] = useState('');
  const [actividad, setActividad] = useState('');
  const [intencion, setIntencion] = useState('');
  const [pendienteId, setPendienteId] = useState('');
  const [pendientes, setPendientes] = useState(null);   // null = cargando; [] = ninguno
  const [errorPend, setErrorPend] = useState(null);

  useEffect(() => {
    let vivo = true;
    t.servicio.listarPendientesAbiertos().then(l => { if (vivo) setPendientes(l); }).catch(e => { if (vivo) { setErrorPend(e.message); setPendientes([]); } });
    return () => { vivo = false; };
  }, [t.servicio]);

  async function enviar(e) {
    e.preventDefault();
    if (!frenteId) return;
    await t.focusIniciar({ modalidad, frenteId, actividad: actividad || null, intencion: intencion || null, pendienteId: pendienteId || null });
  }
  const minutos = t.prefs.focus_min;
  return (
    <Card as="section" id="focus-iniciar" titulo="Iniciar Focus" icono="bolt" className={estilos.bloque}>
      <form className={estilos.form} onSubmit={enviar}>
        <fieldset className={estilos.campo}>
          <legend>Modalidad</legend>
          <div className={estilos.opciones}>
            {MODALIDADES.map(m => (
              <label key={m.id} className={estilos.opcion}>
                <input type="radio" name="modalidad" value={m.id} checked={modalidad === m.id} onChange={() => setModalidad(m.id)} />
                <Icon name={m.id === 'productivity' ? 'bolt' : 'sun'} size={18} /> {NOMBRE_MODALIDAD[m.id] ?? m.nombre}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className={estilos.campo}>
          <legend>Frente</legend>
          <div className={estilos.chipsFrente}>
            {FRENTES_DISENO.map(f => (
              <label key={f.id} className={estilos.chipFrente} data-frente={f.id}>
                <input type="radio" name="frente" value={f.id} checked={frenteId === f.id} onChange={() => setFrenteId(f.id)} required />
                {f.nombre}
              </label>
            ))}
          </div>
        </fieldset>
        <details className={estilos.detalles}>
          <summary>Detalles (opcional)</summary>
          <div className={estilos.form}>
            <label className={estilos.campo}>Actividad (opcional)
              <input type="text" value={actividad} onChange={e => setActividad(e.target.value)} maxLength={120} placeholder="¿En qué vas a trabajar?" />
            </label>
            <label className={estilos.campo}>Intención (opcional)
              <input type="text" value={intencion} onChange={e => setIntencion(e.target.value)} maxLength={200} placeholder="¿Qué quieres lograr en esta sesión?" />
            </label>
            {pendientes && pendientes.length > 0 && (
              <label className={estilos.campo}>Pendiente asociado (opcional)
                <select value={pendienteId} onChange={e => setPendienteId(e.target.value)}>
                  <option value="">Ninguno</option>
                  {pendientes.map(p => <option key={p.id} value={p.id}>{p.texto}</option>)}
                </select>
              </label>
            )}
          </div>
        </details>
        {errorPend && <p className={estilos.nota} role="alert">No se pudieron cargar tus pendientes: {errorPend}</p>}
        <button type="submit" className={`${estilos.boton} ${estilos.primario} ${estilos.grande} ${estilos.lleno}`} disabled={t.ocupado || !frenteId}>
          <Icon name="bolt" size={20} /> Iniciar Focus de {minutos} min
        </button>
        {!frenteId && <p className={estilos.ayudaInicio}>Elige un frente para empezar.</p>}
      </form>
    </Card>
  );
}

function HabitosConTemporizador() {
  const t = useTemporizador();
  const [habitos, setHabitos] = useState(null);
  const [errorH, setErrorH] = useState(null);
  useEffect(() => {
    let vivo = true;
    t.servicio.listarHabitosConTemporizador().then(l => { if (vivo) setHabitos(l); }).catch(e => { if (vivo) setErrorH(e.message); });
    return () => { vivo = false; };
  }, [t.servicio]);
  return (
    <Card as="section" id="focus-habitos" titulo="Hábitos con temporizador" icono="heart" className={estilos.bloque}>
      {errorH ? <p role="alert" className={estilos.nota}>No se pudieron cargar los hábitos: {errorH}</p>
        : habitos === null ? <Skeleton variante="texto" lineas={2} etiqueta="Cargando hábitos" />
        : habitos.length === 0 ? <EmptyState compacto icono="heart" titulo="Aún no tienes hábitos con temporizador" descripcion="Los hábitos nuevos con modo «temporizador» aparecerán aquí. Los hábitos de Salud existentes no se modifican." />
        : (
          <ul className={estilos.lista}>
            {habitos.map(h => (
              <li key={h.id} className={estilos.item}>
                <span className={estilos.habitoFila}>
                  <span className={estilos.icoTile} aria-hidden="true"><Icon name="clock" size={18} /></span>
                  <b>{h.nombre}</b>
                </span>
                <button type="button" className={estilos.boton} disabled={t.ocupado} onClick={() => t.habitoIniciar(h.id)}>Iniciar</button>
              </li>
            ))}
          </ul>
        )}
    </Card>
  );
}

function Preferencias({ prefs, guardado, ocupado, onGuardar }) {
  const [v, setV] = useState(null);
  const [msg, setMsg] = useState(null);
  const actual = v ?? prefs;
  const cambiar = (k, val) => setV({ ...actual, [k]: val });
  async function guardar(e) {
    e.preventDefault();
    const r = await onGuardar({
      focus_min: Number(actual.focus_min), descanso_corto_min: Number(actual.descanso_corto_min),
      descanso_largo_min: Number(actual.descanso_largo_min), ciclos_para_largo: Number(actual.ciclos_para_largo),
      avisos: !!actual.avisos, sonido: !!actual.sonido,
    });
    setMsg(r.ok ? 'Preferencias guardadas.' : null);
    if (r.ok) setV(null);
  }
  const num = (k, etiqueta, min, max) => (
    <label className={estilos.campo}>{etiqueta}
      <input type="number" inputMode="numeric" min={min} max={max} value={actual[k]} onChange={e => cambiar(k, e.target.value)} required />
    </label>
  );
  return (
    <Card as="section" id="focus-preferencias" titulo="Preferencias de Focus" icono="sliders" className={estilos.bloque}>
      <details className={estilos.preferencias}>
        <summary>{guardado ? 'Editar preferencias' : 'Valores iniciales (aún no guardaste preferencias)'}</summary>
        <form className={estilos.form} onSubmit={guardar}>
          <div className={estilos.dos}>
            {num('focus_min', 'Enfoque (min)', 1, 240)}
            {num('descanso_corto_min', 'Descanso corto (min)', 1, 60)}
            {num('descanso_largo_min', 'Descanso largo (min)', 1, 120)}
            {num('ciclos_para_largo', 'Ciclos para descanso largo', 2, 12)}
          </div>
          <div className={estilos.interruptores}>
            <label className={estilos.interruptor}><input type="checkbox" checked={!!actual.avisos} onChange={e => cambiar('avisos', e.target.checked)} /> Avisos al terminar</label>
            <label className={estilos.interruptor}><input type="checkbox" checked={!!actual.sonido} onChange={e => cambiar('sonido', e.target.checked)} /> Sonido al terminar</label>
          </div>
          <button type="submit" className={estilos.boton} disabled={ocupado}>Guardar preferencias</button>
          {msg && <p role="status" className={estilos.nota}>{msg}</p>}
        </form>
      </details>
    </Card>
  );
}
