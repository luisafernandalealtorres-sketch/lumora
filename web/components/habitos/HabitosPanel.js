'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import ProgressBar from '@/components/ui/ProgressBar';
import Skeleton from '@/components/ui/Skeleton';
import { createClient } from '@/lib/supabase/client';
import { crearServicioHabitos } from '@/lib/data/habitos';
import { ejecutar } from '@/lib/data/temporizador';
import { fechaBogota, inicioSemana, sumarDias, etiquetaFecha } from '@/lib/domain/fechas';
import { traducirError, duracionLegible } from '@/lib/domain/temporizador';
import { DIAS_CORTOS, hayOcurrencia, ocurrenciasEntre, tiempoVigente, textoProgramacion, versionVigente, estadoDeFecha, wellbeing } from '@/lib/domain/habitos';
import estilos from '@/components/timer/Timer.module.css';

const hora = iso => new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' });

// `servicio` es opcional: permite inyectar otra fuente de datos (pruebas y vistas previas); por defecto usa Supabase.
export default function HabitosPanel({ servicio: inyectado = null }) {
  const servicio = useMemo(() => inyectado ?? crearServicioHabitos(createClient()), [inyectado]);
  const [estado, setEstado] = useState({ cargando: true, error: null, datos: null });
  const [aviso, setAviso] = useState(null);
  const [ocupado, setOcupado] = useState(false);
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

  async function accion(fn, okMsg) {
    setOcupado(true); setAviso(null);
    const r = await ejecutar(fn);
    setAviso(r.ok ? { ok: true, texto: okMsg } : { ok: false, texto: r.error.mensaje });
    await cargar();
    setOcupado(false);
    return r;
  }

  const { cargando, error, datos } = estado;
  if (cargando) return <Skeleton variante="bloque" alto={200} etiqueta="Cargando hábitos" />;
  if (error?.codigo === 'fase3_no_disponible') {
    return (
      <Card as="section" id="habitos-no-disponible" titulo="Hábitos aún no está activado" icono="alert">
        <p>{error.mensaje}</p>
        <p className={estilos.nota}>La interfaz está lista, pero las tablas y funciones de hábitos de la Fase 3 todavía no existen en la base de datos. Mientras tanto no se guarda nada y los hábitos de Salud siguen funcionando igual.</p>
      </Card>
    );
  }
  if (error) return <ErrorState titulo="No se pudieron leer los hábitos" mensaje={error.mensaje} onReintentar={cargar} />;

  const lunes = inicioSemana(hoy);
  const domingo = sumarDias(lunes, 6);
  const activos = datos.habitos.filter(h => !h.archivado_desde || hoy < h.archivado_desde);
  const archivados = datos.habitos.filter(h => h.archivado_desde && !(hoy < h.archivado_desde));
  const w = wellbeing({ habitos: datos.habitos, versiones: datos.versiones, tiempos: datos.tiempos, desde: lunes, hasta: domingo, hoy });
  const hoyTiene = h => hayOcurrencia(h, datos.versiones.filter(v => v.habito_id === h.id), hoy);

  return (
    <div className={estilos.pagina}>
      {aviso && (
        <div className={`${estilos.aviso} ${aviso.ok ? '' : estilos.avisoError}`} role={aviso.ok ? 'status' : 'alert'}>
          <span>{aviso.texto}</span>
          <button type="button" className={estilos.boton} onClick={() => setAviso(null)}>Cerrar</button>
        </div>
      )}

      <Card as="section" id="habitos-semana" titulo="Bienestar de la semana" icono="heart"
        accion={w.enCurso ? <Chip tono="advertencia" tamano="sm">En curso</Chip> : null}>
        {w.estado === 'ok' ? (
          <>
            <ProgressBar valor={w.valor / 100} etiqueta="Cumplimiento de hábitos de la semana" tono="exito" mostrarValor />
            <p className={estilos.nota}>{duracionLegible(w.realizadoS)} registrados (con tope por ocurrencia) de {duracionLegible(w.objetivoS)} objetivo, en {w.ocurrencias} ocurrencias que ya llegaron. Una ocurrencia sin tiempo cuenta como 0 real.</p>
          </>
        ) : <EmptyState compacto icono="heart" titulo="Sin datos" descripcion="Todavía no hay ocurrencias de hábitos programadas que hayan llegado en esta semana." />}
      </Card>

      <Card as="section" id="habitos-hoy" titulo={`Hoy · ${etiquetaFecha(hoy)}`} icono="check">
        {activos.length === 0 ? (
          <EmptyState compacto icono="heart" titulo="Aún no tienes hábitos nuevos" descripcion="Crea el primero abajo. Los hábitos de Salud existentes no se modifican." />
        ) : (
          <ul className={estilos.lista}>
            {activos.map(h => (
              <FilaHabito key={h.id} habito={h} datos={datos} hoy={hoy} programado={hoyTiene(h)} ocupado={ocupado} servicio={servicio} accion={accion} />
            ))}
          </ul>
        )}
      </Card>

      <FormularioCrear ocupado={ocupado} hoy={hoy} onCrear={v => accion(() => servicio.crear(v), 'Hábito creado.')} />

      {archivados.length > 0 && (
        <Card as="section" id="habitos-archivados" titulo="Archivados" icono="layers" variante="plana">
          <ul className={estilos.lista}>{archivados.map(h => <li key={h.id} className={estilos.item}><span>{h.nombre}</span><span className={estilos.sub}>desde {h.archivado_desde}</span></li>)}</ul>
        </Card>
      )}
    </div>
  );
}

function FilaHabito({ habito, datos, hoy, programado, ocupado, servicio, accion }) {
  const versiones = datos.versiones.filter(v => v.habito_id === habito.id);
  const vigente = versionVigente(versiones, hoy) ?? versionVigente(versiones, '9999-12-31');
  const [abierto, setAbierto] = useState(null);    // null | 'registrar' | 'historial' | 'programar'
  const fila = datos.tiempos.find(t => t.habito_id === habito.id && t.fecha === hoy);
  const t = tiempoVigente(fila);
  const objetivo = programado ? versionVigente(versiones, hoy).objetivo_s : null;
  const fuente = fila?.fuente === 'manual' ? 'Manual' : fila?.fuente === 'temporizador' ? 'Temporizador' : null;
  return (
    <li className={estilos.item} style={{ display: 'grid' }}>
      <div className={estilos.fila}>
        <div>
          <b>{habito.nombre}</b>
          <div className={estilos.sub}>{textoProgramacion(vigente)} · {habito.modo_registro === 'temporizador' ? 'con temporizador' : 'registro manual'}</div>
        </div>
        <div className={estilos.chips}>
          {programado ? <Chip tono="primario" tamano="sm">Día en curso</Chip> : <Chip tono="neutro" tamano="sm">Sin ocurrencia hoy</Chip>}
          {fuente && <Chip tono="neutro" tamano="sm">{fuente}</Chip>}
        </div>
      </div>
      {programado && (
        <ProgressBar valor={t === null ? 0 : Math.min(1, t / objetivo)} etiqueta={`Hoy en ${habito.nombre}`} tono="exito" mostrarValor />
      )}
      {programado && <p className={estilos.nota}>{t === null ? 'Sin tiempo registrado todavía (cuenta como 0).' : `${duracionLegible(t)} de ${duracionLegible(objetivo)}${t > objetivo ? ' (el exceso no compensa otras ocurrencias)' : ''}`}</p>}
      <div className={estilos.controles}>
        {habito.modo_registro === 'temporizador' && <Link href="/focus" className={estilos.boton}>Cronometrar en Focus</Link>}
        <button type="button" className={estilos.boton} onClick={() => setAbierto(abierto === 'registrar' ? null : 'registrar')}>Registrar tiempo</button>
        <button type="button" className={estilos.boton} onClick={() => setAbierto(abierto === 'historial' ? null : 'historial')}>Historial</button>
        <button type="button" className={estilos.boton} onClick={() => setAbierto(abierto === 'programar' ? null : 'programar')}>Programación</button>
      </div>
      {abierto === 'registrar' && <FormularioManual habito={habito} versiones={versiones} hoy={hoy} ocupado={ocupado} onGuardar={v => accion(() => servicio.registrarManual({ habitoId: habito.id, ...v }), 'Tiempo registrado: reemplaza lo acumulado de esa fecha.')} />}
      {abierto === 'historial' && <Historial habito={habito} versiones={versiones} hoy={hoy} servicio={servicio} />}
      {abierto === 'programar' && <Programacion habito={habito} hoy={hoy} ocupado={ocupado} accion={accion} servicio={servicio} />}
    </li>
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

function CamposProgramacion({ v, set }) {
  const alternar = d => set({ ...v, dias: v.dias.includes(d) ? v.dias.filter(x => x !== d) : [...v.dias, d].sort() });
  return (
    <>
      <fieldset className={estilos.campo}>
        <legend>Frecuencia</legend>
        <div className={estilos.radios}>
          <label className={estilos.radio}><input type="radio" name={`frec-${v.id ?? 'n'}`} checked={v.frecuencia === 'diaria'} onChange={() => set({ ...v, frecuencia: 'diaria' })} /> Todos los días</label>
          <label className={estilos.radio}><input type="radio" name={`frec-${v.id ?? 'n'}`} checked={v.frecuencia === 'dias'} onChange={() => set({ ...v, frecuencia: 'dias' })} /> Días específicos</label>
        </div>
      </fieldset>
      {v.frecuencia === 'dias' && (
        <div className={estilos.radios} role="group" aria-label="Días de la semana">
          {DIAS_CORTOS.map((n, d) => <label key={d} className={estilos.radio}><input type="checkbox" checked={v.dias.includes(d)} onChange={() => alternar(d)} /> {n}</label>)}
        </div>
      )}
      <label className={estilos.campo}>Duración objetivo por ocurrencia (min)
        <input type="number" inputMode="numeric" min="1" step="1" value={v.minutos} onChange={e => set({ ...v, minutos: e.target.value })} required />
      </label>
    </>
  );
}

function FormularioCrear({ ocupado, hoy, onCrear }) {
  const vacio = { nombre: '', modo: 'manual', frecuencia: 'diaria', dias: [], minutos: '30' };
  const [v, setV] = useState(vacio);
  const valido = v.nombre.trim() && Number(v.minutos) > 0 && (v.frecuencia === 'diaria' || v.dias.length > 0);
  return (
    <Card as="section" id="habitos-crear" titulo="Nuevo hábito" icono="plus">
      <form className={estilos.form} onSubmit={async e => { e.preventDefault(); const r = await onCrear({ nombre: v.nombre.trim(), modo: v.modo, frecuencia: v.frecuencia, dias: v.dias, objetivoS: Math.round(Number(v.minutos) * 60), desde: hoy }); if (r.ok) setV(vacio); }}>
        <label className={estilos.campo}>Nombre
          <input type="text" value={v.nombre} onChange={e => setV({ ...v, nombre: e.target.value })} maxLength={80} placeholder="Correr, Leer, Caminar…" required />
        </label>
        <fieldset className={estilos.campo}>
          <legend>Cómo registras el cumplimiento</legend>
          <div className={estilos.radios}>
            <label className={estilos.radio}><input type="radio" name="modo" checked={v.modo === 'manual'} onChange={() => setV({ ...v, modo: 'manual' })} /> Manual</label>
            <label className={estilos.radio}><input type="radio" name="modo" checked={v.modo === 'temporizador'} onChange={() => setV({ ...v, modo: 'temporizador' })} /> Temporizador</label>
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
