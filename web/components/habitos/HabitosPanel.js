'use client';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import Icon from '@/components/ui/Icon';
import Ring from '@/components/ui/Ring';
import Skeleton from '@/components/ui/Skeleton';
import { createClient } from '@/lib/supabase/client';
import { crearServicioHabitos } from '@/lib/data/habitos';
import { crearCola, almacenPorUsuario, enviadorRpc } from '@/lib/cola/cola';
import { ejecutar } from '@/lib/data/temporizador';
import { fechaBogota, inicioSemana, sumarDias, etiquetaFecha } from '@/lib/domain/fechas';
import { traducirError, duracionLegible, formatoReloj } from '@/lib/domain/temporizador';
import { ContextoTemporizador } from '@/components/timer/TemporizadorProvider';
import { DIAS_CORTOS, hayOcurrencia, ocurrenciasEntre, tiempoVigente, textoProgramacion, versionVigente, estadoDeFecha, wellbeing } from '@/lib/domain/habitos';
import estilos from './Habitos.module.css';

const hora = iso => new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' });

// `servicio` es opcional: permite inyectar otra fuente de datos (pruebas y vistas previas); por defecto usa Supabase.
export default function HabitosPanel({ servicio: inyectado = null }) {
  const servicio = useMemo(() => {
    if (inyectado) return inyectado;
    const supabase = createClient();
    const cola = crearCola({
      almacen: almacenPorUsuario(async () => (await supabase.auth.getUser()).data.user?.id),
      enviar: enviadorRpc(supabase),
      enLinea: () => navigator.onLine !== false,
    });
    return crearServicioHabitos(supabase, { cola });
  }, [inyectado]);
  const [colaEstado, setColaEstado] = useState({ pendientes: [], rechazadas: [] });
  const [estado, setEstado] = useState({ cargando: true, error: null, datos: null });
  const [aviso, setAviso] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [creando, setCreando] = useState(false);
  const [enLinea, setEnLinea] = useState(true);
  const temp = useContext(ContextoTemporizador);   // solo lectura, para mostrar el temporizador en vivo; null fuera del shell
  const hoy = fechaBogota();
  const desde = sumarDias(inicioSemana(hoy), -21);

  const cargar = useCallback(async () => {
    try {
      const datos = await servicio.cargarHabitos({ desde });
      setEstado({ cargando: false, error: null, datos });
    } catch (e) {
      setEstado({ cargando: false, error: traducirError(e), datos: null });
    }
  }, [servicio, desde]);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    const actualizar = () => setEnLinea(navigator.onLine !== false);
    actualizar();
    window.addEventListener('online', actualizar); window.addEventListener('offline', actualizar);
    return () => { window.removeEventListener('online', actualizar); window.removeEventListener('offline', actualizar); };
  }, []);

  // Cola sin conexión: se refleja lo pendiente/rechazado y se reenvía al volver la conexión, al recuperar el foco y cada 30 s mientras haya pendientes.
  const refrescarCola = useCallback(async () => {
    try { setColaEstado({ pendientes: await servicio.pendientesCola?.() ?? [], rechazadas: await servicio.rechazadasCola?.() ?? [] }); } catch { /* sin almacenamiento: no hay cola */ }
  }, [servicio]);
  const sincronizar = useCallback(async () => {
    try {
      const r = await servicio.enviarPendientes?.();
      await refrescarCola();
      if (r?.enviadas > 0) await cargar();
    } catch { /* se reintentará */ }
  }, [servicio, refrescarCola, cargar]);
  useEffect(() => {
    sincronizar();
    const alVolver = () => sincronizar();
    const alFoco = () => { if (document.visibilityState === 'visible') sincronizar(); };
    window.addEventListener('online', alVolver);
    document.addEventListener('visibilitychange', alFoco);
    const t = setInterval(() => { if (colaEstado.pendientes.length > 0) sincronizar(); }, 30000);
    return () => { window.removeEventListener('online', alVolver); document.removeEventListener('visibilitychange', alFoco); clearInterval(t); };
  }, [sincronizar, colaEstado.pendientes.length]);

  async function accion(fn, okMsg) {
    setOcupado(true); setAviso(null);
    const r = await ejecutar(fn);
    const encolada = r.ok && r.data?.encolada;
    setAviso(r.ok ? { ok: true, texto: encolada ? 'Sin conexión: guardado en este dispositivo y se enviará al volver. Si borras los datos del navegador antes, se pierde.' : okMsg } : { ok: false, texto: r.error.mensaje });
    if (encolada) await refrescarCola();
    await cargar();
    setOcupado(false);
    return r;
  }

  const resumen = construirResumen(estado.datos, hoy);
  const sync = { enLinea, pendientes: colaEstado.pendientes.length };
  const { cargando, error, datos } = estado;
  const marco = (hijos, conResumen = true) => (
    <div className={estilos.pagina}>
      <EncabezadoHabitos hoy={hoy} resumen={conResumen ? resumen : null} sync={sync} />
      {hijos}
    </div>
  );
  if (cargando) return marco(<div className={estilos.rejilla}><div className={estilos.principal}><Skeleton variante="bloque" alto={180} etiqueta="Cargando hábitos" /><Skeleton variante="bloque" alto={180} etiqueta="Cargando hábitos" /></div><div className={estilos.lateral}><Skeleton variante="bloque" alto={140} etiqueta="Cargando bienestar" /></div></div>, false);
  if (error?.codigo === 'fase3_no_disponible') {
    return marco(
      <Card as="section" id="habitos-no-disponible" titulo="Hábitos aún no está activado" icono="alert" className={estilos.bloque}>
        <p>{error.mensaje}</p>
        <p className={estilos.nota}>La interfaz está lista, pero las tablas y funciones de hábitos de la Fase 3 todavía no existen en la base de datos. Mientras tanto no se guarda nada y los hábitos de Salud siguen funcionando igual.</p>
      </Card>, false);
  }
  if (error) return marco(<ErrorState titulo="No se pudieron leer los hábitos" mensaje={error.mensaje} onReintentar={cargar} />, false);

  const lunes = inicioSemana(hoy);
  const domingo = sumarDias(lunes, 6);
  const activos = datos.habitos.filter(h => !h.archivado_desde || hoy < h.archivado_desde);
  const archivados = datos.habitos.filter(h => h.archivado_desde && !(hoy < h.archivado_desde));
  const w = wellbeing({ habitos: datos.habitos, versiones: datos.versiones, tiempos: datos.tiempos, desde: lunes, hasta: domingo, hoy });
  const hoyTiene = h => hayOcurrencia(h, datos.versiones.filter(v => v.habito_id === h.id), hoy);
  const vivoDe = h => (temp?.inst && !temp.inst.incompleto && temp.inst.tipo === 'habito' && temp.inst.habitoId === h.id && temp.lectura ? { pausado: temp.inst.pausado, segundos: temp.lectura.transcurridoS } : null);
  const porEnviar = h => colaEstado.pendientes.filter(o => o.args?.p_habito_id === h.id).length;

  return marco(
    <>
      {aviso && (
        <div className={`${estilos.aviso} ${aviso.ok ? estilos.avisoOk : estilos.avisoError}`} role={aviso.ok ? 'status' : 'alert'}>
          <span>{aviso.texto}</span>
          <button type="button" className={estilos.boton} onClick={() => setAviso(null)}>Cerrar</button>
        </div>
      )}
      <div className={estilos.rejilla}>
        <aside className={estilos.lateral} aria-label="Resumen y acciones">
          <Card as="section" id="habitos-semana" titulo="Bienestar de la semana" icono="heart" className={estilos.bloque}
            accion={w.enCurso ? <Chip tono="advertencia" tamano="sm">En curso</Chip> : null}>
            {w.estado === 'ok' ? (
              <div className={estilos.bienestar}>
                <Ring valor={w.valor / 100} etiqueta="Cumplimiento de hábitos de la semana" tono="exito" tamano={112} grosor={11} />
                <div className={estilos.bienestarTexto}>
                  <b>{duracionLegible(w.realizadoS)} de {duracionLegible(w.objetivoS)}</b>
                  <span>{w.ocurrencias} ocurrencias que ya llegaron, con tope por ocurrencia. Una sin tiempo cuenta como 0 real.</span>
                </div>
              </div>
            ) : <EmptyState compacto icono="heart" titulo="Sin datos" descripcion="Todavía no hay ocurrencias de hábitos programadas que hayan llegado en esta semana." />}
          </Card>

          <div className={estilos.colaLista}>
            <button type="button" className={`${estilos.boton} ${estilos.primario} ${estilos.lleno}`} aria-expanded={creando} aria-controls="habitos-crear" onClick={() => setCreando(c => !c)}>
              <Icon name="plus" size={18} /> {creando ? 'Cerrar formulario' : 'Nuevo hábito'}
            </button>
            {(colaEstado.pendientes.length > 0 || colaEstado.rechazadas.length > 0) && (
              <Card as="section" id="habitos-cola" titulo="Sin sincronizar" icono="alert" className={estilos.bloque}>
                {colaEstado.pendientes.length > 0 && (
                  <p className={estilos.sub}>{colaEstado.pendientes.length} registro(s) de tiempo guardados en este dispositivo esperan conexión. <button type="button" className={`${estilos.boton} ${estilos.ghost}`} onClick={sincronizar}>Reintentar ahora</button></p>
                )}
                {colaEstado.rechazadas.map(o => (
                  <div key={o.op_id} className={`${estilos.aviso} ${estilos.avisoError}`} role="alert">
                    <span>El servidor rechazó un registro del {o.args?.p_fecha}: {o.motivo}</span>
                    <button type="button" className={estilos.boton} onClick={async () => { await servicio.descartarRechazada?.(o.op_id); refrescarCola(); }}>Entendido</button>
                  </div>
                ))}
              </Card>
            )}
          </div>
        </aside>

        <div className={estilos.principal}>
          {creando && <FormularioCrear ocupado={ocupado} hoy={hoy} onCrear={async v => { const r = await accion(() => servicio.crear(v), 'Hábito creado.'); if (r.ok) setCreando(false); return r; }} />}
          <Card as="section" id="habitos-hoy" titulo={`Hoy · ${etiquetaFecha(hoy)}`} icono="check" className={estilos.bloque}>
            {activos.length === 0 ? (
              <EmptyState icono="heart" titulo="Aún no tienes hábitos nuevos" descripcion="Crea el primero para empezar a registrar tu tiempo. Los hábitos de Salud existentes no se modifican.">
                {!creando && <button type="button" className={`${estilos.boton} ${estilos.primario}`} onClick={() => setCreando(true)}><Icon name="plus" size={18} /> Crear tu primer hábito</button>}
              </EmptyState>
            ) : (
              <ul className={estilos.listaHabitos}>
                {activos.map(h => (
                  <FilaHabito key={h.id} habito={h} datos={datos} hoy={hoy} programado={hoyTiene(h)} ocupado={ocupado} servicio={servicio} accion={accion} vivo={vivoDe(h)} porEnviar={porEnviar(h)} />
                ))}
              </ul>
            )}
          </Card>

          {archivados.length > 0 && (
            <Card as="section" id="habitos-archivados" titulo="Archivados" icono="layers" variante="plana" className={estilos.bloque}>
              <ul className={estilos.lista}>{archivados.map(h => <li key={h.id} className={estilos.item}><span>{h.nombre}</span><span className={estilos.sub}>desde {h.archivado_desde}</span></li>)}</ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

// Cifras del encabezado: solo conteos reales de lo cargado.
function construirResumen(datos, hoy) {
  if (!datos) return null;
  const activos = datos.habitos.filter(h => !h.archivado_desde || hoy < h.archivado_desde);
  const hoyN = activos.filter(h => hayOcurrencia(h, datos.versiones.filter(v => v.habito_id === h.id), hoy)).length;
  return { activos: activos.length, hoy: hoyN };
}

function EncabezadoHabitos({ hoy, resumen, sync }) {
  const chip = sync.pendientes > 0
    ? { tono: 'advertencia', texto: `${sync.pendientes} por enviar` }
    : !sync.enLinea ? { tono: 'advertencia', texto: 'Sin conexión' } : { tono: 'exito', texto: 'Sincronizado' };
  return (
    <header className={estilos.encabezado}>
      <div className={estilos.encabezadoTexto}>
        <div className="date">Hábitos nuevos</div>
        <h1>Hábitos</h1>
        <p className={estilos.resumen}>
          {etiquetaFecha(hoy)}{resumen ? ` · ${resumen.activos} ${resumen.activos === 1 ? 'hábito activo' : 'hábitos activos'} · ${resumen.hoy} con ocurrencia hoy` : ''}
        </p>
      </div>
      <Chip tono={chip.tono} icono={chip.tono === 'exito' ? 'check' : 'alert'} role="status">{chip.texto}</Chip>
    </header>
  );
}

const DIA_ESTADOS = { cumplido: 'cumplido', parcial: 'con tiempo parcial', sin_tiempo: 'sin tiempo registrado', hoy: 'hoy, en curso', sin_ocurrencia: 'sin ocurrencia' };

/** Estado real de una ocurrencia en una fecha. Sin rachas ni puntajes: solo lo registrado. */
function estadoDia(habito, versiones, tiempos, f, hoy) {
  if (!hayOcurrencia(habito, versiones, f)) return 'sin_ocurrencia';
  const fila = tiempos.find(t => t.habito_id === habito.id && t.fecha === f);
  const t = tiempoVigente(fila);
  const objetivo = versionVigente(versiones, f).objetivo_s;
  if (t !== null && t >= objetivo) return 'cumplido';
  if (t !== null && t > 0) return 'parcial';
  return f === hoy ? 'hoy' : 'sin_tiempo';
}

function TiraSemana({ habito, versiones, tiempos, hoy }) {
  const fechas = Array.from({ length: 7 }, (_, i) => sumarDias(hoy, i - 6));
  return (
    <ul className={estilos.dias} aria-label={`Últimos 7 días de ${habito.nombre}`}>
      {fechas.map(f => {
        const e = estadoDia(habito, versiones, tiempos, f, hoy);
        const nombre = DIAS_CORTOS[(new Date(`${f}T12:00:00Z`).getUTCDay() + 6) % 7];
        return (
          <li key={f} className={estilos.dia}>
            <span className={estilos.punto} data-estado={e} aria-hidden="true" />
            <span className={f === hoy ? estilos.diaHoy : ''} aria-hidden="true">{nombre}</span>
            <span className={estilos.soloLector}>{etiquetaFecha(f)}: {DIA_ESTADOS[e]}</span>
          </li>
        );
      })}
    </ul>
  );
}

function FilaHabito({ habito, datos, hoy, programado, ocupado, servicio, accion, vivo, porEnviar }) {
  const versiones = datos.versiones.filter(v => v.habito_id === habito.id);
  const vigente = versionVigente(versiones, hoy) ?? versionVigente(versiones, '9999-12-31');
  const [abierto, setAbierto] = useState(null);    // null | 'registrar' | 'historial' | 'programar'
  const fila = datos.tiempos.find(t => t.habito_id === habito.id && t.fecha === hoy);
  const t = tiempoVigente(fila);
  const objetivo = programado ? versionVigente(versiones, hoy).objetivo_s : null;
  const fuente = fila?.fuente === 'manual' ? 'Manual' : fila?.fuente === 'temporizador' ? 'Temporizador' : null;
  const esTemporizador = habito.modo_registro === 'temporizador';
  const alternar = clave => setAbierto(abierto === clave ? null : clave);
  return (
    <Card as="li" className={`${estilos.bloque} ${estilos.habito} ${vivo ? estilos.vivoCard : ''}`}>
      <div className={estilos.habitoCabecera}>
        <span className={estilos.icoTile} aria-hidden="true"><Icon name={esTemporizador ? 'clock' : 'check'} size={20} /></span>
        <div className={estilos.habitoTitulo}>
          <b>{habito.nombre}</b>
          <p className={estilos.sub}>{textoProgramacion(vigente)} · {esTemporizador ? 'con temporizador' : 'registro manual'}</p>
        </div>
      </div>
      <div className={estilos.chips}>
        {programado ? <Chip tono="primario" tamano="sm">Día en curso</Chip> : <Chip tono="neutro" tamano="sm">Sin ocurrencia hoy</Chip>}
        {fuente && <Chip tono="neutro" tamano="sm">{fuente}</Chip>}
        {porEnviar > 0 && <Chip tono="advertencia" tamano="sm" icono="alert">{porEnviar} por enviar</Chip>}
      </div>
      {programado && (
        <div className={estilos.progresoFila}>
          <Ring valor={t === null ? 0 : Math.min(1, t / objetivo)} etiqueta={`Hoy en ${habito.nombre}`} tono="exito" tamano={72} grosor={8} />
          <div className={estilos.progresoTexto}>
            <b>{t === null ? 'Sin tiempo registrado' : `${duracionLegible(t)} de ${duracionLegible(objetivo)}`}</b>
            <span>{t === null ? 'Cuenta como 0 hasta que registres tiempo.' : t > objetivo ? 'El exceso no compensa otras ocurrencias.' : 'Objetivo de hoy.'}</span>
          </div>
        </div>
      )}
      {vivo && (
        <div className={`${estilos.vivo} ${vivo.pausado ? estilos.vivoPausa : ''}`} role="timer" aria-label={`Temporizador de ${habito.nombre}`}>
          <span className={estilos.vivoEstado}><span className={estilos.pulso} aria-hidden="true" />{vivo.pausado ? 'En pausa' : 'Cronometrando'}</span>
          <span className={estilos.reloj}>{formatoReloj(vivo.segundos)}</span>
        </div>
      )}
      <TiraSemana habito={habito} versiones={versiones} tiempos={datos.tiempos} hoy={hoy} />
      <div className={estilos.acciones}>
        {esTemporizador
          ? <Link href="/focus" className={`${estilos.boton} ${estilos.primario}`}><Icon name="clock" size={18} /> {vivo ? 'Ver en Focus' : 'Cronometrar'}</Link>
          : <button type="button" className={`${estilos.boton} ${estilos.primario}`} aria-expanded={abierto === 'registrar'} onClick={() => alternar('registrar')}>Registrar tiempo</button>}
        <div className={estilos.secundarias}>
          {esTemporizador && <button type="button" className={`${estilos.boton} ${estilos.ghost}`} aria-expanded={abierto === 'registrar'} onClick={() => alternar('registrar')}>Registrar tiempo</button>}
          <button type="button" className={`${estilos.boton} ${estilos.ghost}`} aria-expanded={abierto === 'historial'} onClick={() => alternar('historial')}>Historial</button>
          <button type="button" className={`${estilos.boton} ${estilos.ghost}`} aria-expanded={abierto === 'programar'} onClick={() => alternar('programar')}>Programación</button>
        </div>
      </div>
      {abierto === 'registrar' && <div className={estilos.panel}><FormularioManual habito={habito} versiones={versiones} hoy={hoy} ocupado={ocupado} onGuardar={v => accion(() => servicio.registrarManual({ habitoId: habito.id, ...v }), 'Tiempo registrado: reemplaza lo acumulado de esa fecha.')} /></div>}
      {abierto === 'historial' && <div className={estilos.panel}><Historial habito={habito} versiones={versiones} hoy={hoy} servicio={servicio} /></div>}
      {abierto === 'programar' && <div className={estilos.panel}><Programacion habito={habito} hoy={hoy} ocupado={ocupado} accion={accion} servicio={servicio} /></div>}
    </Card>
  );
}

function FormularioManual({ habito, versiones, hoy, ocupado, onGuardar }) {
  const fechas = ocurrenciasEntre(habito, versiones, sumarDias(hoy, -13), hoy).reverse();
  const [fecha, setFecha] = useState(fechas[0] ?? '');
  const [minutos, setMinutos] = useState('');
  if (!fechas.length) return <p className={estilos.nota}>No hay ocurrencias programadas en los últimos 14 días: el registro manual se rechaza sin ocurrencia (T-13).</p>;
  return (
    <form className={estilos.form} onSubmit={e => { e.preventDefault(); onGuardar({ fecha, segundos: Math.round(Number(minutos) * 60) }); setMinutos(''); }}>
      <div className={estilos.dos}>
        <label className={estilos.campo}>Fecha
          <select value={fecha} onChange={e => setFecha(e.target.value)}>
            {fechas.map(f => <option key={f} value={f}>{etiquetaFecha(f)}{estadoDeFecha(f, hoy) === 'en_curso' ? ' (hoy)' : ''}</option>)}
          </select>
        </label>
        <label className={estilos.campo}>Tiempo realizado (min)
          <input type="number" inputMode="decimal" min="0" step="1" value={minutos} onChange={e => setMinutos(e.target.value)} required />
        </label>
      </div>
      <p className={estilos.nota}>Un registro manual reemplaza el tiempo acumulado de esa fecha (no se suma) y queda en el historial.</p>
      <button type="submit" className={`${estilos.boton} ${estilos.primario}`} disabled={ocupado || minutos === ''}>Guardar tiempo</button>
    </form>
  );
}

function Historial({ habito, versiones, hoy, servicio }) {
  const fechas = ocurrenciasEntre(habito, versiones, sumarDias(hoy, -13), hoy).reverse();
  const [fecha, setFecha] = useState(fechas[0] ?? '');
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!fecha) return undefined;
    let vivo = true;
    servicio.historial({ habitoId: habito.id, fecha }).then(f => vivo && setFilas(f)).catch(e => vivo && setError(traducirError(e).mensaje));
    return () => { vivo = false; };
  }, [servicio, habito.id, fecha]);
  if (!fechas.length) return <p className={estilos.nota}>Sin ocurrencias recientes.</p>;
  return (
    <div>
      <label className={estilos.campo}>Fecha
        <select value={fecha} onChange={e => { setFilas(null); setFecha(e.target.value); }}>
          {fechas.map(f => <option key={f} value={f}>{etiquetaFecha(f)}</option>)}
        </select>
      </label>
      {error ? <p role="alert" className={estilos.nota}>{error}</p>
        : filas === null ? <Skeleton variante="texto" lineas={2} etiqueta="Cargando historial" />
        : filas.length === 0 ? <p className={estilos.nota}>Esa fecha no tiene modificaciones registradas.</p>
        : (
          <ul className={estilos.lista}>
            {filas.map(f => (
              <li key={f.id} className={estilos.item}>
                <span>{f.valor_anterior_s === null ? 'sin valor previo' : duracionLegible(f.valor_anterior_s)} → <b>{duracionLegible(f.valor_nuevo_s)}</b></span>
                <span className={estilos.sub}>{f.fuente === 'manual' ? 'Manual' : 'Temporizador'} · {hora(f.creado_en)}</span>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}

const ATAJOS_MIN = [15, 30, 45, 60];

function CamposProgramacion({ v, set }) {
  const alternar = d => set({ ...v, dias: v.dias.includes(d) ? v.dias.filter(x => x !== d) : [...v.dias, d].sort() });
  return (
    <>
      <fieldset className={estilos.campo}>
        <legend>Frecuencia</legend>
        <div className={estilos.opciones}>
          <label className={estilos.opcion}><input type="radio" name={`frec-${v.id ?? 'n'}`} checked={v.frecuencia === 'diaria'} onChange={() => set({ ...v, frecuencia: 'diaria' })} /> Todos los días</label>
          <label className={estilos.opcion}><input type="radio" name={`frec-${v.id ?? 'n'}`} checked={v.frecuencia === 'dias'} onChange={() => set({ ...v, frecuencia: 'dias' })} /> Días específicos</label>
        </div>
      </fieldset>
      {v.frecuencia === 'dias' && (
        <div className={estilos.chipsDias} role="group" aria-label="Días de la semana">
          {DIAS_CORTOS.map((n, d) => <label key={d} className={estilos.chipDia}><input type="checkbox" checked={v.dias.includes(d)} onChange={() => alternar(d)} /> {n}</label>)}
        </div>
      )}
      <label className={estilos.campo}>Duración objetivo por ocurrencia (min)
        <input type="number" inputMode="numeric" min="1" step="1" value={v.minutos} onChange={e => set({ ...v, minutos: e.target.value })} required />
      </label>
      <div className={estilos.atajos} role="group" aria-label="Atajos de duración">
        {ATAJOS_MIN.map(m => <button key={m} type="button" className={estilos.atajo} aria-pressed={String(v.minutos) === String(m)} onClick={() => set({ ...v, minutos: String(m) })}>{m} min</button>)}
      </div>
    </>
  );
}

function FormularioCrear({ ocupado, hoy, onCrear }) {
  const vacio = { nombre: '', modo: 'manual', frecuencia: 'diaria', dias: [], minutos: '30' };
  const [v, setV] = useState(vacio);
  const valido = v.nombre.trim() && Number(v.minutos) > 0 && (v.frecuencia === 'diaria' || v.dias.length > 0);
  return (
    <Card as="section" id="habitos-crear" titulo="Nuevo hábito" icono="plus" className={estilos.bloque}>
      <form className={estilos.form} onSubmit={async e => { e.preventDefault(); const r = await onCrear({ nombre: v.nombre.trim(), modo: v.modo, frecuencia: v.frecuencia, dias: v.dias, objetivoS: Math.round(Number(v.minutos) * 60), desde: hoy }); if (r.ok) setV(vacio); }}>
        <label className={estilos.campo}>Nombre
          <input type="text" value={v.nombre} onChange={e => setV({ ...v, nombre: e.target.value })} maxLength={80} placeholder="Correr, Leer, Caminar…" required />
        </label>
        <fieldset className={estilos.campo}>
          <legend>Cómo registras el cumplimiento</legend>
          <div className={estilos.opciones}>
            <label className={estilos.opcion}><input type="radio" name="modo" checked={v.modo === 'manual'} onChange={() => setV({ ...v, modo: 'manual' })} /> <Icon name="check" size={16} /> Manual</label>
            <label className={estilos.opcion}><input type="radio" name="modo" checked={v.modo === 'temporizador'} onChange={() => setV({ ...v, modo: 'temporizador' })} /> <Icon name="clock" size={16} /> Temporizador</label>
          </div>
        </fieldset>
        <CamposProgramacion v={v} set={setV} />
        <button type="submit" className={`${estilos.boton} ${estilos.primario}`} disabled={ocupado || !valido}>Crear hábito</button>
      </form>
    </Card>
  );
}

function Programacion({ habito, hoy, ocupado, accion, servicio }) {
  const [v, setV] = useState({ id: habito.id, frecuencia: 'diaria', dias: [], minutos: '30', desde: sumarDias(hoy, 1) });
  const [nombre, setNombre] = useState(habito.nombre);
  return (
    <div className={estilos.form}>
      <form className={estilos.form} onSubmit={e => { e.preventDefault(); accion(() => servicio.renombrar({ habitoId: habito.id, nombre }), 'Nombre actualizado.'); }}>
        <label className={estilos.campo}>Nombre
          <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} maxLength={80} required />
        </label>
        <button type="submit" className={estilos.boton} disabled={ocupado || !nombre.trim() || nombre.trim() === habito.nombre}>Renombrar</button>
      </form>
      <form className={estilos.form} onSubmit={e => { e.preventDefault(); accion(() => servicio.programar({ habitoId: habito.id, frecuencia: v.frecuencia, dias: v.dias, objetivoS: Math.round(Number(v.minutos) * 60), desde: v.desde }), 'Nueva programación guardada: rige desde esa fecha y no cambia el historial.'); }}>
        <CamposProgramacion v={v} set={setV} />
        <label className={estilos.campo}>Rige desde
          <input type="date" min={hoy} value={v.desde} onChange={e => setV({ ...v, desde: e.target.value })} required />
        </label>
        <button type="submit" className={estilos.boton} disabled={ocupado || (v.frecuencia === 'dias' && v.dias.length === 0)}>Guardar nueva programación</button>
      </form>
      <button type="button" className={`${estilos.boton} ${estilos.peligro}`} disabled={ocupado}
        onClick={() => accion(() => servicio.archivar({ habitoId: habito.id }), 'Hábito archivado desde mañana: el historial se conserva.')}>Archivar desde mañana</button>
    </div>
  );
}
